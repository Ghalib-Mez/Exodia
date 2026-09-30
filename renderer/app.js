'use strict';

const $ = (id) => document.getElementById(id);

const els = {
  screens: { login: $('screen-login'), main: $('screen-main') },
  overlayProgress: $('overlay-progress'),
  progressTitle: $('progress-title'),
  progressMessage: $('progress-message'),
  barFill: $('bar-fill'),
  stages: $('stages'),
  gameLog: $('game-log'),
  btnLogin: $('btn-login'),
  loginError: $('login-error'),
  loginChips: $('login-server-chips'),
  serverName: $('server-name'),
  serverMeta: $('server-meta'),
  packVersion: $('pack-version'),
  userChip: $('user-chip'),
  userAvatar: $('user-avatar'),
  userName: $('user-name'),
  btnLogout: $('btn-logout'),
  btnPlay: $('btn-play'),
  launchStatus: $('launch-status'),
  btnDiscord: $('btn-discord'),
  btnSettings: $('btn-settings'),
  drawer: $('drawer-settings'),
  ram: $('ram'),
  ramLabel: $('ram-label'),
  manifestUrl: $('manifest-url'),
  btnSettingsSave: $('btn-settings-save'),
  btnSettingsClose: $('btn-settings-close'),
  toast: $('toast'),
  heroBg: $('hero-bg'),
  newsRow: $('news-row'),
  serverDot: $('server-dot'),
  serverState: $('server-state'),
  pingValue: $('ping-value'),
  playersValue: $('players-value'),
  serverAddress: $('server-address'),
  navHome: $('nav-home'),
  navMods: $('nav-mods'),
  overlayMods: $('overlay-mods'),
  modsList: $('mods-list'),
  modsTitle: $('mods-title'),
  modsClose: $('mods-close'),
};

const state = {
  manifest: null,
  profile: null,
  appInfo: null,
  playDisabled: false,
  modList: null,
};

/* ------------------------------ helpers ------------------------------ */

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function showScreen(name) {
  Object.values(els.screens).forEach(hide);
  show(els.screens[name]);
}

let toastTimer = null;
function toast(msg, ms = 6000) {
  els.toast.textContent = msg;
  show(els.toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hide(els.toast), ms);
}

function chip(label, value) {
  return `<span class="chip">${label} <b>${escapeHtml(value)}</b></span>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/* --------------------------- background cycle -------------------------- */
/* Crossfade + Ken Burns are handled purely in CSS (staggered negative
 * animation delays). bgLayers stays so the manifest can brand the first. */
const bgLayers = document.querySelectorAll('.bg-layer');

/* ------------------------------ titlebar ------------------------------ */

$('tb-min').addEventListener('click', () => window.launcher.minimize());
$('tb-max').addEventListener('click', () => window.launcher.maximize());
$('tb-close').addEventListener('click', () => window.launcher.close());

/* ------------------------------- boot -------------------------------- */

async function boot() {
  state.appInfo = await window.launcher.getAppInfo();

  // settings → UI
  const settings = await window.launcher.getSettings();
  const ramMax = parseInt(settings.memoryMax, 10) || 4;
  els.ram.value = ramMax;
  els.ramLabel.textContent = `${ramMax} GB`;
  els.manifestUrl.value = settings.manifestUrl || '';

  // manifest → server branding
  const manifest = await window.launcher.getManifest();
  state.manifest = manifest;
  if (manifest.ok) renderManifest(manifest);
  else toast(`Could not load server manifest: ${manifest.error}`);

  // session → screen
  state.profile = await window.launcher.getCurrentUser();
  if (state.profile) {
    renderUser(state.profile);
    showScreen('main');
  } else {
    showScreen('login');
  }
}

function renderManifest(m) {
  const chips = [
    chip('MC', m.modpack.minecraft),
    chip('Forge', m.modpack.forge),
    chip('Mods', m.modCount),
  ];
  els.loginChips.innerHTML = chips.join('');
  els.serverMeta.innerHTML = chips.join('');
  els.serverName.textContent = m.server.name;
  els.serverAddress.textContent =
    m.server.port && m.server.port !== 25565
      ? `${m.server.address}:${m.server.port}`
      : m.server.address;
  els.packVersion.textContent =
    `${m.modpack.displayName || m.server.name} · pack v${m.modpack.version}`;
  if (m.server.discord) {
    show(els.btnDiscord);
    els.btnDiscord.onclick = () => window.launcher.openExternal(m.server.discord);
  }
  // Manifest can override the first background with a server-branded image
  if (m.background && bgLayers.length) {
    bgLayers[0].style.backgroundImage = `url('${m.background.replace(/'/g, '%27')}')`;
  }
  // Hero keyart behind the PLAY button (falls back to the built-in image)
  if (m.hero) {
    els.heroBg.style.backgroundImage = `url('${String(m.hero).replace(/'/g, '%27')}')`;
  }
  renderNews(m.news || []);
  state.modList = m.modList || null;
  refreshServerStatus();
}

