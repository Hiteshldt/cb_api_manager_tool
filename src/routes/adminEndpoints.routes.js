'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router  = express.Router();
const fileStore = require('../storage/fileStore');
const logger  = require('../utils/logger');

// GET /admin/endpoints
router.get('/', (req, res) => res.json(fileStore.getEndpoints()));

// GET /admin/endpoints/:id
router.get('/:id', (req, res) => {
  const ep = fileStore.getEndpoints().find(e => e.id === req.params.id);
  if (!ep) return res.status(404).json({ error: 'Endpoint not found' });
  res.json(ep);
});

// GET /admin/endpoints/:id/latest — preview latest transformed output
router.get('/:id/latest', (req, res) => {
  const ep = fileStore.getEndpoints().find(e => e.id === req.params.id);
  if (!ep) return res.status(404).json({ error: 'Endpoint not found' });
  const data = fileStore.getTransformedData(req.params.id);
  if (!data) return res.status(404).json({ error: 'No data available yet' });
  res.json(data);
});

// POST /admin/endpoints
router.post('/', (req, res) => {
  const { name, path: epPath, method, sourceId, transformationId, authRequired, apiKey, enabled } = req.body;
  if (!name || !epPath || !sourceId || !transformationId)
    return res.status(400).json({ error: 'name, path, sourceId, transformationId are required' });

  // Normalise: ensure leading slash, lowercase, no trailing slash
  const normalPath = ('/' + epPath.replace(/^\/+/, '')).replace(/\/+$/, '').toLowerCase();

  // Reserved prefixes — can't hijack the admin UI or static assets
  const reserved = ['/admin', '/public', '/logo'];
  if (reserved.some(r => normalPath.startsWith(r)))
    return res.status(400).json({ error: `Path cannot start with a reserved prefix (${reserved.join(', ')})` });

  const endpoints = fileStore.getEndpoints();
  if (endpoints.find(e => e.path === normalPath))
    return res.status(400).json({ error: 'Endpoint path already exists' });

  const now = new Date().toISOString();
  const ep = {
    id:               `endpoint_${uuidv4().replace(/-/g, '').slice(0, 8)}`,
    name,
    path:             normalPath,
    method:           method || 'GET',
    sourceId,
    transformationId,
    authRequired:     authRequired !== false,
    apiKey:           apiKey || '',
    enabled:          enabled !== false,
    createdAt:        now,
    updatedAt:        now,
  };
  endpoints.push(ep);
  fileStore.saveEndpoints(endpoints);
  logger.info('Endpoint created', { id: ep.id, path: ep.path });
  res.status(201).json(ep);
});

// PUT /admin/endpoints/:id
router.put('/:id', (req, res) => {
  const endpoints = fileStore.getEndpoints();
  const idx = endpoints.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Endpoint not found' });

  // Path uniqueness check (excluding self)
  if (req.body.path) {
    const newPath = ('/' + req.body.path.replace(/^\/+/, '')).replace(/\/+$/, '').toLowerCase();
    req.body.path = newPath;
    const reserved = ['/admin', '/public', '/logo'];
    if (reserved.some(r => newPath.startsWith(r)))
      return res.status(400).json({ error: `Path cannot start with a reserved prefix (${reserved.join(', ')})` });
    if (endpoints.find(e => e.path === newPath && e.id !== req.params.id))
      return res.status(400).json({ error: 'Endpoint path already exists' });
  }

  const updated = { ...endpoints[idx], ...req.body, id: endpoints[idx].id, createdAt: endpoints[idx].createdAt, updatedAt: new Date().toISOString() };
  endpoints[idx] = updated;
  fileStore.saveEndpoints(endpoints);
  logger.info('Endpoint updated', { id: updated.id });
  res.json(updated);
});

// DELETE /admin/endpoints/:id
router.delete('/:id', (req, res) => {
  const endpoints = fileStore.getEndpoints();
  const idx = endpoints.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Endpoint not found' });
  const [removed] = endpoints.splice(idx, 1);
  fileStore.saveEndpoints(endpoints);
  logger.info('Endpoint deleted', { id: removed.id });
  res.json({ message: 'Endpoint deleted', id: removed.id });
});

module.exports = router;
