'use strict';
const express   = require('express');
const router    = express.Router();
const fileStore = require('../storage/fileStore');
const logger    = require('../utils/logger');

/**
 * General-purpose output route — matches ANY GET path against stored endpoints.
 * Calls next() if no endpoint matches (→ falls through to 404).
 *
 * Examples of valid user-defined paths:
 *   /output/iocl_output
 *   /output/btte1260001
 *   /data/device-status
 *   /api/output/legacy-path      ← old style still works
 */
router.get('*', (req, res, next) => {
  const reqPath  = req.path; // full path, e.g. /output/iocl_output
  const endpoints = fileStore.getEndpoints();
  const endpoint  = endpoints.find(e => e.path === reqPath && e.enabled !== false);

  if (!endpoint) return next(); // no match — let 404 handler take it

  // Auth check
  if (endpoint.authRequired) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== endpoint.apiKey) {
      logger.warn('Unauthorized output request', { path: reqPath, endpointId: endpoint.id });
      return res.status(401).json({ error: 'Unauthorized API request' });
    }
  }

  const stored = fileStore.getTransformedData(endpoint.id);
  if (!stored) {
    return res.status(503).json({ error: 'No data received from source yet' });
  }

  logger.info('Output served', { path: reqPath, endpointId: endpoint.id });
  res.json(stored.data);
});

module.exports = router;
