const Playlist = require('../models/Playlist');
const Achievement = require('../models/Achievement');

// Get user's playlists
async function getMyPlaylists(req, res) {
  try {
    const playlists = await Playlist.find({ user: req.user._id })
      .populate({ path: 'clips', populate: { path: 'user', select: 'username avatar' } })
      .sort({ createdAt: -1 });
    res.json(playlists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get public playlists by user
async function getUserPlaylists(req, res) {
  try {
    const playlists = await Playlist.find({ user: req.params.id, isPublic: true })
      .populate({ path: 'clips', populate: { path: 'user', select: 'username avatar' } })
      .sort({ createdAt: -1 });
    res.json(playlists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get single playlist
async function getPlaylist(req, res) {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate('user', 'username avatar')
      .populate({ path: 'clips', populate: { path: 'user', select: 'username avatar' } });
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (!playlist.isPublic && (!req.user || playlist.user._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({ error: 'Private playlist' });
    }
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Create playlist
async function createPlaylist(req, res) {
  try {
    const { name, description, isPublic } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });

    const playlist = new Playlist({
      name: name.trim().slice(0, 100),
      description: (description || '').slice(0, 500),
      user: req.user._id,
      isPublic: isPublic !== false
    });
    await playlist.save();

    // Achievement
    await Achievement.findOneAndUpdate(
      { user: req.user._id, key: 'first_playlist' },
      { $setOnInsert: { user: req.user._id, key: 'first_playlist' } },
      { upsert: true }
    );

    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Add clip to playlist
async function addToPlaylist(req, res) {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (playlist.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not your playlist' });
    }
    const { clipId } = req.body;
    if (playlist.clips.includes(clipId)) {
      return res.status(400).json({ error: 'Clip already in playlist' });
    }
    playlist.clips.push(clipId);
    await playlist.save();
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Remove clip from playlist
async function removeFromPlaylist(req, res) {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (playlist.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not your playlist' });
    }
    playlist.clips = playlist.clips.filter(c => c.toString() !== req.params.clipId);
    await playlist.save();
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Delete playlist
async function deletePlaylist(req, res) {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (playlist.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not your playlist' });
    }
    await Playlist.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getMyPlaylists,
  getUserPlaylists,
  getPlaylist,
  createPlaylist,
  addToPlaylist,
  removeFromPlaylist,
  deletePlaylist
};
