const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 500 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clips: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Clip' }],
  isPublic: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Playlist', playlistSchema);
