const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  text: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clip: { type: mongoose.Schema.Types.ObjectId, ref: 'Clip', required: true },
  parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  mentions: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);

