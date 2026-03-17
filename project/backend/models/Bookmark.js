const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clip: { type: mongoose.Schema.Types.ObjectId, ref: 'Clip', required: true }
}, { timestamps: true });

bookmarkSchema.index({ user: 1, clip: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
