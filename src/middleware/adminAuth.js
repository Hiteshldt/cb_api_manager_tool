'use strict';
const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_API_KEY) {
    logger.warn('Unauthorized admin request', { ip: req.ip, path: req.path });
    return res.status(401).json({ error: 'Unauthorized admin request' });
  }
  next();
};
