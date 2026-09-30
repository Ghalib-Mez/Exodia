'use strict';

const fs = require('fs');

const DEFAULTS = {
  manifestUrl: '', // empty = use src/config.js DEFAULT_MANIFEST_URL
  memoryMin: '2G',
  memoryMax: '4G',
};

class Settings {
  constructor(file) {
    this.file = file;
    this.data = { ...DEFAULTS };
    try {
      Object.assign(this.data, JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch {
      // first run — keep defaults
    }
  }

  get(key) {
    return this.data[key];
  }

  set(patch) {
    Object.assign(this.data, patch);
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
    return this.data;
  }
}

module.exports = { Settings, DEFAULTS };
