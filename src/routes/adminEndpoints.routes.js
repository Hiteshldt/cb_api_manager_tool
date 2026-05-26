'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router  = express.Router();
const fileStore = require('../storage/fileStore');
const transformationService = require('../services/transformation.service');
const logger  = require('../utils/logger');

// Helper: generate endpoint output immediately from the last known raw data.
// Used on create and update so the Output modal never shows 404 just because
// no new WSS packet has arrived yet since the endpoint was added/changed.
function seedEndpointOutput(ep) {
  const stored = fileStore.getRawData(ep.sourceId);
  if (!stored?.data) return;                          // no raw data yet — WSS hasn't fired
  const transformations = fileStore.getTransformations();
  const t = transformations.find(t => t.id === ep.transformationId && t.enabled !== false);
  if (!t) return;
  try {
    const output = transformationService.applyTransformation(stored.data, t);
    fileStore.saveTransformedData(ep.id, output);
    logger.info('Endpoint output seeded', { id: ep.id });
  } catch (err) {
    logger.warn('Endpoint output seed failed', { id: ep.id, error: err.message });
  }
}

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
  seedEndpointOutput(ep);           // generate output immediately if raw data exists
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
  seedEndpointOutput(updated);      // re-generate output immediately if raw data exists
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
