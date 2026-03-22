/**
 * Refresh the DDB CobaltSession cookie in prod.
 *
 * First run (interactive — SSO login required):
 *   npx tsx scripts/refresh-cobalt-session.ts --login
 *
 * Subsequent runs (headless — uses saved auth state):
 *   npx tsx scripts/refresh-cobalt-session.ts
 *
 * Saved auth state: scripts/.ddb-auth-state.json (gitignored)
 * Updates: credentials.env + prod DB (UserSettings.dndBeyondCobaltCookie)
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DB_URL = 'postgresql://neondb_owner:npg_tS0cRJWNr3Zp@ep-little-mud-a7d2pt33.ap-southeast-2.aws.neon.tech/neondb?sslmode=require';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? '3nG9+8WZtOXv8SI758zIFQAJ1GE57gEL7eZH9uOLQUA=';
const DDB_USER_ID = 'cmmqlqy1o0001co5m5wf4efj7';
const AUTH_STATE_PATH = path.join(__dirname, '.ddb-auth-state.json');
const CREDENTIALS_ENV_PATH = 'C:/Users/mail/.claude/credentials.env';

const isLoginMode = process.argv.includes('--login');

function encrypt(text: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function getCobaltSession(): Promise<string | null> {
  const browser = await chromium.launch({ headless: !isLoginMode });
  const context = await browser.newContext({
    storageState: !isLoginMode && fs.existsSync(AUTH_STATE_PATH)
      ? AUTH_STATE_PATH
      : undefined,
  });

  const page = await context.newPage();
  await page.goto('https://www.dndbeyond.com/login');

  if (isLoginMode) {
    console.log('\nBrowser opened — please log in to D&D Beyond (Discord or Google).');
    console.log('Once you are logged in and see the home page, press Enter here...');
    await new Promise<void>(r => process.stdin.once('data', () => r()));
    await context.storageState({ path: AUTH_STATE_PATH });
    console.log(`Auth state saved to ${AUTH_STATE_PATH}`);
  } else {
    // Wait for page to settle after restoring session
    await page.waitForLoadState('networkidle').catch(() => {});
  }

  const cookies = await context.cookies('https://www.dndbeyond.com');
  const cobalt = cookies.find(c => c.name === 'CobaltSession');

  await browser.close();
  return cobalt?.value ?? null;
}

async function main() {
  if (!isLoginMode && !fs.existsSync(AUTH_STATE_PATH)) {
    console.error('No saved auth state found. Run with --login first:');
    console.error('  npx tsx scripts/refresh-cobalt-session.ts --login');
    process.exit(1);
  }

  console.log(isLoginMode ? 'Login mode — launching headed browser...' : 'Headless mode — using saved session...');
  const cobaltSession = await getCobaltSession();

  if (!cobaltSession) {
    console.error('CobaltSession cookie not found. Try --login to re-authenticate.');
    process.exit(1);
  }

  console.log(`Got CobaltSession (${cobaltSession.length} chars)`);

  // Update prod DB
  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  const encrypted = encrypt(cobaltSession);
  await prisma.userSettings.upsert({
    where: { userId: DDB_USER_ID },
    update: { dndBeyondCobaltCookie: encrypted },
    create: { userId: DDB_USER_ID, dndBeyondCobaltCookie: encrypted },
  });
  await prisma.$disconnect();
  console.log('Updated prod DB UserSettings');

  // Update credentials.env
  if (fs.existsSync(CREDENTIALS_ENV_PATH)) {
    let content = fs.readFileSync(CREDENTIALS_ENV_PATH, 'utf8');
    const newLine = `DDB_COBALT_SESSION=${cobaltSession}`;
    if (content.includes('DDB_COBALT_SESSION=')) {
      content = content.replace(/DDB_COBALT_SESSION=.*/, newLine);
    } else {
      content += `\n${newLine}\n`;
    }
    fs.writeFileSync(CREDENTIALS_ENV_PATH, content, 'utf8');
    console.log('Updated credentials.env');
  }

  console.log('\nDone. CobaltSession refreshed and stored in prod DB + credentials.env');
}

main().catch(e => { console.error(e); process.exit(1); });
