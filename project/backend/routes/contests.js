const express = require('express');
const {
  getContests, getContest, createContest,
  enterContest, voteContest, endContest, updateContestStatus
} = require('../controllers/contestController');
const { ensureAuth, ensureAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', getContests);
router.get('/:id', getContest);
router.post('/', ensureAuth, ensureAdmin, createContest);
router.post('/:id/enter', ensureAuth, enterContest);
router.post('/:id/vote', ensureAuth, voteContest);
router.post('/:id/end', ensureAuth, ensureAdmin, endContest);
router.put('/:id/status', ensureAuth, ensureAdmin, updateContestStatus);

module.exports = router;
