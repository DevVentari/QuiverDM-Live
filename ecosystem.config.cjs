module.exports = {
  apps: [
    {
      name: 'quiverdm-feedback-triage',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/lib/queue/feedback-triage-worker.ts',
      cwd: 'E:/Projects/QuiverDM',
      interpreter: 'node',
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      log_file: 'logs/feedback-triage.log',
      error_file: 'logs/feedback-triage-error.log',
      time: true,
    },
  ],
};
