'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const extract = require('extract-zip');
const { ADOPTIUM_JRE8_URL } = require('./config');
const { downloadFile } = require('./util/download');

/**
 * Resolve a usable Java 8 runtime for Forge 1.16.5.
 * Order: previously-downloaded Temurin JRE -> system Java 8 -> download Temurin 8.
 * @returns {Promise<string>} path to javaw.exe / java binary
 */
async function ensureJava(paths, report) {
  report({ stage: 'java', message: 'Looking for Java 8…' });

  const bundled = await findBundledJava(paths.javaDir);
  if (bundled) return bundled;

  const system = await findSystemJava8();
  if (system) {
    report({ stage: 'java', message: 'Using system Java 8' });
    return system;
  }

  report({ stage: 'java', message: 'Downloading Java 8 (Temurin JRE, ~40 MB)…' });
  const zipPath = path.join(paths.cacheDir, 'temurin-jre8-win-x64.zip');
  await downloadFile(ADOPTIUM_JRE8_URL, zipPath, {
    onProgress: ({ received, total }) => {
      if (total) {
        report({
          stage: 'java',
          message: 'Downloading Java 8…',
          percent: Math.round((received / total) * 100),
        });
      }
    },
  });

  report({ stage: 'java', message: 'Extracting Java 8…' });
  await extract(zipPath, { dir: paths.javaDir });
  fs.rmSync(zipPath, { force: true });

  const found = await findBundledJava(paths.javaDir);
  if (!found) throw new Error('Java download succeeded but javaw.exe was not found after extraction');
  return found;
}

/** Scan the java dir for a bundled javaw (Temurin zips extract to a versioned folder). */
async function findBundledJava(javaDir) {
  const candidates = [];
  try {
    for (const entry of fs.readdirSync(javaDir)) {
      for (const exe of ['javaw.exe', 'java.exe', 'java']) {
        candidates.push(path.join(javaDir, entry, 'bin', exe));
      }
    }
  } catch {
    return null;
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && (await isJava8(candidate))) return candidate;
  }
  return null;
}

/** Look for a system javaw/java that reports version 1.8.x. */
async function findSystemJava8() {
  for (const exe of ['javaw', 'java']) {
    const resolved = await resolveOnPath(exe);
    if (resolved && (await isJava8(resolved))) return resolved;
  }
  return null;
}

function resolveOnPath(exe) {
  return new Promise((resolve) => {
    const which = process.platform === 'win32' ? 'where' : 'which';
    execFile(which, [exe], (err, stdout) => {
      if (err || !stdout.trim()) return resolve(null);
      const first = stdout.split(/\r?\n/)[0].trim();
      resolve(first || null);
    });
  });
}

function isJava8(javaPath) {
  return new Promise((resolve) => {
    execFile(javaPath, ['-version'], (err, _stdout, stderr) => {
      if (err && !stderr) return resolve(false);
      const out = String(stderr || '');
      resolve(/version "1\.8\./.test(out));
    });
  });
}

module.exports = { ensureJava };
