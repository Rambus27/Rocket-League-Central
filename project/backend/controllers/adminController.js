const User = require('../models/User');
const Clip = require('../models/Clip');
const Report = require('../models/Report');
const Comment = require('../models/Comment');

async function getStats(req, res) {
  try {
    const totalUsers = await User.countDocuments();
    const totalClips = await Clip.countDocuments();
    const pendingClips = await Clip.countDocuments({ status: 'pending' });
    const pendingReports = await Report.countDocuments({ status: 'pending' });
    const totalComments = await Comment.countDocuments();

    const clips = await Clip.find().lean();
    const totalViews = clips.reduce((s, c) => s + (c.views || 0), 0);
    const totalLikes = clips.reduce((s, c) => s + (c.likes || 0), 0);

    res.json({ totalUsers, totalClips, pendingClips, pendingReports, totalComments, totalViews, totalLikes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getReports(req, res) {
  try {
    const reports = await Report.find({ status: 'pending' })
      .populate('clip', 'title thumbnailPath user')
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function resolveReport(req, res) {
  try {
    const { action } = req.body;
    if (!['reviewed', 'dismissed'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    const report = await Report.findByIdAndUpdate(req.params.id, { status: action }, { new: true });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getAllUsers(req, res) {
  try {
    const users = await User.find()
      .select('username displayName avatar role createdAt clips followers')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function setUserRole(req, res) {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getStats, getReports, resolveReport, getAllUsers, setUserRole };
