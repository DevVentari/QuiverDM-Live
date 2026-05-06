import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const BASE_URL = process.env.DEV_BASE_URL ?? 'https://dev.quiverdm.com';
const LOGIN_URL = `${BASE_URL}/auth/signin`;
const AUTH_STATE_PATH = path.join(__dirname, '.quiverdm-dev-auth-state.json');

const isLoginMode = process.argv.includes('--login');

async function main() {
  if (!isLoginMode && !fs.existsSync(AUTH_STATE_PATH)) {
    console.error('No saved auth state found. Run with --login first:');
    console.error('  npx tsx scripts/save-quiverdm-dev-auth-state.ts --login');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: !isLoginMode });
  const context = await browser.newContext({
    storageState: !isLoginMode && fs.existsSync(AUTH_STATE_PATH)
      ? AUTH_STATE_PATH
      : undefined,
  });
  const page = await context.newPage();

  await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });

  if (isLoginMode) {
    console.log(`Browser opened at ${LOGIN_URL}`);
    console.log('Log in to QuiverDM dev, then press Enter here to save the session...');
    await new Promise<void>((resolve) => process.stdin.once('data', () => resolve()));
    await context.storageState({ path: AUTH_STATE_PATH });
    console.log(`Auth state saved to ${AUTH_STATE_PATH}`);
  } else {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' }).catch(() => {});
    console.log(`Session restored. Current URL: ${page.url()}`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
