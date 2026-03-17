const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: { type: String, enum: ['like', 'comment', 'follow', 'mention', 'reply', 'achievement', 'contest_win'], required: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clip: { type: mongoose.Schema.Types.ObjectId, ref: 'Clip' },
  comment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
  message: { type: String },
  read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
