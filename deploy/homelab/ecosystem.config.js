// PM2 ecosystem for QuiverDM homelab (LXC 206, 192.168.1.21)
// Deploy: pm2 start /opt/quiverdm/deploy/homelab/ecosystem.config.js
// Update:  cd /opt/quiverdm && git pull && npm ci && pm2 restart all

const APP_DIR = '/opt/quiverdm';
const TSX = `${APP_DIR}/node_modules/.bin/tsx`;

const worker = (name, file, opts = {}) => ({
  name,
  script: TSX,
  args: file,
  cwd: APP_DIR,
  watch: false,
  autorestart: true,
  max_restarts: 50,
  min_uptime: '5s',
  restart_delay: 3000,
  env: { NODE_ENV: 'development' },
  ...opts,
});

module.exports = {
  apps: [
    // --- Core pipeline ---
    worker('worker-pdf',              'src/lib/queue/worker.ts'),
    worker('worker-transcription',    'src/lib/queue/transcription-worker.ts'),
    worker('worker-multi-track',      'src/lib/queue/multi-track-worker.ts'),
    worker('worker-summary',          'src/lib/queue/ai-summary-worker.ts'),
    worker('worker-embeddings',       'src/lib/queue/embeddings-worker.ts'),
    worker('worker-recap',            'src/lib/queue/recap-generation-worker.ts'),
    worker('worker-player-recap',     'src/lib/queue/player-recap-worker.ts'),

    // --- AI features ---
    worker('worker-image',            'src/lib/queue/image-generation-worker.ts'),
    worker('worker-context',          'src/lib/queue/context-extraction-worker.ts'),
    worker('worker-co-dm',            'src/lib/queue/co-dm-worker.ts'),
    worker('worker-co-dm-prep',       'src/lib/queue/co-dm-prep-worker.ts'),
    worker('worker-combat-copilot',   'src/lib/queue/combat-copilot-worker.ts'),
    worker('worker-derailment',       'src/lib/queue/derailment-worker.ts'),

    // --- DM Brain ---
    worker('worker-brain-ingestion',  'src/lib/queue/brain-ingestion-worker.ts'),
    worker('worker-brain-inference',  'src/lib/queue/brain-inference-worker.ts'),
    worker('worker-world-sim',        'src/lib/queue/world-simulation-worker.ts'),

    // --- DDB sync ---
    worker('worker-ddb-sync',         'src/lib/queue/ddb-sync-coordinator-worker.ts'),
    worker('worker-ddb-chapter',      'src/lib/queue/ddb-chapter-extract-worker.ts'),
    worker('worker-ddb-review',       'src/lib/queue/ddb-sync-review-worker.ts'),
    worker('worker-sourcebook',       'src/lib/queue/sourcebook-scene-extraction-worker.ts'),

    // --- Infra ---
    worker('worker-session-events',   'src/lib/queue/session-events-worker.ts'),
    worker('worker-webhooks',         'src/lib/queue/webhooks-worker.ts'),
    worker('worker-feedback',         'src/lib/queue/feedback-triage-worker.ts'),
    worker('worker-obsidian',         'src/lib/queue/obsidian-import-worker.ts'),

    // --- WebSocket server ---
    {
      name: 'ws-server',
      script: TSX,
      args: 'src/server/ws-server.ts',
      cwd: APP_DIR,
      watch: false,
      autorestart: true,
      max_restarts: 50,
      min_uptime: '5s',
      restart_delay: 3000,
      env: { NODE_ENV: 'development', WS_PORT: '3004' },
    },
  ],
};
