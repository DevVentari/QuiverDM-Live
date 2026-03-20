/**
 * Sniff API calls made when loading a DDB monster page.
 * Usage: node scripts/sniff-ddb-monster.mjs <cobalt-session>
 *
 * Will open browser, navigate to a VEoR custom monster, and log all API calls.
 */

import { chromium } from 'playwright';

const cobaltValue = process.argv[2] ?? process.env.DDB_COBALT_SESSION;
if (!cobaltValue) {
  console.error('Usage: node scripts/sniff-ddb-monster.mjs <CobaltSession>');
  process.exit(1);
}

// A VEoR-exclusive monster that didn't scrape
const MONSTER_URL = 'https://www.dndbeyond.com/monsters/4468313-black-rose-bearer';

const SKIP = ['bi/events', 'telemetry', 'optimizely', '.css', '.woff', '.gif',
  'fonts.googleapis', 'reddit', 'tiktok', 'logx.', 'img.', 'imageGroups', 'media.amplience',
  '.png', '.jpg', '.svg', '.ico', '.webp'];

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

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
const apiCalls = [];

page.on('response', async (res) => {
  const url = res.url();
  if (SKIP.some(s => url.includes(s))) return;
  if (!url.includes('dndbeyond') && !url.includes('auth-service') && !url.includes('character-service') && !url.includes('gamedata')) return;
  if (url.includes('.js')) return;

  try {
    const status = res.status();
    const ct = res.headers()['content-type'] ?? '';
    let body = '';
    if (ct.includes('json') || ct.includes('text')) {
      body = (await res.text().catch(() => '')).slice(0, 800);
    }
    apiCalls.push({ url, status, body });
  } catch {}
});

console.log(`Navigating to: ${MONSTER_URL}`);
await page.goto(MONSTER_URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

console.log('\n\n=== API CALLS ===\n');
const seen = new Set();
for (const { url, status, body } of apiCalls) {
  if (seen.has(url)) continue;
  seen.add(url);
  console.log(`[${status}] ${url}`);
  if (body) console.log('  ↳ ' + body.replace(/\s+/g, ' ').slice(0, 400) + '\n');
}

await browser.close();
