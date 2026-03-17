const express = require('express');
const passport = require('passport');
const crypto = require('crypto');
const User = require('../models/User');
const { authLimiter } = require('../middleware/rateLimiter');
const router = express.Router();

// Register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingUsername = await User.findOne({ username: { $regex: new RegExp(`^${escaped}$`, 'i') } });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');

    const user = new User({
      username,
      email: email.toLowerCase(),
      password,
      displayName: displayName || username,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=5865F2&color=fff`,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });
    await user.save();

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        success: true,
        user: { _id: user._id, username: user.username, email: user.email, avatar: user.avatar },
        verifyToken // In production, send this via email instead
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify email
router.get('/verify-email/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      emailVerifyToken: req.params.token,
      emailVerifyExpires: { $gt: Date.now() }
    });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }
    user.emailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request password reset
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal whether email exists
      return res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // In production, send email with reset link
    // For now, return token in response for development
    res.json({
      success: true,
      message: 'If that email is registered, a reset link has been sent.',
      resetToken // Remove in production — send via email
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset password
router.post('/reset-password/:token', authLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password has been reset' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: info?.message || 'Invalid email or password' });
    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, user: { _id: user._id, username: user.username, email: user.email, avatar: user.avatar } });
    });
  })(req, res, next);
});

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: err });
    res.redirect('/Home.html');
  });
});

// Guest login
router.post('/guest', async (req, res) => {
  try {
    const { username, displayName } = req.body;
    if (!username || !displayName) {
      return res.status(400).json({ error: 'Username and display name required' });
    }

    const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let user = await User.findOne({ username: { $regex: new RegExp(`^${escaped}$`, 'i') } });
    if (!user) {
      user = new User({
        username,
        email: `guest_${Date.now()}@guest.local`,
        displayName,
        isGuest: true,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=5865F2&color=fff`
      });
      await user.save();
    }

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ success: true, user });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', (req, res) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

module.exports = router;

