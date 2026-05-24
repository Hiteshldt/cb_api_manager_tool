'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router  = express.Router();
const fileStore = require('../storage/fileStore');
const sourceManager = require('../services/sourceManager.service');
const logger  = require('../utils/logger');

// GET /admin/sources
router.get('/', (req, res) => res.json(fileStore.getSources()));

// GET /admin/sources/:id
router.get('/:id', (req, res) => {
  const s = fileStore.getSources().find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Source not found' });
  res.json(s);
});

// GET /admin/sources/:id/latest  — latest raw data
router.get('/:id/latest', (req, res) => {
  const s = fileStore.getSources().find(s => s.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Source not found' });
  const data = fileStore.getRawData(req.params.id);
  if (!data) return res.status(404).json({ error: 'No data received from source yet' });
  res.json(data);
});

// POST /admin/sources
router.post('/', (req, res) => {
  const { name, type, url, authType, authConfig, headers, pollIntervalSeconds, wsSubscribeMessage, enabled } = req.body;
  if (!name || !type || !url)
    return res.status(400).json({ error: 'name, type, and url are required' });
  if (!['websocket', 'rest'].includes(type))
    return res.status(400).json({ error: 'type must be "websocket" or "rest"' });

  const now = new Date().toISOString();
  const source = {
    id:                  `source_${uuidv4().replace(/-/g, '').slice(0, 8)}`,
    name,
    type,
    url,
    authType:            authType   || 'none',
    authConfig:          authConfig || {},
    headers:             headers    || {},
    pollIntervalSeconds: type === 'rest' ? (pollIntervalSeconds || 30) : null,
    // wsSubscribeMessage: JSON sent to WS immediately after connect (e.g. subscribe handshake)
    wsSubscribeMessage:  type === 'websocket' ? (wsSubscribeMessage || null) : null,
    enabled:             enabled !== false,
    createdAt:           now,
    updatedAt:           now,
  };

  const sources = fileStore.getSources();
  sources.push(source);
  fileStore.saveSources(sources);
  if (source.enabled) sourceManager.startSource(source);
  logger.info('Source created', { id: source.id, name: source.name });
  res.status(201).json(source);
});

// PUT /admin/sources/:id
router.put('/:id', (req, res) => {
  const sources = fileStore.getSources();
  const idx = sources.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Source not found' });

  const updated = { ...sources[idx], ...req.body, id: sources[idx].id, createdAt: sources[idx].createdAt, updatedAt: new Date().toISOString() };
  sources[idx] = updated;
  fileStore.saveSources(sources);
  sourceManager.restartSource(updated);
  logger.info('Source updated', { id: updated.id });
  res.json(updated);
});

// DELETE /admin/sources/:id
router.delete('/:id', (req, res) => {
  const sources = fileStore.getSources();
  const idx = sources.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Source not found' });
  const [removed] = sources.splice(idx, 1);
  fileStore.saveSources(sources);
  sourceManager.stopSource(removed.id);
  logger.info('Source deleted', { id: removed.id });
  res.json({ message: 'Source deleted', id: removed.id });
});

module.exports = router;
