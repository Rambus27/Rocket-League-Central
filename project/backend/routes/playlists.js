const express = require('express');
const {
  getMyPlaylists, getUserPlaylists, getPlaylist,
  createPlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist
} = require('../controllers/playlistController');
const { ensureAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/mine', ensureAuth, getMyPlaylists);
router.get('/user/:id', getUserPlaylists);
router.get('/:id', getPlaylist);
router.post('/', ensureAuth, createPlaylist);
router.post('/:id/clips', ensureAuth, addToPlaylist);
router.delete('/:id/clips/:clipId', ensureAuth, removeFromPlaylist);
router.delete('/:id', ensureAuth, deletePlaylist);

module.exports = router;