function renderUser(profile) {
  els.userName.textContent = profile.name;
  els.userAvatar.textContent = (profile.name || '?').charAt(0).toUpperCase();
}

/* ----------------------- news / mods / server status ---------------------- */

function renderNews(items) {
  if (!items.length) {
    els.newsRow.innerHTML =
      '<div class="news-empty">No news yet — add a "news" array to launcher.json.</div>';
    return;
  }
  els.newsRow.innerHTML = items.map((n) => `
    <article class="news-card${n.url ? ' clickable' : ''}"${n.url ? ` data-url="${escapeHtml(n.url)}"` : ''}>
      ${n.image ? `<div class="news-thumb" style="background-image:url('${escapeHtml(n.image).replace(/'/g, '%27')}')"></div>` : ''}
      <div class="news-body">
        <h4>${escapeHtml(n.title)}</h4>
        <p>${escapeHtml(n.body)}</p>
        ${n.date ? `<span class="news-date">${escapeHtml(n.date)}</span>` : ''}
      </div>
    </article>`).join('');
  els.newsRow.querySelectorAll('.news-card[data-url]').forEach((card) => {
    card.addEventListener('click', () => window.launcher.openExternal(card.dataset.url));
  });
}

function renderMods() {
  const list = state.modList;
  if (!list || !list.length) {
    els.modsList.innerHTML = '<div class="news-empty">Manifest lists no mods.</div>';
    els.modsTitle.textContent = 'Mods';
    return;
  }
  els.modsTitle.textContent = `Mods (${list.length})`;
  els.modsList.innerHTML = list.map((mod) => `
    <div class="mod-item">
      <div>
        <div class="mod-name">${escapeHtml(mod.name)}</div>
        <div class="mod-file">${escapeHtml(mod.file)}</div>
      </div>
      <span class="mod-size">${mod.size ? `${(mod.size / 1048576).toFixed(1)} MB` : ''}</span>
    </div>`).join('');
}

async function refreshServerStatus() {
  const m = state.manifest;
  if (!m || !m.ok || !m.server) return;
  let r = null;
  try {
    r = await window.launcher.pingServer(m.server.address, m.server.port);
  } catch { /* fall through to offline */ }
  if (r && r.online) {
    els.serverDot.className = 'dot on';
    els.serverState.textContent = 'Server online';
    els.pingValue.textContent = r.latencyMs != null ? `${r.latencyMs} ms` : '—';
    els.playersValue.textContent = r.players
      ? `${r.players.online} / ${r.players.max}` : '—';
  } else {
    els.serverDot.className = 'dot off';
    els.serverState.textContent = 'Server offline';
    els.pingValue.textContent = '—';
    els.playersValue.textContent = '—';
  }
}
setInterval(refreshServerStatus, 30000);

/* --------------------------- sidebar navigation -------------------------- */

function setActiveNav(btn) {
  els.navHome.classList.toggle('active', btn === els.navHome);
  els.navMods.classList.toggle('active', btn === els.navMods);
}
els.navHome.addEventListener('click', () => {
  hide(els.overlayMods);
  setActiveNav(els.navHome);
});
els.navMods.addEventListener('click', () => {
  renderMods();
  show(els.overlayMods);
  setActiveNav(els.navMods);
});
els.modsClose.addEventListener('click', () => {
  hide(els.overlayMods);
  setActiveNav(els.navHome);
});

