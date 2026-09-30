'use strict';

const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { USER_AGENT } = require('../config');

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

/**
 * Download a file over HTTP(S), following redirects, hashing content on the fly.
 * @param {string} url
 * @param {string} destPath
 * @param {{ onProgress?: (p:{received:number,total:number}) => void }} [opts]
 * @returns {Promise<{ path: string, sha1: string, size: number }>}
 */
function downloadFile(url, destPath, opts = {}) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    const hash = crypto.createHash('sha1');
    let received = 0;
    let total = 0;

    const fail = (err) => {
      file.destroy();
      fs.unlink(destPath, () => {});
      reject(err);
    };

    const request = (target, redirectsLeft) => {
      if (redirectsLeft < 0) return fail(new Error(`Too many redirects fetching ${url}`));
      const mod = target.startsWith('https:') ? https : http;
      const req = mod.get(target, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
        if (REDIRECT_CODES.has(res.statusCode) && res.headers.location) {
          res.resume();
          return request(new URL(res.headers.location, target).toString(), redirectsLeft - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return fail(new Error(`HTTP ${res.statusCode} for ${target}`));
        }
        total = parseInt(res.headers['content-length'] || '0', 10);
        res.on('data', (chunk) => {
          received += chunk.length;
          hash.update(chunk);
          if (opts.onProgress) {
            try { opts.onProgress({ received, total }); } catch { /* UI only */ }
          }
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close(() =>
            resolve({ path: destPath, sha1: hash.digest('hex'), size: received })
          );
        });
      });
      req.on('error', fail);
      req.setTimeout(30000, () => req.destroy(new Error(`Timeout fetching ${target}`)));
    };

    request(url, 8);
  });
}

/** Fetch a URL as a UTF-8 string (follows redirects). */
function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = (target, redirectsLeft) => {
      if (redirectsLeft < 0) return reject(new Error(`Too many redirects fetching ${url}`));
      const mod = target.startsWith('https:') ? https : http;
      const req = mod.get(target, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
        if (REDIRECT_CODES.has(res.statusCode) && res.headers.location) {
          res.resume();
          return request(new URL(res.headers.location, target).toString(), redirectsLeft - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${target}`));
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve(body));
      });
      req.on('error', reject);
      req.setTimeout(30000, () => req.destroy(new Error(`Timeout fetching ${target}`)));
    };
    request(url, 8);
  });
}

/** SHA-1 of a file on disk. */
function sha1File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    fs.createReadStream(filePath)
      .on('data', (c) => hash.update(c))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

module.exports = { downloadFile, fetchText, sha1File };
