'use strict';
const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = null;
    this.appLogPath = null;
    this.errorLogPath = null;
  }

  init(logDir) {
    this.logDir = logDir;
    this.appLogPath = path.join(logDir, 'app.log');
    this.errorLogPath = path.join(logDir, 'errors.log');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  }

  _fmt(level, message, meta = {}) {
    const ts = new Date().toISOString();
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${ts}] [${level.padEnd(5)}] ${message}${metaStr}\n`;
  }

  _append(filePath, line) {
    if (!filePath) return;
    try { fs.appendFileSync(filePath, line); } catch (_) {}
  }

  info(message, meta = {}) {
    const line = this._fmt('INFO', message, meta);
    process.stdout.write(`\x1b[32m${line}\x1b[0m`);
    this._append(this.appLogPath, line);
  }

  warn(message, meta = {}) {
    const line = this._fmt('WARN', message, meta);
    process.stdout.write(`\x1b[33m${line}\x1b[0m`);
    this._append(this.appLogPath, line);
  }

  error(message, meta = {}) {
    const line = this._fmt('ERROR', message, meta);
    process.stderr.write(`\x1b[31m${line}\x1b[0m`);
    this._append(this.appLogPath, line);
    this._append(this.errorLogPath, line);
  }

  debug(message, meta = {}) {
    if (process.env.DEBUG !== 'true') return;
    const line = this._fmt('DEBUG', message, meta);
    process.stdout.write(`\x1b[36m${line}\x1b[0m`);
    this._append(this.appLogPath, line);
  }
}

module.exports = new Logger();
