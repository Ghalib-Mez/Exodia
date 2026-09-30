'use strict';

const fs = require('fs');
const { Client } = require('minecraft-launcher-core');
const { DEFAULT_MANIFEST_URL } = require('./config');
const { loadManifest } = require('./manifest');
const { ensureJava } = require('./java');
const { ensureForge } = require('./forge');
const { syncMods } = require('./mods');
const { writeServersDat } = require('./serversDat');

/**
 * Full launch pipeline: manifest → auth → java → forge → mods → servers.dat → game.
 * All progress is reported through `report(event)` (wired to the renderer over IPC).
 * Resolves with { proc } when the game process has started; rejects on any failure.
 */
async function launchGame({ paths, settings, authManager, report }) {
  // 1. Manifest
  report({ stage: 'manifest', message: 'Fetching server manifest…' });
  const manifest = await loadManifest(settings.get('manifestUrl') || DEFAULT_MANIFEST_URL);

  // 2. Auth
  report({ stage: 'auth', message: 'Checking Microsoft session…' });
  const profile = await authManager.restore();
  if (!profile) {
    const err = new Error('LOGIN_REQUIRED');
    err.code = 'LOGIN_REQUIRED';
    throw err;
  }
  if (profile.demo) {
    throw new Error('This Microsoft account does not own Minecraft.');
  }

  // 3. Java 8
  const javaPath = await ensureJava(paths, report);

  // 4. Forge installer
  const forgePath = await ensureForge(paths, report);

  // 5. Mods delta-sync
  report({ stage: 'mods', message: 'Syncing mods…' });
  await syncMods(paths, manifest, report);

  // 6. servers.dat so the server is pinned in the multiplayer list
  report({ stage: 'servers', message: 'Preparing server entry…' });
  writeServersDat(paths.instanceDir, manifest.server);

  // 7. Launch with MCLC
  report({ stage: 'launching', message: 'Launching Minecraft…' });
  fs.mkdirSync(paths.instanceDir, { recursive: true });

  const launcher = new Client();
  const forward = (event, mapper) =>
    launcher.on(event, (e) => {
      try { report(mapper(e)); } catch { /* never let UI errors kill the game */ }
    });

  forward('progress', (e) => ({
    stage: 'game-files',
    message: `Downloading ${e.type}… (${e.task}/${e.total})`,
    percent: e.total ? Math.round((e.task / e.total) * 100) : undefined,
  }));
  forward('download-status', (e) => ({
    stage: 'game-files',
    message: `Downloading ${e.name || e.type || 'files'}…`,
    percent: e.total ? Math.round((e.current / e.total) * 100) : undefined,
  }));
  forward('data', (line) => ({ stage: 'game-log', log: String(line).trimEnd() }));
  forward('debug', (line) => ({ stage: 'game-log', debug: String(line).trimEnd() }));

  const opts = {
    authorization: authManager.mclcAuthorization(),
    root: paths.mcRoot,
    version: { number: manifest.modpack.minecraft, type: 'release' },
    forge: forgePath,
    memory: {
      min: settings.get('memoryMin') || '2G',
      max: settings.get('memoryMax') || '4G',
    },
    javaPath,
    overrides: {
      gameDirectory: paths.instanceDir,
      cwd: paths.instanceDir,
      detached: false,
      maxSockets: 4,
    },
    window: { width: 1280, height: 720 },
  };

  const proc = await launcher.launch(opts);
  report({ stage: 'running', message: 'Minecraft is running', profile });
  return { proc, manifest, profile };
}

module.exports = { launchGame };
