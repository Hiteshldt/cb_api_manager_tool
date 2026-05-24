'use strict';
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class FileStore {
  constructor() {
    this.configDir = null;
    this._writeQueue = Promise.resolve();
  }

  init(configDir) {
    this.configDir = configDir;
    this._ensureDirs();
  }

  _ensureDirs() {
    const dirs = [
      this.configDir,
      path.join(this.configDir, 'latest-raw'),
      path.join(this.configDir, 'latest-transformed'),
      path.join(this.configDir, 'logs'),
    ];
    for (const d of dirs) {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
        logger.info(`Created directory: ${d}`);
      }
    }
    for (const file of ['sources.json', 'transformations.json', 'endpoints.json']) {
      const fp = path.join(this.configDir, file);
      if (!fs.existsSync(fp)) {
        fs.writeFileSync(fp, '[]', 'utf8');
        logger.info(`Created file: ${fp}`);
      }
    }
  }

  _readJSON(filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      logger.error(`Read error: ${filePath}`, { error: e.message });
      return null;
    }
  }

  /** Atomic write via tmp file */
  _writeJSON(filePath, data) {
    this._writeQueue = this._writeQueue.then(() =>
      new Promise((resolve) => {
        try {
          const tmp = filePath + '.tmp';
          fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
          fs.renameSync(tmp, filePath);
        } catch (e) {
          logger.error(`Write error: ${filePath}`, { error: e.message });
        }
        resolve();
      })
    );
    return this._writeQueue;
  }

  // ── Sources ─────────────────────────────────────────────
  getSources()              { return this._readJSON(path.join(this.configDir, 'sources.json')) || []; }
  saveSources(data)         { return this._writeJSON(path.join(this.configDir, 'sources.json'), data); }

  // ── Transformations ──────────────────────────────────────
  getTransformations()      { return this._readJSON(path.join(this.configDir, 'transformations.json')) || []; }
  saveTransformations(data) { return this._writeJSON(path.join(this.configDir, 'transformations.json'), data); }

  // ── Endpoints ────────────────────────────────────────────
  getEndpoints()            { return this._readJSON(path.join(this.configDir, 'endpoints.json')) || []; }
  saveEndpoints(data)       { return this._writeJSON(path.join(this.configDir, 'endpoints.json'), data); }

  // ── Raw data ─────────────────────────────────────────────
  getRawData(sourceId) {
    const fp = path.join(this.configDir, 'latest-raw', `${sourceId}.json`);
    return fs.existsSync(fp) ? this._readJSON(fp) : null;
  }
  saveRawData(sourceId, data) {
    return this._writeJSON(
      path.join(this.configDir, 'latest-raw', `${sourceId}.json`),
      { receivedAt: new Date().toISOString(), data }
    );
  }

  // ── Transformed data ─────────────────────────────────────
  getTransformedData(endpointId) {
    const fp = path.join(this.configDir, 'latest-transformed', `${endpointId}.json`);
    return fs.existsSync(fp) ? this._readJSON(fp) : null;
  }
  saveTransformedData(endpointId, data) {
    return this._writeJSON(
      path.join(this.configDir, 'latest-transformed', `${endpointId}.json`),
      { transformedAt: new Date().toISOString(), data }
    );
  }

  // ── Logs ─────────────────────────────────────────────────
  getRecentLogs(type = 'app', lines = 150) {
    const name = type === 'errors' ? 'errors.log' : 'app.log';
    const fp   = path.join(this.configDir, 'logs', name);
    if (!fs.existsSync(fp)) return [];
    try {
      return fs.readFileSync(fp, 'utf8').trim().split('\n').filter(Boolean).slice(-lines);
    } catch (e) {
      return [];
    }
  }
}

module.exports = new FileStore();
