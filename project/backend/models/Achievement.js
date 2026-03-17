const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true },
  unlockedAt: { type: Date, default: Date.now }
}, { timestamps: true });

achievementSchema.index({ user: 1, key: 1 }, { unique: true });

// Achievement definitions
achievementSchema.statics.DEFINITIONS = {
  first_upload: { icon: 'fa-rocket', label: 'First Launch', description: 'Upload your first clip', color: 'text-blue-400' },
  ten_uploads: { icon: 'fa-film', label: 'Content Creator', description: 'Upload 10 clips', color: 'text-indigo-400' },
  fifty_uploads: { icon: 'fa-video', label: 'Clip Machine', description: 'Upload 50 clips', color: 'text-purple-400' },
  hundred_views: { icon: 'fa-eye', label: 'Getting Noticed', description: 'Reach 100 total views', color: 'text-emerald-400' },
  thousand_views: { icon: 'fa-binoculars', label: 'Crowd Pleaser', description: 'Reach 1,000 total views', color: 'text-green-400' },
  ten_k_views: { icon: 'fa-globe', label: 'Viral', description: 'Reach 10,000 total views', color: 'text-teal-400' },
  first_like: { icon: 'fa-thumbs-up', label: 'Liked', description: 'Receive your first like', color: 'text-pink-400' },
  hundred_likes: { icon: 'fa-heart', label: 'Fan Favorite', description: 'Receive 100 likes', color: 'text-rose-400' },
  thousand_likes: { icon: 'fa-fire', label: 'On Fire', description: 'Receive 1,000 likes', color: 'text-orange-400' },
  first_comment: { icon: 'fa-comment', label: 'Conversation Starter', description: 'Post your first comment', color: 'text-sky-400' },
  first_follower: { icon: 'fa-user-plus', label: 'Social', description: 'Get your first follower', color: 'text-blue-400' },
  fifty_followers: { icon: 'fa-users', label: 'Influencer', description: 'Reach 50 followers', color: 'text-violet-400' },
  featured_clip: { icon: 'fa-star', label: 'Featured', description: 'Have a clip featured', color: 'text-yellow-400' },
  first_bookmark: { icon: 'fa-bookmark', label: 'Collector', description: 'Bookmark your first clip', color: 'text-amber-400' },
  first_playlist: { icon: 'fa-list', label: 'Curator', description: 'Create your first playlist', color: 'text-cyan-400' },
  contest_winner: { icon: 'fa-trophy', label: 'Champion', description: 'Win a weekly contest', color: 'text-yellow-300' }
};

module.exports = mongoose.model('Achievement', achievementSchema);
