import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/workflows',
  testIgnore: ['**/forge-recap.workflow.spec.ts', '**/forge-recap-publish.workflow.spec.ts'],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3005',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3005/api/health',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
