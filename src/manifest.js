'use strict';

const { fetchText } = require('./util/download');

/**
 * Load and validate the distribution manifest (launcher.json).
 * Schema documented in docs/DISTRIBUTION.md.
 */
async function loadManifest(url) {
  const raw = await fetchText(url);
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Manifest is not valid JSON (${url}): ${e.message}`);
  }
  return validateManifest(json);
}

/** Throws with a helpful message on any schema violation. Returns the manifest unchanged. */
function validateManifest(m) {
  const err = (msg) => { throw new Error(`Invalid launcher.json: ${msg}`); };

  if (!m || typeof m !== 'object') err('root must be an object');
  if (m.schemaVersion !== 1) err(`unsupported schemaVersion ${m.schemaVersion} (expected 1)`);

  if (!m.server || typeof m.server !== 'object') err('missing "server" object');
  requireStr(m.server, 'name', err);
  requireStr(m.server, 'address', err);
  if (m.server.port != null && !Number.isInteger(m.server.port)) err('server.port must be an integer');
  requireHttps(m.server.discord, 'server.discord', err);
  requireHttps(m.server.website, 'server.website', err);
  requireHttps(m.launcher && m.launcher.newsUrl, 'launcher.newsUrl', err);
  requireHttps(m.launcher && m.launcher.background, 'launcher.background', err);
  requireHttps(m.launcher && m.launcher.heroImage, 'launcher.heroImage', err);

  if (m.news != null) {
    if (!Array.isArray(m.news)) err('"news" must be an array');
    for (const n of m.news) {
      requireStr(n, 'title', err, 'news[].title');
      requireStr(n, 'body', err, 'news[].body');
      requireHttps(n.image, 'news[].image', err);
      requireHttps(n.url, 'news[].url', err);
      if (n.date != null && typeof n.date !== 'string') err('news[].date must be a string');
    }
  }

  if (!m.modpack || typeof m.modpack !== 'object') err('missing "modpack" object');
  requireStr(m.modpack, 'minecraft', err);
  requireStr(m.modpack, 'forge', err);
  requireStr(m.modpack, 'version', err);
  if (m.modpack.memory != null) {
    const mem = m.modpack.memory;
    if (typeof mem.min !== 'string' || typeof mem.max !== 'string') {
      err('modpack.memory.min/max must be strings like "2G"');
    }
  }

  if (m.mods != null) {
    if (!Array.isArray(m.mods)) err('"mods" must be an array');
    const seen = new Set();
    for (const mod of m.mods) {
      requireStr(mod, 'id', err, 'mods[].id');
      requireStr(mod, 'file', err, 'mods[].file');
      requireStr(mod, 'url', err, 'mods[].url');
      requireStr(mod, 'sha1', err, 'mods[].sha1');
      if (!/^[0-9a-fA-F]{40}$/.test(mod.sha1)) err(`mods[${mod.id}].sha1 must be a 40-char hex SHA-1`);
      if (!Number.isInteger(mod.size) || mod.size <= 0) err(`mods[${mod.id}].size must be a positive integer`);
      requireHttps(mod.url, `mods[${mod.id}].url`, err);
      if (seen.has(mod.file)) err(`duplicate mod file "${mod.file}"`);
      seen.add(mod.file);
    }
  }

  if (m.files != null && !Array.isArray(m.files)) err('"files" must be an array');

  return m;
}

function requireStr(obj, key, err, label) {
  const v = obj[key];
  if (typeof v !== 'string' || !v.trim()) {
    err(`${label || key} must be a non-empty string`);
  }
}

function requireHttps(url, label, err) {
  if (url == null) return;
  if (typeof url !== 'string') err(`${label} must be a string`);
  const isLocalDev = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url);
  if (!url.startsWith('https://') && !isLocalDev) {
    err(`${label} must use https:// (http://localhost allowed for dev testing)`);
  }
}

module.exports = { loadManifest, validateManifest };
