const API_BASE = '/api';

// ── HTML escaping for XSS protection ────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Theme (with server persistence) ─────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
  // Persist to server if logged in
  if (window.currentUser) {
    fetch(`${API_BASE}/users/settings`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next })
    }).catch(() => {});
  }
}
function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.innerHTML = theme === 'dark'
    ? '<i class="fas fa-sun"></i>'
    : '<i class="fas fa-moon"></i>';
}

// ── Navbar scroll ───────────────────────────────
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('backdrop-blur-md', 'bg-black/40', 'border-b', 'border-white/[0.06]');
    } else {
      navbar.classList.remove('backdrop-blur-md', 'bg-black/40', 'border-b', 'border-white/[0.06]');
    }
  });
}

// ── Auth ────────────────────────────────────────
let _checkAuthPromise = null;
async function checkAuth() {
  if (_checkAuthPromise) return _checkAuthPromise;
  _checkAuthPromise = _doCheckAuth();
  // Allow re-check after it resolves
  _checkAuthPromise.finally(() => { _checkAuthPromise = null; });
  return _checkAuthPromise;
}
async function _doCheckAuth() {
  try {
    const res = await fetch(`${API_BASE}/users/me`, { credentials: 'include' });
    if (res.ok) {
      const user = await res.json();
      window.currentUser = user;
      const userMenu = document.getElementById('userMenu');
      const userAvatar = document.getElementById('userAvatar');
      const usernameEl = document.getElementById('username');
      const loginBtn = document.getElementById('loginBtn');
      if (userMenu) {
        userMenu.style.display = 'flex';
        if (userAvatar) userAvatar.src = user.avatar;
        if (usernameEl) usernameEl.textContent = user.displayName || user.username;
      }
      if (loginBtn) loginBtn.style.display = 'none';
      // Show notification bell
      loadNotificationBadge();
      // Connect to websocket for real-time notifications
      connectWebSocket(user._id);
      // Restore theme from server settings
      if (user.siteSettings && user.siteSettings.theme) {
        const serverTheme = user.siteSettings.theme;
        document.documentElement.setAttribute('data-theme', serverTheme);
        localStorage.setItem('theme', serverTheme);
        updateThemeIcon(serverTheme);
      }
      return user;
    }
  } catch (e) { /* not logged in */ }
  window.currentUser = null;
  return null;
}

// ── WebSocket for real-time notifications ────────
function connectWebSocket(userId) {
  if (typeof io === 'undefined') return;
  const socket = io();
  socket.emit('join', userId);
  socket.on('notification', (data) => {
    loadNotificationBadge();
    // Show toast notification
    showToast(data.type === 'like' ? 'Someone liked your clip!' :
              data.type === 'comment' ? 'New comment on your clip!' :
              data.type === 'follow' ? 'You have a new follower!' :
              data.type === 'mention' ? 'You were mentioned in a comment!' :
              data.type === 'reply' ? 'Someone replied to your comment!' :
              data.type === 'contest_win' ? 'You won a contest!' :
              'New notification');
  });
}

// ── Toast notifications ─────────────────────────
function showToast(message, duration = 4000) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-20 right-6 z-[10001] glass-card px-5 py-3 rounded-2xl text-sm font-medium slide-in flex items-center gap-2 max-w-xs';
  toast.innerHTML = `<i class="fas fa-bell text-indigo-400"></i>${message}`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ── Profile dropdown toggle ─────────────────────
function toggleProfileDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('profileDropdown');
  if (dd) dd.classList.toggle('hidden');
}
document.addEventListener('click', () => {
  const dd = document.getElementById('profileDropdown');
  if (dd) dd.classList.add('hidden');
});

// ── Notifications badge ─────────────────────────
async function loadNotificationBadge() {
  const bell = document.getElementById('notifBell');
  if (!bell) return;
  try {
    const res = await fetch(`${API_BASE}/users/notifications`, { credentials: 'include' });
    if (res.ok) {
      const { unread } = await res.json();
      const badge = document.getElementById('notifCount');
      if (badge) {
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
      }
    }
  } catch (e) { /* ignore */ }
}

