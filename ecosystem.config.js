module.exports = {
  apps: [{
    name: 'lgs-admin-panel',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/lgs-admin-panel',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    instances: 2,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/log/pm2/lgs-admin-panel-error.log',
    out_file: '/var/log/pm2/lgs-admin-panel-out.log',
    log_file: '/var/log/pm2/lgs-admin-panel.log',
    time: true,
    ignore_watch: [
      'node_modules',
      '.git',
      '.next',
      'logs'
    ],
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      NEXTAUTH_URL: 'https://admin.letsgo-speak.com',
      DISABLE_AUTH: 'false',
      DISABLE_DB: 'false',
      USE_REAL_WIX_DATA: 'true'
    }
  }]
}