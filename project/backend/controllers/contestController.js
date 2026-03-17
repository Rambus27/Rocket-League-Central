const Contest = require('../models/Contest');
const Clip = require('../models/Clip');
const Achievement = require('../models/Achievement');
const Notification = require('../models/Notification');

// Get active/recent contests
async function getContests(req, res) {
  try {
    const contests = await Contest.find()
      .populate({ path: 'entries', populate: { path: 'user', select: 'username avatar' } })
      .populate({ path: 'winner', populate: { path: 'user', select: 'username avatar' } })
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(contests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get single contest
async function getContest(req, res) {
  try {
    const contest = await Contest.findById(req.params.id)
      .populate({ path: 'entries', populate: { path: 'user', select: 'username avatar' } })
      .populate({ path: 'winner', populate: { path: 'user', select: 'username avatar' } });
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    res.json(contest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Create contest (admin)
async function createContest(req, res) {
  try {
    const { title, startDate, endDate } = req.body;
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ error: 'Title, start date, and end date required' });
    }
    const contest = new Contest({
      title,
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });
    await contest.save();
    res.json(contest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Enter clip in contest
async function enterContest(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    if (contest.status !== 'active') return res.status(400).json({ error: 'Contest is not accepting entries' });

    const { clipId } = req.body;
    const clip = await Clip.findById(clipId);
    if (!clip) return res.status(404).json({ error: 'Clip not found' });
    if (clip.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only enter your own clips' });
    }
    if (contest.entries.includes(clipId)) {
      return res.status(400).json({ error: 'Clip already entered' });
    }

    contest.entries.push(clipId);
    await contest.save();
    res.json(contest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Vote for a clip in contest
async function voteContest(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    if (contest.status !== 'voting') return res.status(400).json({ error: 'Contest is not in voting phase' });

    const { clipId } = req.body;
    const existingVote = contest.votes.find(v => v.user.toString() === req.user._id.toString());
    if (existingVote) {
      return res.status(400).json({ error: 'You already voted in this contest' });
    }

    contest.votes.push({ user: req.user._id, clip: clipId });
    await contest.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// End contest and pick winner (admin)
async function endContest(req, res) {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ error: 'Contest not found' });

    // Tally votes
    const voteCounts = {};
    contest.votes.forEach(v => {
      const cid = v.clip.toString();
      voteCounts[cid] = (voteCounts[cid] || 0) + 1;
    });

    let winnerId = null;
    let maxVotes = 0;
    for (const [clipId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        winnerId = clipId;
      }
    }

    contest.status = 'completed';
    contest.winner = winnerId;
    await contest.save();

    // Award winner
    if (winnerId) {
      const winnerClip = await Clip.findById(winnerId);
      if (winnerClip) {
        await Achievement.findOneAndUpdate(
          { user: winnerClip.user, key: 'contest_winner' },
          { $setOnInsert: { user: winnerClip.user, key: 'contest_winner' } },
          { upsert: true }
        );
        await new Notification({
          type: 'contest_win',
          from: req.user._id,
          to: winnerClip.user,
          clip: winnerClip._id,
          message: `Your clip "${winnerClip.title}" won the contest "${contest.title}"!`
        }).save();
        if (global.io) global.io.to(winnerClip.user.toString()).emit('notification', { type: 'contest_win' });
      }
    }

    res.json(contest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Update contest status (admin)
async function updateContestStatus(req, res) {
  try {
    const { status } = req.body;
    if (!['active', 'voting', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const contest = await Contest.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(contest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getContests,
  getContest,
  createContest,
  enterContest,
  voteContest,
  endContest,
  updateContestStatus
};