// ── Badge calculator ────────────────────────────
function getUserBadges(user) {
  const badges = [];
  const clips = user.clips || [];
  const totalViews = clips.reduce((s, c) => s + (c.views || 0), 0);
  const totalLikes = clips.reduce((s, c) => s + (c.likes || 0), 0);

  if (user.role === 'admin') badges.push({ icon: 'fa-shield-halved', label: 'Admin', color: 'text-red-400' });
  if (clips.length >= 100) badges.push({ icon: 'fa-gem', label: 'SSL', color: 'text-purple-300' });
  else if (clips.length >= 50) badges.push({ icon: 'fa-crown', label: 'Grand Champion', color: 'text-red-400' });
  else if (clips.length >= 25) badges.push({ icon: 'fa-trophy', label: 'Champion', color: 'text-purple-400' });
  else if (clips.length >= 10) badges.push({ icon: 'fa-medal', label: 'Diamond', color: 'text-cyan-400' });
  else if (clips.length >= 5) badges.push({ icon: 'fa-star', label: 'Gold', color: 'text-yellow-400' });
  else if (clips.length >= 1) badges.push({ icon: 'fa-circle-up', label: 'Bronze', color: 'text-amber-600' });

  if (totalViews >= 10000) badges.push({ icon: 'fa-eye', label: '10K Views', color: 'text-emerald-400' });
  if (totalLikes >= 1000) badges.push({ icon: 'fa-heart', label: '1K Likes', color: 'text-pink-400' });
  if ((user.followers || []).length >= 100) badges.push({ icon: 'fa-users', label: 'Popular', color: 'text-blue-400' });

  return badges;
}

function renderBadges(user) {
  return getUserBadges(user).map(b =>
    `<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full glass ${b.color}" title="${b.label}"><i class="fas ${b.icon}"></i> ${b.label}</span>`
  ).join(' ');
}

// ── Load clips (updated for new API response format) ────
async function loadClips(containerId, endpoint = '/clips', options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = `
    <div class="col-span-full flex justify-center py-16">
      <div class="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
    </div>`;

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    // Support both array (trending) and paginated response
    const clips = Array.isArray(data) ? data : (data.clips || []);
    const total = data.total || clips.length;
    const pages = data.pages || 1;

    if (!clips.length) {
      container.innerHTML = `
        <div class="col-span-full text-center py-16">
          <div class="w-20 h-20 rounded-2xl bg-white/[0.04] mx-auto mb-5 flex items-center justify-center">
            <i class="fas fa-film text-3xl text-white/15"></i>
          </div>
          <p class="text-white/30 font-medium">No clips yet</p>
        </div>`;
      return { clips: [], total: 0, pages: 0 };
    }

    container.innerHTML = clips.map(clip => renderClipCard(clip)).join('');
    return { clips, total, pages };
  } catch (err) {
    console.error('loadClips error:', endpoint, err);
    container.innerHTML = `
      <div class="col-span-full text-center py-16">
        <div class="w-20 h-20 rounded-2xl bg-red-500/[0.06] mx-auto mb-5 flex items-center justify-center">
          <i class="fas fa-exclamation-triangle text-2xl text-red-400/40"></i>
        </div>
        <p class="text-white/30 font-medium">Failed to load clips</p>
        <p class="text-white/20 text-xs mt-2 font-mono">${err.message}</p>
      </div>`;
    return { clips: [], total: 0, pages: 0 };
  }
}

