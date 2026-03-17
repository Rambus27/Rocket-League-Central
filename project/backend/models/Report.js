const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  clip: { type: mongoose.Schema.Types.ObjectId, ref: 'Clip', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
