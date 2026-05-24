// PM2 process manager config
// Usage:
//   pm2 start ecosystem.config.js --env production
//   pm2 restart cb-api-engine
//   pm2 logs cb-api-engine
//   pm2 monit

module.exports = {
  apps: [
    {
      name:             'cb-api-engine',
      script:           'src/server.js',
      instances:        1,          // single instance — app stores state on disk
      autorestart:      true,
      watch:            false,
      max_memory_restart: '300M',

      // Production env vars (override .env for anything you want locked in PM2)
      env_production: {
        NODE_ENV: 'production',
      },

      // Log files — alongside the app's own data/logs/
      error_file: './data/logs/pm2-error.log',
      out_file:   './data/logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Graceful shutdown
      kill_timeout:     5000,
      listen_timeout:   8000,
    },
  ],
};
