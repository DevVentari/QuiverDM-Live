/**
 * PM2 ecosystem config for homelab workers.
 *
 * Run on homelab after cloning the repo and running `npm install`:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup   # then run the printed command to enable on boot
 *
 * The Next.js app itself runs on Vercel — only workers and the WS server run here.
 */

module.exports = {
  apps: [
    {
      name: 'qdm:ws',
      script: 'npm',
      args: 'run dev:ws',
      env: { NODE_ENV: 'production' },
      restart_delay: 3000,
      max_restarts: 10,
      watch: false,
    },
    {
      name: 'qdm:worker:pdf',
      script: 'npm',
      args: 'run worker:pdf',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      watch: false,
    },
    {
      name: 'qdm:worker:transcription',
      script: 'npm',
      args: 'run worker:transcription',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      watch: false,
    },
    {
      name: 'qdm:worker:image',
      script: 'npm',
      args: 'run worker:image',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      watch: false,
    },
    {
      name: 'qdm:worker:webhooks',
      script: 'npm',
      args: 'run worker:webhooks',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      watch: false,
    },
    {
      name: 'qdm:worker:summary',
      script: 'npm',
      args: 'run worker:summary',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      watch: false,
    },
    {
      name: 'qdm:worker:embeddings',
      script: 'npm',
      args: 'run worker:embeddings',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      watch: false,
    },
  ],
};
