'use strict';
const https  = require('https');
const http   = require('http');
const logger = require('../utils/logger');
const fileStore = require('../storage/fileStore');
const transformationService = require('./transformation.service');

class RestPollingService {
  constructor() {
    /** @type {Map<string, {timer: any, lastFetch: string|null, lastError: string|null}>} */
    this.timers = new Map();
  }

  start(source) {
    this.stop(source.id);
    const interval = (source.pollIntervalSeconds || 30) * 1000;

    // Fetch immediately on start
    this._fetch(source);

    const timer = setInterval(() => {
      const src = fileStore.getSources().find(s => s.id === source.id);
      if (src?.enabled) this._fetch(src);
      else              this.stop(source.id);
    }, interval);

    this.timers.set(source.id, { timer, lastFetch: null, lastError: null });
    logger.info('REST polling started', { sourceId: source.id, intervalMs: interval });
  }

  stop(sourceId) {
    const s = this.timers.get(sourceId);
    if (!s) return;
    clearInterval(s.timer);
    this.timers.delete(sourceId);
    logger.info('REST polling stopped', { sourceId });
  }

  getStatus(sourceId) {
    const s = this.timers.get(sourceId);
    if (!s) return { active: false, lastFetch: null, lastError: null };
    return { active: true, lastFetch: s.lastFetch, lastError: s.lastError };
  }

  // ── Private ──────────────────────────────────────────────────────────────

  async _fetch(source) {
    const state = this.timers.get(source.id);
    try {
      const data = await this._request(source);
      if (state) { state.lastFetch = new Date().toISOString(); state.lastError = null; }
      logger.info('REST fetch success', { sourceId: source.id });
      fileStore.saveRawData(source.id, data);
      transformationService.processSourceData(source.id, data);
    } catch (err) {
      if (state) state.lastError = err.message;
      logger.error('REST fetch failed', { sourceId: source.id, error: err.message });
    }
  }

  _request(source) {
    return new Promise((resolve, reject) => {
      let url;
      try { url = new URL(source.url); }
      catch (e) { return reject(new Error(`Invalid URL: ${source.url}`)); }

      const options = {
        hostname: url.hostname,
        port:     url.port || (url.protocol === 'https:' ? 443 : 80),
        path:     url.pathname + url.search,
        method:   'GET',
        headers:  { Accept: 'application/json', ...source.headers },
      };

      // Auth
      if (source.authType === 'api_key' && source.authConfig?.headerName) {
        options.headers[source.authConfig.headerName] = source.authConfig.apiKey;
      } else if (source.authType === 'bearer' && source.authConfig?.token) {
        options.headers['Authorization'] = `Bearer ${source.authConfig.token}`;
      } else if (source.authType === 'basic' && source.authConfig?.username) {
        const creds = Buffer.from(`${source.authConfig.username}:${source.authConfig.password}`).toString('base64');
        options.headers['Authorization'] = `Basic ${creds}`;
      }

      const lib = url.protocol === 'https:' ? https : http;
      const req = lib.request(options, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('Source returned invalid JSON')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(10_000, () => { req.destroy(); reject(new Error('Request timeout')); });
      req.end();
    });
  }
}

module.exports = new RestPollingService();
