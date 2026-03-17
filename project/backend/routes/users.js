const express = require('express');
const {
  getUser, getUserById, getUserClips, updateProfile, uploadAvatar, followUser,
  getLeaderboard, getNotifications, markNotificationsRead, getFeed,
  getSiteSettings, saveSiteSettings, getUserAchievements, getUserXpRank
} = require('../controllers/userController');
const { ensureAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/me', ensureAuth, getUser);
router.get('/leaderboard', getLeaderboard);
router.get('/notifications', ensureAuth, getNotifications);
router.post('/notifications/read', ensureAuth, markNotificationsRead);
router.get('/feed', ensureAuth, getFeed);
router.put('/profile', ensureAuth, updateProfile);
router.post('/avatar', ensureAuth, uploadAvatar);
router.get('/settings', ensureAuth, getSiteSettings);
router.put('/settings', ensureAuth, saveSiteSettings);
router.get('/achievements', ensureAuth, getUserAchievements);
router.get('/xp-rank', ensureAuth, getUserXpRank);
router.get('/:id/achievements', getUserAchievements);
router.get('/:id/xp-rank', getUserXpRank);
router.post('/:id/follow', ensureAuth, followUser);
router.get('/:id', getUserById);
router.get('/:id/clips', getUserClips);

module.exports = router;