function renderClipCard(clip) {
  const user = clip.user || { _id: '', username: 'Deleted User', avatar: 'https://ui-avatars.com/api/?name=Deleted&background=1a1a2e&color=555' };
  const tagsHtml = (clip.tags || []).slice(0, 2).map(t =>
    `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">${escHtml(t)}</span>`
  ).join('');
  const categoryLabel = clip.category && clip.category !== 'other' ? escHtml(clip.category.replace('-', ' ')) : '';
  const rlRankLabel = clip.rlRank && clip.rlRank !== '' ? escHtml(clip.rlRank.replace('-', ' ')) : '';

  return `
    <div class="glass-card rounded-2xl overflow-hidden group slide-in">
      <a href="watch.html?id=${clip._id}" class="block">
        <div class="relative img-shine aspect-video">
          <img src="${escHtml(clip.thumbnailPath)}" alt="${escHtml(clip.title)}"
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
               loading="lazy">
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>
          <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div class="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <i class="fas fa-play text-white text-lg ml-0.5"></i>
            </div>
          </div>
          <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="glass !bg-black/50 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                <i class="fas fa-eye text-emerald-400" style="font-size:10px"></i> ${clip.views}
              </span>
              <span class="glass !bg-black/50 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                <i class="fas fa-heart text-pink-400" style="font-size:10px"></i> ${clip.likes}
              </span>
            </div>
            <span class="glass !bg-black/50 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
              <i class="fas fa-comment text-indigo-400" style="font-size:10px"></i> ${clip.comments?.length || 0}
            </span>
          </div>
          ${clip.featured ? '<div class="absolute top-2 right-2 badge !bg-yellow-500/20 !text-yellow-300 !border-yellow-500/30 text-[10px]"><i class="fas fa-star mr-1"></i>Featured</div>' : ''}
          ${categoryLabel ? `<div class="absolute top-2 left-2 badge !bg-purple-500/20 !text-purple-300 !border-purple-500/30 text-[10px]">${categoryLabel}</div>` : ''}
          ${rlRankLabel ? `<div class="absolute top-2 ${clip.featured ? 'right-24' : 'right-2'} badge !bg-cyan-500/20 !text-cyan-300 !border-cyan-500/30 text-[10px]">${rlRankLabel}</div>` : ''}
        </div>
      </a>
      <div class="p-4">
        <div class="flex items-start gap-3">
          <a href="profile.html?id=${user._id || ''}" class="flex-shrink-0">
            <img src="${user.avatar}" class="w-9 h-9 rounded-full ring-1 ring-white/10" loading="lazy">
          </a>
          <div class="min-w-0 flex-1">
            <a href="watch.html?id=${clip._id}" class="font-semibold text-sm line-clamp-2 hover:text-indigo-300 transition-colors leading-snug">${escHtml(clip.title)}</a>
            <a href="profile.html?id=${user._id || ''}" class="text-xs text-white/40 hover:text-white/60 transition-colors mt-1 block">${escHtml(user.username)}</a>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs text-white/20">${new Date(clip.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              ${tagsHtml ? '<span class="text-white/10">·</span>' + tagsHtml : ''}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Search ──────────────────────────────────────
async function searchClips(query) {
  window.location.href = `search.html?q=${encodeURIComponent(query)}`;
}

// ── Infinite scroll helper ──────────────────────
function initInfiniteScroll(containerId, baseEndpoint, options = {}) {
  let currentPage = 1;
  let loading = false;
  let allLoaded = false;

  const sentinel = document.createElement('div');
  sentinel.className = 'col-span-full flex justify-center py-8';
  sentinel.id = containerId + '-sentinel';

  const container = document.getElementById(containerId);
  if (!container) return;

  async function loadMore() {
    if (loading || allLoaded) return;
    loading = true;
    sentinel.innerHTML = '<div class="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>';

    try {
      const sep = baseEndpoint.includes('?') ? '&' : '?';
      const res = await fetch(`${API_BASE}${baseEndpoint}${sep}page=${currentPage}`);
      const data = await res.json();
      const clips = Array.isArray(data) ? data : (data.clips || []);

      if (clips.length === 0) {
        allLoaded = true;
        sentinel.innerHTML = '<p class="text-white/20 text-sm">No more clips</p>';
        return;
      }

      clips.forEach(clip => {
        container.insertBefore(createClipElement(clip), sentinel);
      });

      currentPage++;
      if (data.pages && currentPage > data.pages) allLoaded = true;
    } catch (e) {
      sentinel.innerHTML = '<p class="text-white/30 text-sm">Error loading more</p>';
    } finally {
      loading = false;
      if (!allLoaded) sentinel.innerHTML = '';
    }
  }

  container.appendChild(sentinel);

  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadMore();
  }, { rootMargin: '200px' });
  observer.observe(sentinel);

  // Load first page
  loadMore();
}

function createClipElement(clip) {
  const div = document.createElement('div');
  div.innerHTML = renderClipCard(clip);
  return div.firstElementChild;
}

// ── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavbar();
  checkAuth();

  if (document.getElementById('newestClips')) loadClips('newestClips', '/clips');
  if (document.getElementById('trendingClips')) loadClips('trendingClips', '/clips/trending');

  // Only add search handler if search.html's inline handler isn't already present
  const searchInput = document.getElementById('searchInput');
  if (searchInput && !document.querySelector('[data-search-bound]')) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchClips(searchInput.value);
    });
  }

  // Theme toggle
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Random clip button
  const randomBtn = document.getElementById('randomClipBtn');
  if (randomBtn) {
    randomBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`${API_BASE}/clips/random`);
        const clip = await res.json();
        if (clip && clip._id) window.location.href = `watch.html?id=${clip._id}`;
      } catch (e) { /* ignore */ }
    });
  }
});

// ── Bookmark helper ─────────────────────────────
async function toggleBookmark(clipId, btn) {
  try {
    const res = await fetch(`${API_BASE}/clips/${clipId}/bookmark`, {
      method: 'POST',
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      if (btn) {
        btn.innerHTML = data.bookmarked
          ? '<i class="fas fa-bookmark text-yellow-400"></i>'
          : '<i class="far fa-bookmark"></i>';
      }
      return data.bookmarked;
    } else {
      alert('Login required to bookmark');
    }
  } catch (e) {
    alert('Login required to bookmark');
  }
  return false;
}

