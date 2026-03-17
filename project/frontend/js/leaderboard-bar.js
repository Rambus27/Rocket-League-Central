// ── Leaderboard Top Bar ─────────────────────────
// Injects a slim, scrolling leaderboard bar at the very top of every page.
(function () {
  'use strict';

  function buildBar(users) {
    if (!users || !users.length) return;

    const bar = document.createElement('div');
    bar.id = 'leaderboardBar';
    bar.className = 'leaderboard-bar';

    const medals = ['🥇', '🥈', '🥉'];
    const rankColors = ['text-amber-400', 'text-gray-300', 'text-orange-500'];

    const items = users.slice(0, 10).map((u, i) => {
      const medal = i < 3 ? `<span class="mr-0.5">${medals[i]}</span>` : `<span class="font-bold ${i < 3 ? rankColors[i] : 'text-white/40'} mr-1 text-[10px]">#${i + 1}</span>`;
      return `
        <a href="leaderboards.html" class="leaderboard-bar-item">
          ${medal}
          <img src="${u.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.username)}" class="w-5 h-5 rounded-full ring-1 ${i === 0 ? 'ring-amber-400/50' : 'ring-white/10'}">
          <span class="font-medium truncate max-w-[80px]">${u.displayName || u.username}</span>
          <span class="text-emerald-400 flex items-center gap-0.5"><i class="fas fa-eye" style="font-size:8px"></i>${u.totalViews.toLocaleString()}</span>
          <span class="text-pink-400 flex items-center gap-0.5"><i class="fas fa-heart" style="font-size:8px"></i>${u.totalLikes.toLocaleString()}</span>
        </a>`;
    }).join('<span class="leaderboard-bar-sep"></span>');

    bar.innerHTML = `
      <div class="leaderboard-bar-inner">
        <a href="leaderboards.html" class="leaderboard-bar-label">
          <i class="fas fa-trophy text-amber-400"></i>
          <span>Top 10</span>
        </a>
        <div class="leaderboard-bar-scroll">
          <div class="leaderboard-bar-track">
            ${items}
          </div>
        </div>
      </div>`;

    document.body.prepend(bar);

    // Push navbar and content down
    const navbar = document.getElementById('navbar') || document.querySelector('nav');
    if (navbar && getComputedStyle(navbar).position === 'fixed') {
      navbar.style.top = '36px';
    }
    // Adjust page top padding
    document.body.style.paddingTop = '36px';
  }

  async function loadBarData() {
    try {
      const res = await fetch('/api/users/leaderboard');
      if (!res.ok) return;
      const users = await res.json();
      const existing = document.getElementById('leaderboardBar');
      if (existing) existing.remove();
      buildBar(users);
    } catch { /* ignore */ }
  }

  // Load on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    loadBarData();
    // Refresh every 60s
    setInterval(loadBarData, 60000);
  });
})();
