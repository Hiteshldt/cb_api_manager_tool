'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router  = express.Router();
const fileStore = require('../storage/fileStore');
const transformationService = require('../services/transformation.service');
const logger  = require('../utils/logger');

// GET /admin/transformations
router.get('/', (req, res) => res.json(fileStore.getTransformations()));

// GET /admin/transformations/:id
router.get('/:id', (req, res) => {
  const t = fileStore.getTransformations().find(t => t.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Transformation not found' });
  res.json(t);
});

// POST /admin/transformations/preview  (must be before /:id)
router.post('/preview', (req, res) => {
  const { sampleData, mappings, staticFields, computedFields } = req.body;
  if (!sampleData) return res.status(400).json({ error: 'sampleData is required' });
  try {
    const result = transformationService.preview(
      sampleData,
      mappings       || [],
      staticFields   || [],
      computedFields || [],
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /admin/transformations
router.post('/', (req, res) => {
  const { name, sourceId, mappings, staticFields, computedFields, enabled } = req.body;
  if (!name || !sourceId)
    return res.status(400).json({ error: 'name and sourceId are required' });
  if (!fileStore.getSources().find(s => s.id === sourceId))
    return res.status(400).json({ error: 'Source not found' });

  const now = new Date().toISOString();
  const t = {
    id:             `transform_${uuidv4().replace(/-/g, '').slice(0, 8)}`,
    name,
    sourceId,
    mappings:       mappings       || [],
    staticFields:   staticFields   || [],
    computedFields: computedFields || [],
    enabled:        enabled !== false,
    createdAt:      now,
    updatedAt:      now,
  };
  const transformations = fileStore.getTransformations();
  transformations.push(t);
  fileStore.saveTransformations(transformations);
  logger.info('Transformation created', { id: t.id, name: t.name });
  res.status(201).json(t);
});

// PUT /admin/transformations/:id
router.put('/:id', (req, res) => {
  const transformations = fileStore.getTransformations();
  const idx = transformations.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transformation not found' });

  const updated = {
    ...transformations[idx],
    ...req.body,
    id:        transformations[idx].id,
    createdAt: transformations[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  transformations[idx] = updated;
  fileStore.saveTransformations(transformations);
  logger.info('Transformation updated', { id: updated.id });
  res.json(updated);
});

// DELETE /admin/transformations/:id
router.delete('/:id', (req, res) => {
  const transformations = fileStore.getTransformations();
  const idx = transformations.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transformation not found' });
  const [removed] = transformations.splice(idx, 1);
  fileStore.saveTransformations(transformations);
  logger.info('Transformation deleted', { id: removed.id });
  res.json({ message: 'Transformation deleted', id: removed.id });
});

module.exports = router;
