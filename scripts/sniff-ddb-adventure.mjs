/**
 * Sniff D&D Beyond adventure API calls.
 * Opens a browser — user logs in manually, then script auto-captures API calls.
 *
 * Run: node scripts/sniff-ddb-adventure.mjs
 */

import { chromium } from 'playwright';

const ADVENTURE_URL = 'https://www.dndbeyond.com/sources/dnd/veor/the-lambent-zeniths-last-voyage';
const SKIP = ['bi/events', 'telemetry', 'optimizely', 'einstein', '.css', '.woff', '.gif',
  'fonts.googleapis', 'reddit', 'tiktok', 'logx.', 'img.', 'imageGroups', 'media.amplience'];

// Accept CobaltSession as CLI arg or prompt
// Usage: node sniff-ddb-adventure.mjs [cobalt-session-value]
let cobaltValue = process.argv[2] ?? null;

if (!cobaltValue) {
  console.log('Usage: node scripts/sniff-ddb-adventure.mjs <CobaltSession>');
  console.log('\nGet your CobaltSession from:');
  console.log('  Chrome DevTools → Application → Cookies → dndbeyond.com → CobaltSession → Value');
  process.exit(1);
}

console.log(`Using CobaltSession: ${cobaltValue.slice(0, 40)}...\n`);

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

// Inject the session cookie before navigating
await context.addCookies([{
  name: 'CobaltSession',
  value: cobaltValue,
  domain: '.dndbeyond.com',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'None',
}]);

const page = await context.newPage();

// ── Capture API calls on the adventure reader ──────────────────────────────
const apiCalls = [];

page.on('response', async (res) => {
  const url = res.url();
  if (SKIP.some(s => url.includes(s))) return;
  if (!url.includes('dndbeyond') && !url.includes('auth-service')) return;
  if (url.includes('.js') || url.includes('.css') || url.includes('.png') || url.includes('.jpg')) return;

  try {
    const status = res.status();
    const ct = res.headers()['content-type'] ?? '';
    let body = '';
    if (ct.includes('json') || ct.includes('text')) {
      body = (await res.text().catch(() => '')).slice(0, 600);
    }
    apiCalls.push({ url, status, body });
  } catch {}
});

console.log('Navigating to adventure reader...');
await page.goto(ADVENTURE_URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(3000);
console.log('Reader URL:', page.url());

// Scroll to trigger lazy content
for (const y of [500, 1500, 3000, 5000]) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(1500);
}

// ── Output ─────────────────────────────────────────────────────────────────
console.log('\n\n=== DDB API CALLS ===\n');
const seen = new Set();
for (const { url, status, body } of apiCalls) {
  if (seen.has(url)) continue;
  seen.add(url);
  console.log(`[${status}] ${url}`);
  if (body) console.log('  ↳ ' + body.replace(/\s+/g, ' ').slice(0, 300) + '\n');
}

console.log(`\nCobaltSession: ${cobaltValue}`);

await browser.close();
