'use strict';
require('dotenv').config();
const app     = require('./app');
const sourceManager = require('./services/sourceManager.service');
const logger  = require('./utils/logger');

const PORT = parseInt(process.env.PORT || '3000', 10);

const server = app.listen(PORT, () => {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  Carbelim API Transformation Engine — RUNNING');
  logger.info(`  Admin UI  →  http://localhost:${PORT}/admin`);
  logger.info(`  API base  →  http://localhost:${PORT}/api/output/`);
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Start all configured data sources
  sourceManager.startAll();
});

const graceful = (sig) => {
  logger.info(`${sig} received — shutting down gracefully`);
  server.close(() => { logger.info('Server closed.'); process.exit(0); });
};
process.on('SIGTERM', () => graceful('SIGTERM'));
process.on('SIGINT',  () => graceful('SIGINT'));

module.exports = server;
