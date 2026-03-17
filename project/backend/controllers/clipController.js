const Clip = require('../models/Clip');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const Bookmark = require('../models/Bookmark');
const Achievement = require('../models/Achievement');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');

const UPLOADS_BASE = process.env.UPLOADS_BASE || (process.env.CODESPACES
  ? '/tmp/rocket-league-central-uploads'
  : path.join(__dirname, '../../uploads'));

const TEMP_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const pendingUploads = new Map();

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UPLOADS_BASE, 'videos')),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only video files allowed'), false);
  },
  limits: { fileSize: 2.5 * 1024 * 1024 * 1024 } // 2.5GB
});

function safeUnlink(filePath) {
  if (!filePath) {
    return;
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Failed to remove file:', filePath, err.message);
  }
}

function pruneExpiredPendingUploads() {
  const now = Date.now();

  for (const [uploadId, uploadInfo] of pendingUploads.entries()) {
    if (now - uploadInfo.createdAt > TEMP_UPLOAD_TTL_MS) {
      safeUnlink(uploadInfo.path);
      pendingUploads.delete(uploadId);
    }
  }
}

async function resolveUser(req, handle) {
  let user = req.user;

  if (handle && !user) {
    if (!handle.startsWith('@') || handle.length < 3) {
      const error = new Error('Invalid handle format. Use @username');
      error.statusCode = 400;
      throw error;
    }

    user = await User.findOne({ username: handle });
    if (!user) {
      user = new User({
        username: handle,
        email: `guest_${Date.now()}@guest.local`,
        displayName: handle.replace('@', ''),
        isGuest: true,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(handle.replace('@', ''))}&background=5865F2&color=fff`
      });
      await user.save();
    }
  }

  if (!user) {
    const error = new Error('Authentication required. Please login.');
    error.statusCode = 401;
    throw error;
  }

  return user;
}

function getUploadSource(req) {
  if (req.file) {
    return {
      file: req.file,
      uploadId: null
    };
  }

  const uploadId = req.body.uploadId;
  if (!uploadId) {
    const error = new Error('No uploaded clip was provided.');
    error.statusCode = 400;
    throw error;
  }

  pruneExpiredPendingUploads();

  const uploadInfo = pendingUploads.get(uploadId);
  if (!uploadInfo) {
    const error = new Error('Uploaded clip not found or expired. Please upload the file again.');
    error.statusCode = 400;
    throw error;
  }

  return {
    file: {
      path: uploadInfo.path,
      filename: uploadInfo.filename,
      mimetype: uploadInfo.mimetype,
      size: uploadInfo.size
    },
    uploadId
  };
}

function createThumbnail(videoPath, fileName) {
  const thumbnailFileName = `${fileName}.jpg`;
  const thumbnailFolder = path.join(UPLOADS_BASE, 'thumbnails');

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['1%'],
        filename: thumbnailFileName,
        folder: thumbnailFolder,
        size: '320x240'
      })
      .on('end', () => resolve(`/uploads/thumbnails/${thumbnailFileName}`))
      .on('error', reject);
  });
}

async function persistClip({ title, description, file, user, tags, category, rlRank, trimStart, trimEnd }) {
  const thumbnailPath = await createThumbnail(file.path, file.filename);

  const clip = new Clip({
    title,
    description,
    videoPath: `/uploads/videos/${file.filename}`,
    thumbnailPath,
    user: user._id,
    tags: tags || [],
    category: category || 'other',
    rlRank: rlRank || '',
    trimStart: trimStart || 0,
    trimEnd: trimEnd || 0
  });

  await clip.save();
  await User.findByIdAndUpdate(user._id, { $push: { clips: clip._id }, $inc: { xp: 10 } });

  // Check upload achievements
  const userDoc = await User.findById(user._id).populate('clips');
  const clipsCount = (userDoc.clips || []).length;
  if (clipsCount >= 1) await Achievement.findOneAndUpdate({ user: user._id, key: 'first_upload' }, { $setOnInsert: { user: user._id, key: 'first_upload' } }, { upsert: true });
  if (clipsCount >= 10) await Achievement.findOneAndUpdate({ user: user._id, key: 'ten_uploads' }, { $setOnInsert: { user: user._id, key: 'ten_uploads' } }, { upsert: true });
  if (clipsCount >= 50) await Achievement.findOneAndUpdate({ user: user._id, key: 'fifty_uploads' }, { $setOnInsert: { user: user._id, key: 'fifty_uploads' } }, { upsert: true });

  // Start background video compression
  startVideoCompression(file.path, file.filename);

  return clip;
}

function getErrorStatus(err) {
  return err.statusCode || 500;
}

// Get all clips with filtering and sorting
async function getClips(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const sort = req.query.sort || 'newest';
    const tag = req.query.tag;
    const search = req.query.search;
    const category = req.query.category;
    const rlRank = req.query.rlRank;

    const filter = { status: 'approved' };
    if (tag) filter.tags = tag;
    if (category && category !== 'all') filter.category = category;
    if (rlRank && rlRank !== 'all') filter.rlRank = rlRank;
    if (search) {
      const sanitized = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: sanitized, $options: 'i' } },
        { description: { $regex: sanitized, $options: 'i' } }
      ];
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'oldest') sortObj = { createdAt: 1 };
    else if (sort === 'most-viewed') sortObj = { views: -1 };
    else if (sort === 'most-liked') sortObj = { likes: -1 };

    const total = await Clip.countDocuments(filter);
    const clips = await Clip.find(filter)
      .populate('user', 'username avatar')
      .populate('comments')
      .sort(sortObj)
      .limit(limit)
      .skip((page - 1) * limit);
    res.json({ clips, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get trending clips
async function getTrending(req, res) {
  try {
    const clips = await Clip.find({ status: 'approved' })
      .populate('user', 'username avatar')
      .sort({ views: -1, likes: -1 })
      .limit(10);
    res.json(clips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function uploadTempClip(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Video file is required.' });
    }

    pruneExpiredPendingUploads();

    const uploadId = crypto.randomUUID();
    pendingUploads.set(uploadId, {
      createdAt: Date.now(),
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      path: req.file.path,
      size: req.file.size
    });

    res.json({
      uploadId,
      videoPath: `/uploads/videos/${req.file.filename}`
    });
  } catch (err) {
    safeUnlink(req.file?.path);
    res.status(getErrorStatus(err)).json({ error: err.message });
  }
}

// Create clip
async function createClip(req, res) {
  let shouldDiscardPendingUpload = false;

  try {
    const { title, description, handle, tags, category, rlRank, trimStart, trimEnd } = req.body;
    const { file, uploadId } = getUploadSource(req);
    const user = await resolveUser(req, handle);
    shouldDiscardPendingUpload = Boolean(uploadId);

    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = (typeof tags === 'string' ? JSON.parse(tags) : tags)
          .map(t => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 10);
      } catch (e) { /* ignore bad tags */ }
    }

    const clip = await persistClip({ title, description, file, user, tags: parsedTags, category, rlRank, trimStart: parseFloat(trimStart) || 0, trimEnd: parseFloat(trimEnd) || 0 });

    if (uploadId) {
      pendingUploads.delete(uploadId);
    }

    res.json(clip);
  } catch (err) {
    console.error('Create clip error:', err);

    if (req.file?.path) {
      safeUnlink(req.file.path);
    }

    if (shouldDiscardPendingUpload && req.body.uploadId) {
      const uploadInfo = pendingUploads.get(req.body.uploadId);
      if (uploadInfo) {
        safeUnlink(uploadInfo.path);
        pendingUploads.delete(req.body.uploadId);
      }
    }

    res.status(getErrorStatus(err)).json({ error: err.message });
  }
}

// Get single clip
async function getClip(req, res) {
  try {
    const clip = await Clip.findById(req.params.id)
      .populate('user', 'username avatar')
      .populate({
        path: 'comments',
        populate: [
          { path: 'user', select: 'username avatar' },
          { path: 'replies', populate: { path: 'user', select: 'username avatar' } }
        ],
        options: { sort: { createdAt: -1 } }
      });
    if (!clip) return res.status(404).json({ error: 'Clip not found' });
    clip.views += 1;
    await clip.save();

    // Check view achievements for clip owner
    const ownerClips = await Clip.find({ user: clip.user._id || clip.user });
    const totalViews = ownerClips.reduce((s, c) => s + (c.views || 0), 0);
    const ownerId = clip.user._id || clip.user;
    if (totalViews >= 100) await Achievement.findOneAndUpdate({ user: ownerId, key: 'hundred_views' }, { $setOnInsert: { user: ownerId, key: 'hundred_views' } }, { upsert: true });
    if (totalViews >= 1000) await Achievement.findOneAndUpdate({ user: ownerId, key: 'thousand_views' }, { $setOnInsert: { user: ownerId, key: 'thousand_views' } }, { upsert: true });
    if (totalViews >= 10000) await Achievement.findOneAndUpdate({ user: ownerId, key: 'ten_k_views' }, { $setOnInsert: { user: ownerId, key: 'ten_k_views' } }, { upsert: true });

    res.json(clip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Like clip
async function likeClip(req, res) {
  try {
    const clip = await Clip.findById(req.params.id);
    if (!clip) return res.status(404).json({ error: 'Clip not found' });

    const idx = clip.likedBy.indexOf(req.user._id);
    if (idx === -1) {
      clip.likes += 1;
      clip.likedBy.push(req.user._id);
      // XP for clip owner
      await User.findByIdAndUpdate(clip.user, { $inc: { xp: 3 } });
      // Notify clip owner
      if (clip.user.toString() !== req.user._id.toString()) {
        await new Notification({
          type: 'like',
          from: req.user._id,
          to: clip.user,
          clip: clip._id
        }).save();
        if (global.io) global.io.to(clip.user.toString()).emit('notification', { type: 'like' });
      }
      // Check like achievements for clip owner
      const ownerClips = await Clip.find({ user: clip.user });
      const totalLikes = ownerClips.reduce((s, c) => s + (c.likes || 0), 0) + 1;
      if (totalLikes >= 1) await Achievement.findOneAndUpdate({ user: clip.user, key: 'first_like' }, { $setOnInsert: { user: clip.user, key: 'first_like' } }, { upsert: true });
      if (totalLikes >= 100) await Achievement.findOneAndUpdate({ user: clip.user, key: 'hundred_likes' }, { $setOnInsert: { user: clip.user, key: 'hundred_likes' } }, { upsert: true });
      if (totalLikes >= 1000) await Achievement.findOneAndUpdate({ user: clip.user, key: 'thousand_likes' }, { $setOnInsert: { user: clip.user, key: 'thousand_likes' } }, { upsert: true });
    } else {
      clip.likes = Math.max(0, clip.likes - 1);
      clip.likedBy.splice(idx, 1);
    }
    await clip.save();
    res.json({ likes: clip.likes, liked: idx === -1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  upload,
  getClips,
  getTrending,
  uploadTempClip,
  createClip,
  getClip,
  likeClip,
  addComment,
  getRelated,
  getFeatured,
  setFeatured,
  reportClip,
  deleteClip,
  getTags,
  getPending,
  moderateClip,
  getRandomClip,
  bookmarkClip,
  getBookmarks,
  getHighlights,
  getCategories,
  downloadClip,
  getEmbedCode
};

// Add comment to clip (with reply and mention support)
async function addComment(req, res) {
  try {
    const { text, parentCommentId } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });

    const clip = await Clip.findById(req.params.id);
    if (!clip) return res.status(404).json({ error: 'Clip not found' });

    // Parse @mentions
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    const comment = new Comment({
      text: text.trim(),
      user: req.user._id,
      clip: clip._id,
      parentComment: parentCommentId || null,
      mentions
    });
    await comment.save();

    // If it's a reply, add to parent's replies array
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, { $push: { replies: comment._id } });
      // Notify parent comment author
      const parentComment = await Comment.findById(parentCommentId);
      if (parentComment && parentComment.user.toString() !== req.user._id.toString()) {
        await new Notification({
          type: 'reply',
          from: req.user._id,
          to: parentComment.user,
          clip: clip._id,
          comment: comment._id
        }).save();
        if (global.io) global.io.to(parentComment.user.toString()).emit('notification', { type: 'reply' });
      }
    }

    clip.comments.push(comment._id);
    await clip.save();

    // Notify clip owner (if not self)
    if (clip.user.toString() !== req.user._id.toString()) {
      await new Notification({
        type: 'comment',
        from: req.user._id,
        to: clip.user,
        clip: clip._id,
        comment: comment._id
      }).save();
      if (global.io) global.io.to(clip.user.toString()).emit('notification', { type: 'comment' });
    }

    // Notify mentioned users
    if (mentions.length > 0) {
      const mentionedUsers = await User.find({ username: { $in: mentions } });
      for (const mu of mentionedUsers) {
        if (mu._id.toString() !== req.user._id.toString()) {
          await new Notification({
            type: 'mention',
            from: req.user._id,
            to: mu._id,
            clip: clip._id,
            comment: comment._id,
            message: text.trim().slice(0, 100)
          }).save();
          if (global.io) global.io.to(mu._id.toString()).emit('notification', { type: 'mention' });
        }
      }
    }

    // XP for commenting
    await User.findByIdAndUpdate(req.user._id, { $inc: { xp: 2 } });
    // Achievement: first comment
    await Achievement.findOneAndUpdate(
      { user: req.user._id, key: 'first_comment' },
      { $setOnInsert: { user: req.user._id, key: 'first_comment' } },
      { upsert: true, new: true }
    );

    const populated = await comment.populate('user', 'username avatar');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get related clips (same tags or same user)
async function getRelated(req, res) {
  try {
    const clip = await Clip.findById(req.params.id);
    if (!clip) return res.status(404).json({ error: 'Clip not found' });

    let related = [];
    if (clip.tags && clip.tags.length > 0) {
      related = await Clip.find({
        _id: { $ne: clip._id },
        status: 'approved',
        tags: { $in: clip.tags }
      })
      .populate('user', 'username avatar')
      .sort({ views: -1 })
      .limit(6);
    }

    if (related.length < 6) {
      const moreFromUser = await Clip.find({
        _id: { $ne: clip._id, $nin: related.map(r => r._id) },
        status: 'approved',
        user: clip.user
      })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(6 - related.length);
      related = related.concat(moreFromUser);
    }

    if (related.length < 6) {
      const filler = await Clip.find({
        _id: { $ne: clip._id, $nin: related.map(r => r._id) },
        status: 'approved'
      })
      .populate('user', 'username avatar')
      .sort({ views: -1 })
      .limit(6 - related.length);
      related = related.concat(filler);
    }

    res.json(related);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get featured clip
async function getFeatured(req, res) {
  try {
    const clip = await Clip.findOne({ featured: true, status: 'approved' })
      .populate('user', 'username avatar')
      .sort({ featuredAt: -1 });
    res.json(clip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Set featured clip (admin only)
async function setFeatured(req, res) {
  try {
    // Unfeature all
    await Clip.updateMany({}, { featured: false });
    const clip = await Clip.findByIdAndUpdate(req.params.id, {
      featured: true,
      featuredAt: new Date()
    }, { new: true }).populate('user', 'username avatar');
    res.json(clip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Report a clip
async function reportClip(req, res) {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'Reason required' });

    const existing = await Report.findOne({ clip: req.params.id, user: req.user._id, status: 'pending' });
    if (existing) return res.status(400).json({ error: 'You already reported this clip' });

    const report = new Report({
      clip: req.params.id,
      user: req.user._id,
      reason: reason.trim()
    });
    await report.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Delete clip
async function deleteClip(req, res) {
  try {
    const clip = await Clip.findById(req.params.id);
    if (!clip) return res.status(404).json({ error: 'Clip not found' });

    // Only owner or admin can delete
    if (clip.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Clean up files
    const videoFile = path.join(UPLOADS_BASE, clip.videoPath.replace('/uploads/', ''));
    const thumbFile = path.join(UPLOADS_BASE, clip.thumbnailPath.replace('/uploads/', ''));
    safeUnlink(videoFile);
    safeUnlink(thumbFile);

    // Remove comments
    await Comment.deleteMany({ clip: clip._id });
    await Report.deleteMany({ clip: clip._id });
    await Notification.deleteMany({ clip: clip._id });
    await User.findByIdAndUpdate(clip.user, { $pull: { clips: clip._id } });
    await Clip.findByIdAndDelete(clip._id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get all unique tags
async function getTags(req, res) {
  try {
    const tags = await Clip.distinct('tags', { status: 'approved' });
    res.json(tags.sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get pending clips (admin)
async function getPending(req, res) {
  try {
    const clips = await Clip.find({ status: 'pending' })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(clips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Approve or reject clip (admin)
async function moderateClip(req, res) {
  try {
    const { action } = req.body;
    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    const clip = await Clip.findByIdAndUpdate(req.params.id, { status: action }, { new: true })
      .populate('user', 'username avatar');
    res.json(clip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Video Compression Pipeline ───────────────────
function startVideoCompression(videoPath, filename) {
  const compressedDir = path.join(UPLOADS_BASE, 'videos', 'compressed');
  if (!fs.existsSync(compressedDir)) fs.mkdirSync(compressedDir, { recursive: true });

  const qualities = [
    { suffix: '480p', size: '854x480', bitrate: '1000k' },
    { suffix: '720p', size: '1280x720', bitrate: '2500k' }
  ];

  qualities.forEach(q => {
    const outPath = path.join(compressedDir, `${filename}_${q.suffix}.mp4`);
    ffmpeg(videoPath)
      .outputOptions([
        `-vf scale=${q.size}:force_original_aspect_ratio=decrease,pad=${q.size}:(ow-iw)/2:(oh-ih)/2`,
        `-b:v ${q.bitrate}`,
        '-c:v libx264',
        '-preset fast',
        '-c:a aac',
        '-b:a 128k'
      ])
      .output(outPath)
      .on('end', () => console.log(`Compressed ${filename} to ${q.suffix}`))
      .on('error', (err) => console.error(`Compression error (${q.suffix}):`, err.message))
      .run();
  });
}

// ── Random Clip ──────────────────────────────────
async function getRandomClip(req, res) {
  try {
    const count = await Clip.countDocuments({ status: 'approved' });
    if (count === 0) return res.json(null);
    const random = Math.floor(Math.random() * count);
    const clip = await Clip.findOne({ status: 'approved' })
      .skip(random)
      .populate('user', 'username avatar');
    res.json(clip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Bookmarks ────────────────────────────────────
async function bookmarkClip(req, res) {
  try {
    const clipId = req.params.id;
    const userId = req.user._id;

    const existing = await Bookmark.findOne({ user: userId, clip: clipId });
    if (existing) {
      await Bookmark.deleteOne({ _id: existing._id });
      await User.findByIdAndUpdate(userId, { $pull: { bookmarks: clipId } });
      return res.json({ bookmarked: false });
    }

    await new Bookmark({ user: userId, clip: clipId }).save();
    await User.findByIdAndUpdate(userId, { $addToSet: { bookmarks: clipId } });

    // Achievement: first bookmark
    await Achievement.findOneAndUpdate(
      { user: userId, key: 'first_bookmark' },
      { $setOnInsert: { user: userId, key: 'first_bookmark' } },
      { upsert: true }
    );

    res.json({ bookmarked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getBookmarks(req, res) {
  try {
    const bookmarks = await Bookmark.find({ user: req.user._id })
      .populate({ path: 'clip', populate: { path: 'user', select: 'username avatar' } })
      .sort({ createdAt: -1 });
    const clips = bookmarks.map(b => b.clip).filter(Boolean);
    res.json(clips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Highlights (weekly/monthly) ──────────────────
async function getHighlights(req, res) {
  try {
    const period = req.query.period || 'week';
    const now = new Date();
    let startDate;

    if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    }

    const clips = await Clip.find({
      status: 'approved',
      createdAt: { $gte: startDate }
    })
      .populate('user', 'username avatar')
      .sort({ likes: -1, views: -1 })
      .limit(20);
    res.json(clips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Categories ───────────────────────────────────
async function getCategories(req, res) {
  try {
    const categories = await Clip.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Download ─────────────────────────────────────
async function downloadClip(req, res) {
  try {
    const clip = await Clip.findById(req.params.id);
    if (!clip) return res.status(404).json({ error: 'Clip not found' });

    const videoFile = path.join(UPLOADS_BASE, clip.videoPath.replace('/uploads/', ''));
    if (!fs.existsSync(videoFile)) return res.status(404).json({ error: 'File not found' });

    const safeName = clip.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    res.download(videoFile, `${safeName}.mp4`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Embed Code ───────────────────────────────────
async function getEmbedCode(req, res) {
  try {
    const clip = await Clip.findById(req.params.id);
    if (!clip) return res.status(404).json({ error: 'Clip not found' });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const embedHtml = `<iframe src="${baseUrl}/watch.html?id=${clip._id}&embed=1" width="640" height="360" frameborder="0" allowfullscreen></iframe>`;
    res.json({ embedHtml, shareUrl: `${baseUrl}/watch.html?id=${clip._id}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

