// ecosystem.config.js - PM2 Configuration
module.exports = {
  apps: [
    {
      name: 'crypto-membership-nft',
      script: './app.js',
      instances: 1, // จำนวน instance (ใช้ 1 เพราะมี telegram bot polling)
      exec_mode: 'fork', // ใช้ fork mode เพราะ telegram bot polling ไม่ support cluster
      watch: false, // ปิด watch ใน production
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        watch: true,
        ignore_watch: ['node_modules', 'logs', '.git']
      },
      // Logging
      log_file: './logs/app.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Auto restart settings
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Health monitoring
      kill_timeout: 3000,
      listen_timeout: 3000,
      
      // Environment variables
      env_file: '.env',
      
      // Advanced settings for telegram bot
      merge_logs: true,
      combine_logs: true,
      
      // Graceful shutdown
      kill_timeout: 5000,
      
      // Source map support (if needed)
      source_map_support: false,
      
      // Additional settings
      node_args: '--max-old-space-size=1024'
    },
    
    // Optional: Separate process for event listener (if heavy load)
    {
      name: 'event-listener',
      script: './scripts/eventListener.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PROCESS_TYPE: 'event_listener'
      },
      // Logging
      log_file: './logs/events.log',
      out_file: './logs/events-out.log',
      error_file: './logs/events-error.log',
      
      // Auto restart
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 5000,
      
      // Only start if enabled
      disabled: false // Set to true if you want to disable
    }
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/telegram_mml.git',
      path: '/var/www/crypto-membership',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run setup-bot && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};