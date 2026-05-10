import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
config({ path: '.env.local', override: false });

const BASE_URL =
  process.env.BASE_URL ??
  (!process.env.CI ? 'http://localhost:3847' : process.env.QA_APP_URL ?? 'http://localhost:3847');
const USE_LOCAL_WEB_SERVER =
  !process.env.CI && /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(BASE_URL);

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60000,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: {
        // Spread iPhone 14 viewport/touch/UA but use Chromium (WebKit may not be installed)
        ...(() => { const { defaultBrowserType: _, ...rest } = devices['iPhone 14']; return rest; })(),
      },
      testMatch: 'tests/mobile/**/*.spec.ts',
    },
  ],

  ...(USE_LOCAL_WEB_SERVER
    ? {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:3847',
          reuseExistingServer: true,
          timeout: 120000,
        },
      }
    : {}),
});
