import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3847';
const EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const AUTH_STATE_PATH = path.resolve(process.cwd(), 'tests/.auth/user.json');

async function main() {
  if (!PASSWORD) {
    throw new Error('QA_TEST_PASSWORD is not set');
  }

  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  await page.goto('/auth/signin');
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|enter the realm/i }).click();
  await page.waitForURL(/dashboard|onboarding|campaigns|characters|homebrew|settings|members/, {
    timeout: 15_000,
  });

  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(JSON.stringify({ url: page.url(), saved: AUTH_STATE_PATH }));

  await browser.close();
}

main().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exit(1);
});