/* ------------------------------- auth --------------------------------- */

els.btnLogin.addEventListener('click', async () => {
  hide(els.loginError);
  els.btnLogin.disabled = true;
  els.btnLogin.textContent = 'Waiting for browser…';
  try {
    const res = await window.launcher.login();
    if (res.ok) {
      state.profile = res.profile;
      renderUser(res.profile);
      showScreen('main');
    } else {
      els.loginError.textContent = res.error;
      show(els.loginError);
    }
  } finally {
    els.btnLogin.disabled = false;
    els.btnLogin.textContent = 'Sign in with Microsoft';
  }
});

els.btnLogout.addEventListener('click', async () => {
  await window.launcher.logout();
  state.profile = null;
  showScreen('login');
});

/* ------------------------------ launch -------------------------------- */

const STAGE_ORDER = ['manifest', 'java', 'forge', 'mods', 'servers', 'game-files', 'launching'];

function setStage(activeStage) {
  const idx = STAGE_ORDER.indexOf(activeStage);
  els.stages.querySelectorAll('.stage').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
    el.classList.toggle('done', idx === -1 ? false : i < idx);
  });
}

function setProgress(message, percent) {
  els.progressMessage.textContent = message || '';
  els.barFill.style.width = `${Math.max(0, Math.min(100, percent || 0))}%`;
}

els.btnPlay.addEventListener('click', async () => {
  if (!state.profile) return;
  state.playDisabled = true;
  els.btnPlay.disabled = true;
  els.launchStatus.textContent = 'Launching…';

  hide(els.gameLog);
  els.progressTitle.textContent = 'Preparing to launch';
  setStage('');
  setProgress('Starting…', 0);
  show(els.overlayProgress);

  window.launcher.startLaunch();
});

window.launcher.onLaunchEvent((event) => {
  if (event.stage === 'error') {
    hide(els.overlayProgress);
    els.btnPlay.disabled = false;
    state.playDisabled = false;
    els.launchStatus.textContent = 'Ready';
    if (event.loginRequired) {
      showScreen('login');
      toast('Please sign in to play.');
    } else {
      toast(event.message || 'Launch failed');
    }
    return;
  }

  if (event.stage === 'closed') {
    hide(els.overlayProgress);
    els.btnPlay.disabled = false;
    state.playDisabled = false;
    els.launchStatus.textContent = 'Ready';
    if (event.code !== 0) toast(`Minecraft exited with code ${event.code}`);
    return;
  }

  if (event.stage === 'running') {
    els.progressTitle.textContent = 'In game';
    setStage('launching');
    setProgress('Minecraft is running — the launcher can be closed safely.', 100);
    return;
  }

  if (event.stage === 'game-log') {
    const line = event.log || event.debug || '';
    if (line) {
      show(els.gameLog);
      els.gameLog.textContent += line + '\n';
      els.gameLog.scrollTop = els.gameLog.scrollHeight;
    }
    return;
  }

  // normal progress events (manifest/java/forge/mods/servers/game-files/launching)
  if (STAGE_ORDER.includes(event.stage)) setStage(event.stage);
  setProgress(event.message, event.percent);
  if (event.warning) toast(event.message);
});

/* ------------------------------ settings ------------------------------ */

els.btnSettings.addEventListener('click', () => show(els.drawer));
els.btnSettingsClose.addEventListener('click', () => hide(els.drawer));

els.ram.addEventListener('input', () => {
  els.ramLabel.textContent = `${els.ram.value} GB`;
});

els.btnSettingsSave.addEventListener('click', async () => {
  await window.launcher.saveSettings({
    memoryMax: `${els.ram.value}G`,
    memoryMin: `${Math.max(1, Math.floor(els.ram.value / 2))}G`,
    manifestUrl: els.manifestUrl.value.trim(),
  });
  toast('Settings saved');
  hide(els.drawer);
  const manifest = await window.launcher.getManifest();
  state.manifest = manifest;
  if (manifest.ok) renderManifest(manifest);
});

boot();
