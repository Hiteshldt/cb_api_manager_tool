'use strict';
require('dotenv').config();
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const morgan   = require('morgan');

const adminAuth    = require('./middleware/adminAuth');
const errorHandler = require('./middleware/errorHandler');
const sourcesRoutes        = require('./routes/adminSources.routes');
const transformationsRoutes = require('./routes/adminTransformations.routes');
const endpointsRoutes      = require('./routes/adminEndpoints.routes');
const outputRoutes         = require('./routes/output.routes');
const logger   = require('./utils/logger');
const fileStore = require('./storage/fileStore');

// ── Bootstrap storage ────────────────────────────────────────────────────────
const configDir = path.resolve(process.env.CONFIG_DIR || './data');
fileStore.init(configDir);
logger.init(path.join(configDir, 'logs'));

// ── Express app ──────────────────────────────────────────────────────────────
const app = express();

// HTTP access log
const accessStream = fs.createWriteStream(path.join(configDir, 'logs', 'app.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessStream }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Permissive CORS for local use
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Static assets ────────────────────────────────────────────────────────────
app.use('/public', express.static(path.join(__dirname, '../public')));
// Serve the logo from project root
app.get('/logo.webp', (req, res) => {
  res.sendFile(path.join(__dirname, '../logo.webp'));
});

// ── Admin API routes (authenticated) ─────────────────────────────────────────
app.use('/admin/sources',         adminAuth, sourcesRoutes);
app.use('/admin/transformations', adminAuth, transformationsRoutes);
app.use('/admin/endpoints',       adminAuth, endpointsRoutes);

app.get('/admin/logs', adminAuth, (req, res) => {
  const type  = req.query.type  || 'app';
  const lines = parseInt(req.query.lines) || 150;
  res.json({ logs: fileStore.getRecentLogs(type, lines) });
});

app.get('/admin/stats', adminAuth, (req, res) => {
  const sources         = fileStore.getSources();
  const transformations = fileStore.getTransformations();
  const endpoints       = fileStore.getEndpoints();
  res.json({
    sources:         sources.length,
    transformations: transformations.length,
    endpoints:       endpoints.length,
    activeSources:   sources.filter(s => s.enabled).length,
    activeEndpoints: endpoints.filter(e => e.enabled).length,
  });
});

// ── Health check (no auth — for uptime monitors, load balancers, AWS checks) ──
app.get('/health', (req, res) => {
  const sources   = fileStore.getSources();
  const endpoints = fileStore.getEndpoints();
  res.json({
    status:    'ok',
    uptime:    Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version:   process.env.npm_package_version || '1.0.0',
    sources:   { total: sources.length, active: sources.filter(s => s.enabled).length },
    endpoints: { total: endpoints.length, active: endpoints.filter(e => e.enabled).length },
  });
});

// ── Admin UI (SPA) ───────────────────────────────────────────────────────────
app.get('/admin', (req, res) =>
  res.sendFile(path.join(__dirname, '../public/index.html'))
);
app.get('/admin/*', (req, res) =>
  res.sendFile(path.join(__dirname, '../public/index.html'))
);

// ── Output API — general catch-all for user-defined paths ────────────────────
// Mounted AFTER all /admin routes so nothing reserved gets hijacked.
// output.routes calls next() if no endpoint matches → falls through to 404.
app.use(outputRoutes);

// ── 404 / error handlers ──────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
