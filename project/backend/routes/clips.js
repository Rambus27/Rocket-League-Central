const express = require('express');
const {
  getClips, getTrending, uploadTempClip, createClip, getClip, likeClip, upload,
  addComment, getRelated, getFeatured, setFeatured, reportClip, deleteClip, getTags,
  getPending, moderateClip, getRandomClip, bookmarkClip, getBookmarks, getHighlights,
  getCategories, downloadClip, getEmbedCode
} = require('../controllers/clipController');
const { ensureAuth, ensureAdmin } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const router = express.Router();

// GET /api/clips - all clips
router.get('/', getClips);

// GET /api/clips/trending
router.get('/trending', getTrending);

// GET /api/clips/featured
router.get('/featured', getFeatured);

// GET /api/clips/tags - all unique tags
router.get('/tags', getTags);

// GET /api/clips/random
router.get('/random', getRandomClip);

// GET /api/clips/highlights
router.get('/highlights', getHighlights);

// GET /api/clips/categories
router.get('/categories', getCategories);

// GET /api/clips/bookmarks
router.get('/bookmarks', ensureAuth, getBookmarks);

// GET /api/clips/pending (admin)
router.get('/pending', ensureAuth, ensureAdmin, getPending);

// POST /api/clips/upload - upload video first, publish later
router.post('/upload', uploadLimiter, upload.single('video'), uploadTempClip);

// POST /api/clips - create clip
router.post('/', upload.single('video'), createClip);

// GET /api/clips/:id
router.get('/:id', getClip);

// GET /api/clips/:id/related
router.get('/:id/related', getRelated);

// GET /api/clips/:id/embed
router.get('/:id/embed', getEmbedCode);

// GET /api/clips/:id/download
router.get('/:id/download', downloadClip);

// POST /api/clips/:id/like
router.post('/:id/like', ensureAuth, likeClip);

// POST /api/clips/:id/bookmark
router.post('/:id/bookmark', ensureAuth, bookmarkClip);

// POST /api/clips/:id/comment
router.post('/:id/comment', ensureAuth, addComment);

// POST /api/clips/:id/report
router.post('/:id/report', ensureAuth, reportClip);

// POST /api/clips/:id/feature (admin)
router.post('/:id/feature', ensureAuth, ensureAdmin, setFeatured);

// POST /api/clips/:id/moderate (admin)
router.post('/:id/moderate', ensureAuth, ensureAdmin, moderateClip);

// DELETE /api/clips/:id
router.delete('/:id', ensureAuth, deleteClip);

module.exports = router;

