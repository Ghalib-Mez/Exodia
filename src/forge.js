'use strict';

const fs = require('fs');
const path = require('path');
const { FORGE_INSTALLER_URL, FORGE_MINECRAFT } = require('./config');
const { downloadFile, fetchText, sha1File } = require('./util/download');

/**
 * Ensure the Forge installer jar for the configured version is in the cache.
 * Integrity-checked against the official .sha1 published on maven.minecraftforge.net.
 * @returns {Promise<string>} path to the installer jar (passed to MCLC's `forge` option)
 */
async function ensureForge(paths, report) {
  const dest = path.join(paths.cacheDir, `forge-${FORGE_MINECRAFT}-installer.jar`);

  let officialSha1 = null;
  try {
    officialSha1 = (await fetchText(`${FORGE_INSTALLER_URL}.sha1`)).trim().split(/\s+/)[0];
  } catch {
    // Server unreachable for the hash file; fall back to "file exists = good enough".
  }

  if (fs.existsSync(dest)) {
    if (!officialSha1 || (await sha1File(dest)) === officialSha1) {
      report({ stage: 'forge', message: 'Forge is up to date' });
      return dest;
    }
    report({ stage: 'forge', message: 'Forge installer is outdated, re-downloading…' });
  }

  report({ stage: 'forge', message: 'Downloading Forge installer…' });
  const result = await downloadFile(FORGE_INSTALLER_URL, dest, {
    onProgress: ({ received, total }) => {
      if (total) {
        report({
          stage: 'forge',
          message: 'Downloading Forge installer…',
          percent: Math.round((received / total) * 100),
        });
      }
    },
  });

  if (officialSha1 && result.sha1 !== officialSha1) {
    fs.rmSync(dest, { force: true });
    throw new Error(
      `Forge installer failed SHA-1 verification (expected ${officialSha1}, got ${result.sha1})`
    );
  }
  return dest;
}

module.exports = { ensureForge };
