'use strict';
const WebSocket = require('ws');
const logger    = require('../utils/logger');
const fileStore = require('../storage/fileStore');
const transformationService = require('./transformation.service');

const MAX_RECONNECT_DELAY = 30_000; // 30 s

class WebSocketService {
  constructor() {
    /** @type {Map<string, {ws: WebSocket|null, reconnectTimer: any, reconnectDelay: number, connected: boolean}>} */
    this.connections = new Map();
  }

  connect(source) {
    this.disconnect(source.id);
    this._open(source, 1000);
  }

  disconnect(sourceId) {
    const conn = this.connections.get(sourceId);
    if (!conn) return;
    clearTimeout(conn.reconnectTimer);
    if (conn.ws) {
      conn.ws.removeAllListeners();
      try { conn.ws.terminate(); } catch (_) {}
    }
    this.connections.delete(sourceId);
    logger.info('WebSocket disconnected', { sourceId });
  }

  getStatus(sourceId) {
    const conn = this.connections.get(sourceId);
    if (!conn)           return 'disconnected';
    if (conn.connected)  return 'connected';
    return 'reconnecting';
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _open(source, delay) {
    if (!this.connections.has(source.id)) {
      this.connections.set(source.id, { ws: null, reconnectTimer: null, reconnectDelay: delay, connected: false });
    }

    const headers = { ...source.headers };
    if (source.authType === 'api_key' && source.authConfig?.headerName) {
      headers[source.authConfig.headerName] = source.authConfig.apiKey;
    } else if (source.authType === 'bearer' && source.authConfig?.token) {
      headers['Authorization'] = `Bearer ${source.authConfig.token}`;
    }

    let ws;
    try {
      ws = new WebSocket(source.url, { headers });
    } catch (err) {
      logger.error('WebSocket creation failed', { sourceId: source.id, error: err.message });
      this._scheduleReconnect(source, delay);
      return;
    }

    const conn = this.connections.get(source.id);
    conn.ws = ws;

    ws.on('open', () => {
      conn.connected      = true;
      conn.reconnectDelay = 1000;
      logger.info('WebSocket connected', { sourceId: source.id, url: source.url });

      // ── Send subscribe message on connect (if configured) ──────────────────
      // source.wsSubscribeMessage can be:
      //   • a plain JSON object  → sent as-is
      //   • a string             → sent as-is
      //   • falsy                → nothing sent (plain WebSocket, no handshake needed)
      //
      // For AWS API Gateway style:  { action: "subscribe", deviceId: "BTTE1250002" }
      if (source.wsSubscribeMessage) {
        try {
          const payload = typeof source.wsSubscribeMessage === 'string'
            ? source.wsSubscribeMessage
            : JSON.stringify(source.wsSubscribeMessage);
          ws.send(payload);
          logger.info('WS subscribe message sent', { sourceId: source.id, payload });
        } catch (err) {
          logger.error('WS subscribe send failed', { sourceId: source.id, error: err.message });
        }
      }
    });

    ws.on('message', (raw) => this._handleMessage(source, raw.toString()));

    ws.on('error', (err) => {
      logger.error('WebSocket error', { sourceId: source.id, error: err.message });
    });

    ws.on('close', (code, reason) => {
      conn.connected = false;
      logger.warn('WebSocket closed', { sourceId: source.id, code, reason: reason?.toString() });
      const src = fileStore.getSources().find(s => s.id === source.id);
      if (src?.enabled) this._scheduleReconnect(src, conn.reconnectDelay);
    });
  }

  _scheduleReconnect(source, delay) {
    const next = Math.min(delay * 2, MAX_RECONNECT_DELAY);
    logger.info(`WebSocket reconnect in ${delay}ms`, { sourceId: source.id });

    const timer = setTimeout(() => {
      const src = fileStore.getSources().find(s => s.id === source.id);
      if (src?.enabled) this._open(src, next);
    }, delay);

    const conn = this.connections.get(source.id);
    if (conn) {
      conn.reconnectTimer  = timer;
      conn.reconnectDelay  = next;
    }
  }

  _handleMessage(source, raw) {
    let data;
    try { data = JSON.parse(raw); }
    catch (err) {
      logger.error('Invalid JSON from WebSocket', { sourceId: source.id, error: err.message });
      return;
    }
    fileStore.saveRawData(source.id, data);
    transformationService.processSourceData(source.id, data);
  }
}

module.exports = new WebSocketService();
