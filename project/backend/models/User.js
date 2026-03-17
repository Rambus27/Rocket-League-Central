const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  displayName: String,
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  avatar: String,
  bio: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isGuest: { type: Boolean, default: false },
  clips: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Clip' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Clip' }],
  xp: { type: Number, default: 0 },
  emailVerified: { type: Boolean, default: false },
  emailVerifyToken: String,
  emailVerifyExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  siteSettings: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);

