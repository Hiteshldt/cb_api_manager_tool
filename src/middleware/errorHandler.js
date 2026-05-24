'use strict';
const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, path: req.path, stack: err.stack });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
};
