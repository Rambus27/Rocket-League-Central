// ── Settings Panel ──────────────────────────────
(function () {
  'use strict';

  const DEFAULTS = {
    theme: 'dark',
    accent: 'indigo',
    fontSize: 'default',
    fontFamily: 'inter',
    cardStyle: 'glass',
    hoverEffect: 'lift',
    animations: 'on',
    borderRadius: 'default',
    bgEffects: 'orbs',
    navbarStyle: 'floating',
    contentWidth: 'default',
    blurIntensity: 'default',
    gridDensity: 'default',
    scrollbarStyle: 'accent'
  };

  const ACCENT_COLORS = {
    indigo:  { primary: '99,102,241',  name: 'Indigo' },
    purple:  { primary: '168,85,247',  name: 'Purple' },
    cyan:    { primary: '34,211,238',  name: 'Cyan' },
    pink:    { primary: '236,72,153',  name: 'Pink' },
    orange:  { primary: '249,115,22',  name: 'Orange' },
    red:     { primary: '239,68,68',   name: 'Red' },
    green:   { primary: '34,197,94',   name: 'Green' },
    amber:   { primary: '245,158,11',  name: 'Amber' },
    blue:    { primary: '59,130,246',  name: 'Blue' },
    rose:    { primary: '244,63,94',   name: 'Rose' }
  };

  function getSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem('rlc_settings') || '{}');
      return Object.assign({}, DEFAULTS, stored);
    } catch {
      return Object.assign({}, DEFAULTS);
    }
  }

  let _syncTimer = null;

  function saveSettings(settings) {
    localStorage.setItem('rlc_settings', JSON.stringify(settings));
    // Debounce server sync to avoid spamming on rapid changes
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => syncToServer(settings), 500);
  }

  async function syncToServer(settings) {
    try {
      await fetch('/api/users/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings)
      });
    } catch { /* not logged in or network error — localStorage is still the fallback */ }
  }

  async function loadFromServer() {
    try {
      const res = await fetch('/api/users/settings', { credentials: 'include' });
      if (res.ok) {
        const server = await res.json();
        if (server && Object.keys(server).length > 0) {
          const merged = Object.assign({}, DEFAULTS, server);
          localStorage.setItem('rlc_settings', JSON.stringify(merged));
          applySettings(merged);
          // Refresh panel if it's open
          const panel = document.getElementById('settingsPanel');
          if (panel) {
            panel.remove();
            document.getElementById('settingsOverlay')?.remove();
            buildPanel();
          }
        }
      }
    } catch { /* not logged in */ }
  }

  function applySettings(settings) {
    const root = document.documentElement;

    // Theme
    root.setAttribute('data-theme', settings.theme);
    if (typeof updateThemeIcon === 'function') updateThemeIcon(settings.theme);

    // Accent color
    const accent = ACCENT_COLORS[settings.accent] || ACCENT_COLORS.indigo;
    root.style.setProperty('--accent-rgb', accent.primary);
    root.setAttribute('data-accent', settings.accent);

    // Font size
    root.setAttribute('data-fontsize', settings.fontSize);

    // Card style
    root.setAttribute('data-cardstyle', settings.cardStyle);

    // Animations
    root.setAttribute('data-animations', settings.animations);

    // Border radius
    root.setAttribute('data-radius', settings.borderRadius);

    // Background effects
    root.setAttribute('data-bg', settings.bgEffects);

    // Font family
    root.setAttribute('data-font', settings.fontFamily || 'inter');

    // Hover effect
    root.setAttribute('data-hover', settings.hoverEffect || 'lift');

    // Navbar style
    root.setAttribute('data-navbar', settings.navbarStyle || 'floating');

    // Content width
    root.setAttribute('data-width', settings.contentWidth || 'default');

    // Blur intensity
    root.setAttribute('data-blur', settings.blurIntensity || 'default');

    // Grid density
    root.setAttribute('data-grid', settings.gridDensity || 'default');

    // Scrollbar style
    root.setAttribute('data-scrollbar', settings.scrollbarStyle || 'accent');

    // Sync theme toggle in localStorage for app.js compatibility
    localStorage.setItem('theme', settings.theme);
  }

  // ── Build settings panel HTML ──────────────────
  function buildPanel() {
    const settings = getSettings();

    const overlay = document.createElement('div');
    overlay.id = 'settingsOverlay';
    overlay.className = 'settings-overlay';
    overlay.addEventListener('click', closeSettings);

    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.className = 'settings-panel';
    panel.innerHTML = `
      <div class="settings-header">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[rgba(var(--accent-rgb),0.3)] to-[rgba(var(--accent-rgb),0.1)] flex items-center justify-center">
            <i class="fas fa-palette text-sm" style="color: rgba(var(--accent-rgb),1)"></i>
          </div>
          <div>
            <h3 class="text-base font-bold">Appearance</h3>
            <p class="text-xs text-white/40">Customize your experience</p>
          </div>
        </div>
        <button id="settingsClose" class="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
          <i class="fas fa-times text-white/50"></i>
        </button>
      </div>

      <div class="settings-body">

        <!-- Theme -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-circle-half-stroke mr-2 text-white/30"></i>Theme</label>
          <div class="settings-toggle-group" data-setting="theme">
            <button class="settings-toggle-btn ${settings.theme === 'dark' ? 'active' : ''}" data-value="dark">
              <i class="fas fa-moon mr-1.5"></i>Dark
            </button>
            <button class="settings-toggle-btn ${settings.theme === 'light' ? 'active' : ''}" data-value="light">
              <i class="fas fa-sun mr-1.5"></i>Light
            </button>
          </div>
        </div>

        <!-- Accent Color -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-droplet mr-2 text-white/30"></i>Accent Color</label>
          <div class="settings-color-grid" data-setting="accent">
            ${Object.entries(ACCENT_COLORS).map(([key, val]) => `
              <button class="settings-color-swatch ${settings.accent === key ? 'active' : ''}"
                      data-value="${key}" title="${val.name}"
                      style="--swatch-rgb: ${val.primary}">
                <span class="swatch-dot"></span>
                <span class="swatch-label">${val.name}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Font Size -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-text-height mr-2 text-white/30"></i>Font Size</label>
          <div class="settings-toggle-group" data-setting="fontSize">
            <button class="settings-toggle-btn ${settings.fontSize === 'small' ? 'active' : ''}" data-value="small">Small</button>
            <button class="settings-toggle-btn ${settings.fontSize === 'default' ? 'active' : ''}" data-value="default">Default</button>
            <button class="settings-toggle-btn ${settings.fontSize === 'large' ? 'active' : ''}" data-value="large">Large</button>
          </div>
        </div>

        <!-- Card Style -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-layer-group mr-2 text-white/30"></i>Card Style</label>
          <div class="settings-toggle-group" data-setting="cardStyle">
            <button class="settings-toggle-btn ${settings.cardStyle === 'glass' ? 'active' : ''}" data-value="glass">Glass</button>
            <button class="settings-toggle-btn ${settings.cardStyle === 'solid' ? 'active' : ''}" data-value="solid">Solid</button>
            <button class="settings-toggle-btn ${settings.cardStyle === 'minimal' ? 'active' : ''}" data-value="minimal">Minimal</button>
          </div>
        </div>

        <!-- Animations -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-bolt mr-2 text-white/30"></i>Animations</label>
          <div class="settings-toggle-group" data-setting="animations">
            <button class="settings-toggle-btn ${settings.animations === 'on' ? 'active' : ''}" data-value="on">On</button>
            <button class="settings-toggle-btn ${settings.animations === 'reduced' ? 'active' : ''}" data-value="reduced">Reduced</button>
            <button class="settings-toggle-btn ${settings.animations === 'off' ? 'active' : ''}" data-value="off">Off</button>
          </div>
        </div>

        <!-- Border Radius -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-vector-square mr-2 text-white/30"></i>Border Radius</label>
          <div class="settings-toggle-group" data-setting="borderRadius">
            <button class="settings-toggle-btn ${settings.borderRadius === 'sharp' ? 'active' : ''}" data-value="sharp">Sharp</button>
            <button class="settings-toggle-btn ${settings.borderRadius === 'default' ? 'active' : ''}" data-value="default">Default</button>
            <button class="settings-toggle-btn ${settings.borderRadius === 'extra' ? 'active' : ''}" data-value="extra">Rounded</button>
          </div>
        </div>

        <!-- Background Effects -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-wand-magic-sparkles mr-2 text-white/30"></i>Background Effects</label>
          <div class="settings-toggle-group" data-setting="bgEffects">
            <button class="settings-toggle-btn ${settings.bgEffects === 'orbs' ? 'active' : ''}" data-value="orbs">Orbs</button>
            <button class="settings-toggle-btn ${settings.bgEffects === 'none' ? 'active' : ''}" data-value="none">None</button>
          </div>
        </div>

        <div class="settings-divider"></div>
        <div class="settings-section-title">Layout & Typography</div>

        <!-- Font Family -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-font mr-2 text-white/30"></i>Font Family</label>
          <div class="settings-toggle-group" data-setting="fontFamily">
            <button class="settings-toggle-btn ${settings.fontFamily === 'inter' ? 'active' : ''}" data-value="inter">Inter</button>
            <button class="settings-toggle-btn ${settings.fontFamily === 'mono' ? 'active' : ''}" data-value="mono">Mono</button>
            <button class="settings-toggle-btn ${settings.fontFamily === 'serif' ? 'active' : ''}" data-value="serif">Serif</button>
            <button class="settings-toggle-btn ${settings.fontFamily === 'rounded' ? 'active' : ''}" data-value="rounded">Rounded</button>
          </div>
        </div>

        <!-- Content Width -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-arrows-left-right mr-2 text-white/30"></i>Content Width</label>
          <div class="settings-toggle-group" data-setting="contentWidth">
            <button class="settings-toggle-btn ${settings.contentWidth === 'compact' ? 'active' : ''}" data-value="compact">Compact</button>
            <button class="settings-toggle-btn ${settings.contentWidth === 'default' ? 'active' : ''}" data-value="default">Default</button>
            <button class="settings-toggle-btn ${settings.contentWidth === 'wide' ? 'active' : ''}" data-value="wide">Wide</button>
          </div>
        </div>

        <!-- Grid Density -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-grip mr-2 text-white/30"></i>Grid Density</label>
          <div class="settings-toggle-group" data-setting="gridDensity">
            <button class="settings-toggle-btn ${settings.gridDensity === 'spacious' ? 'active' : ''}" data-value="spacious">Spacious</button>
            <button class="settings-toggle-btn ${settings.gridDensity === 'default' ? 'active' : ''}" data-value="default">Default</button>
            <button class="settings-toggle-btn ${settings.gridDensity === 'compact' ? 'active' : ''}" data-value="compact">Compact</button>
          </div>
        </div>

        <div class="settings-divider"></div>
        <div class="settings-section-title">Effects & Polish</div>

        <!-- Card Hover Effect -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-hand-pointer mr-2 text-white/30"></i>Card Hover Effect</label>
          <div class="settings-toggle-group" data-setting="hoverEffect">
            <button class="settings-toggle-btn ${settings.hoverEffect === 'lift' ? 'active' : ''}" data-value="lift">Lift</button>
            <button class="settings-toggle-btn ${settings.hoverEffect === 'glow' ? 'active' : ''}" data-value="glow">Glow</button>
            <button class="settings-toggle-btn ${settings.hoverEffect === 'none' ? 'active' : ''}" data-value="none">None</button>
          </div>
        </div>

        <!-- Blur Intensity -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-droplet mr-2 text-white/30"></i>Blur Intensity</label>
          <div class="settings-toggle-group" data-setting="blurIntensity">
            <button class="settings-toggle-btn ${settings.blurIntensity === 'none' ? 'active' : ''}" data-value="none">None</button>
            <button class="settings-toggle-btn ${settings.blurIntensity === 'light' ? 'active' : ''}" data-value="light">Light</button>
            <button class="settings-toggle-btn ${settings.blurIntensity === 'default' ? 'active' : ''}" data-value="default">Default</button>
            <button class="settings-toggle-btn ${settings.blurIntensity === 'heavy' ? 'active' : ''}" data-value="heavy">Heavy</button>
          </div>
        </div>

        <!-- Navbar Style -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-window-maximize mr-2 text-white/30"></i>Navbar Style</label>
          <div class="settings-toggle-group" data-setting="navbarStyle">
            <button class="settings-toggle-btn ${settings.navbarStyle === 'floating' ? 'active' : ''}" data-value="floating">Floating</button>
            <button class="settings-toggle-btn ${settings.navbarStyle === 'solid' ? 'active' : ''}" data-value="solid">Solid</button>
            <button class="settings-toggle-btn ${settings.navbarStyle === 'minimal' ? 'active' : ''}" data-value="minimal">Minimal</button>
          </div>
        </div>

        <!-- Scrollbar Style -->
        <div class="settings-section">
          <label class="settings-label"><i class="fas fa-bars-staggered mr-2 text-white/30"></i>Scrollbar</label>
          <div class="settings-toggle-group" data-setting="scrollbarStyle">
            <button class="settings-toggle-btn ${settings.scrollbarStyle === 'accent' ? 'active' : ''}" data-value="accent">Accent</button>
            <button class="settings-toggle-btn ${settings.scrollbarStyle === 'thin' ? 'active' : ''}" data-value="thin">Thin</button>
            <button class="settings-toggle-btn ${settings.scrollbarStyle === 'hidden' ? 'active' : ''}" data-value="hidden">Hidden</button>
          </div>
        </div>

      </div>

      <div class="settings-footer">
        <button id="settingsReset" class="btn-secondary !py-2 !px-4 text-xs flex items-center gap-2">
          <i class="fas fa-rotate-left"></i> Reset to Defaults
        </button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Bind events
    panel.querySelector('#settingsClose').addEventListener('click', closeSettings);

    panel.querySelectorAll('.settings-toggle-group').forEach(group => {
      group.querySelectorAll('.settings-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const setting = group.dataset.setting;
          const value = btn.dataset.value;
          group.querySelectorAll('.settings-toggle-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const s = getSettings();
          s[setting] = value;
          saveSettings(s);
          applySettings(s);
        });
      });
    });

    panel.querySelectorAll('.settings-color-grid').forEach(grid => {
      grid.querySelectorAll('.settings-color-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
          const setting = grid.dataset.setting;
          const value = btn.dataset.value;
          grid.querySelectorAll('.settings-color-swatch').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const s = getSettings();
          s[setting] = value;
          saveSettings(s);
          applySettings(s);
        });
      });
    });

    panel.querySelector('#settingsReset').addEventListener('click', () => {
      saveSettings(DEFAULTS);
      applySettings(DEFAULTS);
      // Rebuild panel to reset active states
      closeSettings();
      setTimeout(openSettings, 200);
    });
  }

  // ── Build floating toggle button ───────────────
  function buildFAB() {
    const fab = document.createElement('button');
    fab.id = 'settingsFAB';
    fab.className = 'settings-fab';
    fab.title = 'Appearance Settings';
    fab.innerHTML = '<i class="fas fa-palette"></i>';
    fab.addEventListener('click', toggleSettings);
    document.body.appendChild(fab);
  }

  function openSettings() {
    if (!document.getElementById('settingsPanel')) buildPanel();
    requestAnimationFrame(() => {
      document.getElementById('settingsOverlay').classList.add('open');
      document.getElementById('settingsPanel').classList.add('open');
    });
  }

  function closeSettings() {
    const overlay = document.getElementById('settingsOverlay');
    const panel = document.getElementById('settingsPanel');
    if (overlay) overlay.classList.remove('open');
    if (panel) panel.classList.remove('open');
  }

  function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    if (panel && panel.classList.contains('open')) {
      closeSettings();
    } else {
      openSettings();
    }
  }

  // Expose globally so the navbar themeToggle still works
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
  window.toggleSettings = toggleSettings;

  // ── Init on load ───────────────────────────────
  // Apply settings immediately (before DOMContentLoaded) to avoid flash
  applySettings(getSettings());

  document.addEventListener('DOMContentLoaded', () => {
    buildFAB();
    // Load server-saved settings (if logged in)
    loadFromServer();

    // Intercept existing theme toggle to sync with settings
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      // Remove old onclick
      themeBtn.removeAttribute('onclick');
      // Clone to remove old listeners
      const newBtn = themeBtn.cloneNode(true);
      themeBtn.parentNode.replaceChild(newBtn, themeBtn);
      newBtn.addEventListener('click', () => {
        const s = getSettings();
        s.theme = s.theme === 'dark' ? 'light' : 'dark';
        saveSettings(s);
        applySettings(s);
        // Update panel UI if open
        const group = document.querySelector('.settings-toggle-group[data-setting="theme"]');
        if (group) {
          group.querySelectorAll('.settings-toggle-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.value === s.theme);
          });
        }
      });
    }

    // Keyboard shortcut: press Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSettings();
    });
  });
})();
