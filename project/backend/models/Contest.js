const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clip: { type: mongoose.Schema.Types.ObjectId, ref: 'Clip', required: true }
}, { _id: false });

const contestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'voting', 'completed'], default: 'active' },
  entries: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Clip' }],
  votes: [voteSchema],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Clip' }
}, { timestamps: true });

module.exports = mongoose.model('Contest', contestSchema);
