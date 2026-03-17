const mongoose = require('mongoose');

const clipSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  videoPath: { type: String, required: true },
  thumbnailPath: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  tags: [{ type: String }],
  category: { type: String, enum: ['aerial', 'ceiling-shot', 'flip-reset', 'double-tap', 'musty-flick', 'pinch', 'save', 'team-play', 'demo', 'redirect', 'freestyle', 'funny', 'other'], default: 'other' },
  rlRank: { type: String, enum: ['unranked', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion', 'grand-champion', 'ssl', ''], default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  featured: { type: Boolean, default: false },
  featuredAt: Date,
  trimStart: { type: Number, default: 0 },
  trimEnd: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Clip', clipSchema);

