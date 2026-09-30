'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { LAUNCHER_VERSION, DEFAULT_MANIFEST_URL, MC_VERSION, FORGE_VERSION, buildPaths } = require('./src/config');
const { AuthManager } = require('./src/auth');
const { Settings } = require('./src/settings');
const { loadManifest } = require('./src/manifest');
const { pingServer } = require('./src/ping');
const { launchGame } = require('./src/launch');

// Single instance — a launcher should never run twice
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;
let authManager = null;
let settings = null;
let paths = null;
let launching = false;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 1080,
    minHeight: 660,
    frame: false,
    backgroundColor: '#0b0e17',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // The renderer loads local content only — block all navigation/new windows
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

app.whenReady().then(() => {
  paths = buildPaths(app.getPath('userData'));
  settings = new Settings(paths.settingsFile);
  authManager = new AuthManager(paths.tokenFile);
  createWindow();
});

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('window-all-closed', () => app.quit());

/* ------------------------------- IPC: window ------------------------------ */

ipcMain.on('window:minimize', () => win.minimize());
ipcMain.on('window:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on('window:close', () => win.close());

/* ------------------------------ IPC: app info ----------------------------- */

ipcMain.handle('app:info', () => ({
  version: LAUNCHER_VERSION,
  minecraft: MC_VERSION,
  forge: FORGE_VERSION,
  defaultManifestUrl: DEFAULT_MANIFEST_URL,
}));

/* -------------------------------- IPC: auth ------------------------------- */

ipcMain.handle('auth:current', async () => authManager.restore());

ipcMain.handle('auth:login', async () => {
  try {
    return { ok: true, profile: await authManager.login() };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('auth:logout', () => {
  authManager.logout();
  return true;
});

/* ------------------------------ IPC: manifest ----------------------------- */

ipcMain.handle('manifest:get', async () => {
  try {
    const manifest = await loadManifest(settings.get('manifestUrl') || DEFAULT_MANIFEST_URL);
    return {
      ok: true,
      server: manifest.server,
      modpack: manifest.modpack,
      modCount: (manifest.mods || []).length,
      modList: (manifest.mods || []).map((m) => ({
        id: m.id, name: m.name || m.id, file: m.file, size: m.size,
      })),
      background: manifest.launcher ? manifest.launcher.background : null,
      hero: manifest.launcher ? manifest.launcher.heroImage : null,
      newsUrl: manifest.launcher ? manifest.launcher.newsUrl : null,
      news: manifest.news || [],
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

/* ------------------------------ IPC: server ping --------------------------- */

ipcMain.handle('server:ping', (_e, { host, port } = {}) => pingServer(host, port));

/* ----------------------------- IPC: settings ------------------------------ */

ipcMain.handle('settings:get', () => settings.data);

ipcMain.handle('settings:set', (_e, patch) => settings.set(patch || {}));

/* ------------------------------- IPC: launch ------------------------------ */

ipcMain.handle('launch:start', async () => {
  if (launching) return { ok: false, error: 'A launch is already in progress' };
  launching = true;
  const report = (event) => send('launch:event', event);
  try {
    const { proc } = await launchGame({ paths, settings, authManager, report });
    proc.on('close', (code) => {
      launching = false;
      send('launch:event', { stage: 'closed', code });
    });
    return { ok: true };
  } catch (err) {
    launching = false;
    send('launch:event', {
      stage: 'error',
      message: String(err.message || err),
      loginRequired: err.code === 'LOGIN_REQUIRED',
    });
    return { ok: false, error: String(err.message || err) };
  }
});

/* ------------------------------ IPC: links ------------------------------- */

ipcMain.handle('shell:openExternal', (_e, url) => {
  if (typeof url === 'string' && url.startsWith('https://')) {
    shell.openExternal(url);
  }
});
