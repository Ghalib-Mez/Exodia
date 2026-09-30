'use strict';

const fs = require('fs');
const path = require('path');
const { downloadFile, sha1File } = require('./util/download');

/**
 * Delta-sync the instance mods folder against manifest.mods[]:
 *  - downloads mods that are missing or whose SHA-1 differs
 *  - deletes local jars that are not in the manifest
 *  - verifies every download against manifest sha1 + size before accepting it
 */
async function syncMods(paths, manifest, report) {
  fs.mkdirSync(paths.modsDir, { recursive: true });

  const wanted = new Map((manifest.mods || []).map((m) => [m.file, m]));

  // Remove stale jars no longer in the manifest
  for (const entry of fs.readdirSync(paths.modsDir)) {
    if (!entry.toLowerCase().endsWith('.jar')) continue;
    if (!wanted.has(entry)) {
      fs.rmSync(path.join(paths.modsDir, entry), { force: true });
      report({ stage: 'mods', message: `Removed outdated mod: ${entry}` });
    }
  }

  let done = 0;
  const total = wanted.size;
  const failed = [];

  for (const [file, mod] of wanted) {
    done += 1;
    const dest = path.join(paths.modsDir, file);
    const base = `(${done}/${total})`;

    if (fs.existsSync(dest) && (await sha1File(dest)) === mod.sha1.toLowerCase()) {
      report({ stage: 'mods', message: `${base} ${mod.name || file}: up to date`, percent: pct(done, total) });
      continue;
    }

    report({ stage: 'mods', message: `${base} Downloading ${mod.name || file}…`, percent: pct(done - 1, total) });

    // Download to temp, verify, then move into place so a failed download never corrupts the folder
    const tmp = dest + '.download';
    try {
      const result = await downloadFile(mod.url, tmp, {
        onProgress: ({ received, total: size }) => {
          if (size) {
            report({
              stage: 'mods',
              message: `${base} Downloading ${mod.name || file}…`,
              percent: pct(done - 1, total) + (received / size) * (1 / total),
            });
          }
        },
      });
      if (mod.size && result.size !== mod.size) {
        throw new Error(`size mismatch (expected ${mod.size}, got ${result.size})`);
      }
      if (result.sha1 !== mod.sha1.toLowerCase()) {
        throw new Error(`SHA-1 mismatch (expected ${mod.sha1}, got ${result.sha1})`);
      }
      fs.renameSync(tmp, dest);
    } catch (err) {
      fs.rmSync(tmp, { force: true });
      const msg = `Mod "${mod.name || file}" failed: ${err.message}`;
      if (mod.required === false) {
        failed.push(msg + ' (optional — skipping)');
        continue;
      }
      throw new Error(msg);
    }
  }

  for (const warning of failed) report({ stage: 'mods', message: warning, warning: true });
}

function pct(done, total) {
  return total ? Math.round((done / total) * 100) : 100;
}

module.exports = { syncMods };
