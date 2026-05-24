'use strict';
const logger  = require('../utils/logger');
const fileStore = require('../storage/fileStore');
const wsService   = require('./websocket.service');
const restService = require('./restPolling.service');

class SourceManagerService {
  /** Called once on server startup */
  startAll() {
    const sources = fileStore.getSources().filter(s => s.enabled !== false);
    logger.info(`Starting ${sources.length} enabled source(s)`);
    for (const s of sources) this.startSource(s);
  }

  startSource(source) {
    if (!source || source.enabled === false) return;
    if (source.type === 'websocket') wsService.connect(source);
    else if (source.type === 'rest')  restService.start(source);
  }

  stopSource(sourceId) {
    wsService.disconnect(sourceId);
    restService.stop(sourceId);
  }

  restartSource(source) {
    this.stopSource(source.id);
    this.startSource(source);
  }

  getSourceStatus(source) {
    if (source.type === 'websocket') return wsService.getStatus(source.id);
    if (source.type === 'rest') {
      const s = restService.getStatus(source.id);
      return s.active ? 'polling' : 'stopped';
    }
    return 'unknown';
  }
}

module.exports = new SourceManagerService();
