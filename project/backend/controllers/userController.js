const User = require('../models/User');
const Clip = require('../models/Clip');
const Notification = require('../models/Notification');
const Achievement = require('../models/Achievement');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOADS_BASE = process.env.UPLOADS_BASE || (process.env.CODESPACES
  ? '/tmp/rocket-league-central-uploads'
  : path.join(__dirname, '../../uploads'));

// Avatar upload storage
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_BASE, 'avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user._id}${ext}`);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
}).single('avatar');

async function uploadAvatar(req, res) {
  avatarUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await User.findByIdAndUpdate(req.user._id, { avatar: avatarUrl });
    res.json({ success: true, avatar: avatarUrl });
  });
}

async function getUser(req, res) {
  try {
    const user = await User.findById(req.user._id).populate('clips');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getUserById(req, res) {
  try {
    const user = await User.findById(req.params.id)
      .populate('clips')
      .select('-email');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getUserClips(req, res) {
  try {
    const user = await User.findById(req.params.id).populate('clips');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.clips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateProfile(req, res) {
  try {
    const { displayName, bio } = req.body;
    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName.slice(0, 50);
    if (bio !== undefined) updates.bio = bio.slice(0, 300);

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function followUser(req, res) {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const alreadyFollowing = target.followers.includes(req.user._id);
    if (alreadyFollowing) {
      // Unfollow
      await User.findByIdAndUpdate(req.params.id, { $pull: { followers: req.user._id } });
      await User.findByIdAndUpdate(req.user._id, { $pull: { following: req.params.id } });
      res.json({ following: false, followers: target.followers.length - 1 });
    } else {
      // Follow
      await User.findByIdAndUpdate(req.params.id, { $addToSet: { followers: req.user._id } });
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { following: req.params.id } });
      // Notify
      await new Notification({
        type: 'follow',
        from: req.user._id,
        to: req.params.id
      }).save();
      if (global.io) global.io.to(req.params.id.toString()).emit('notification', { type: 'follow' });
      // XP for being followed
      await User.findByIdAndUpdate(req.params.id, { $inc: { xp: 5 } });
      // Achievement: first follower / 50 followers
      const updatedTarget = await User.findById(req.params.id);
      const followerCount = (updatedTarget.followers || []).length;
      if (followerCount >= 1) await Achievement.findOneAndUpdate({ user: req.params.id, key: 'first_follower' }, { $setOnInsert: { user: req.params.id, key: 'first_follower' } }, { upsert: true });
      if (followerCount >= 50) await Achievement.findOneAndUpdate({ user: req.params.id, key: 'fifty_followers' }, { $setOnInsert: { user: req.params.id, key: 'fifty_followers' } }, { upsert: true });
      res.json({ following: true, followers: target.followers.length + 1 });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getLeaderboard(req, res) {
  try {
    const users = await User.find().populate('clips').lean();
    const leaderboard = users.map(u => {
      const clips = u.clips || [];
      const totalViews = clips.reduce((sum, c) => sum + (c.views || 0), 0);
      const totalLikes = clips.reduce((sum, c) => sum + (c.likes || 0), 0);
      return {
        _id: u._id,
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        clipsCount: clips.length,
        totalViews,
        totalLikes,
        followers: (u.followers || []).length,
        xp: u.xp || 0,
        score: totalViews + totalLikes + (u.xp || 0)
      };
    });
    leaderboard.sort((a, b) => b.score - a.score);
    res.json(leaderboard.slice(0, 10));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getNotifications(req, res) {
  try {
    const notifications = await Notification.find({ to: req.user._id })
      .populate('from', 'username avatar')
      .populate('clip', 'title thumbnailPath')
      .sort({ createdAt: -1 })
      .limit(30);
    const unread = await Notification.countDocuments({ to: req.user._id, read: false });
    res.json({ notifications, unread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function markNotificationsRead(req, res) {
  try {
    await Notification.updateMany({ to: req.user._id, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Feed: clips from users you follow
async function getFeed(req, res) {
  try {
    const user = await User.findById(req.user._id);
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const clips = await Clip.find({ user: { $in: user.following }, status: 'approved' })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
    res.json(clips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── Site appearance settings ─────────────────────
const VALID_SETTINGS_KEYS = ['theme', 'accent', 'fontSize', 'fontFamily', 'cardStyle', 'hoverEffect', 'animations', 'borderRadius', 'bgEffects', 'navbarStyle', 'contentWidth', 'blurIntensity', 'gridDensity', 'scrollbarStyle'];

async function getSiteSettings(req, res) {
  try {
    const user = await User.findById(req.user._id).select('siteSettings');
    res.json(user.siteSettings || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function saveSiteSettings(req, res) {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Invalid settings' });
    }
    // Only allow known keys with string values
    const sanitized = {};
    for (const key of VALID_SETTINGS_KEYS) {
      if (typeof incoming[key] === 'string') {
        sanitized[key] = incoming[key].slice(0, 30);
      }
    }
    await User.findByIdAndUpdate(req.user._id, { siteSettings: sanitized });
    res.json({ success: true, settings: sanitized });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getUser,
  getUserById,
  getUserClips,
  updateProfile,
  uploadAvatar,
  followUser,
  getLeaderboard,
  getNotifications,
  markNotificationsRead,
  getFeed,
  getSiteSettings,
  saveSiteSettings,
  getUserAchievements,
  getUserXpRank
};

// ── Achievements ─────────────────────────────────
async function getUserAchievements(req, res) {
  try {
    const userId = req.params.id || req.user._id;
    const achievements = await Achievement.find({ user: userId }).lean();
    const definitions = Achievement.DEFINITIONS;
    const result = Object.entries(definitions).map(([key, def]) => {
      const unlocked = achievements.find(a => a.key === key);
      return {
        key,
        ...def,
        unlocked: !!unlocked,
        unlockedAt: unlocked ? unlocked.unlockedAt : null
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── XP Rank ──────────────────────────────────────
async function getUserXpRank(req, res) {
  try {
    const userId = req.params.id || req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const xp = user.xp || 0;
    let rank = 'Bronze I';
    if (xp >= 5000) rank = 'SSL';
    else if (xp >= 3000) rank = 'Grand Champion';
    else if (xp >= 2000) rank = 'Champion';
    else if (xp >= 1200) rank = 'Diamond';
    else if (xp >= 700) rank = 'Platinum';
    else if (xp >= 400) rank = 'Gold';
    else if (xp >= 200) rank = 'Silver';
    else if (xp >= 50) rank = 'Bronze III';
    else if (xp >= 20) rank = 'Bronze II';

    res.json({ xp, rank });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

