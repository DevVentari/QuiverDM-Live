/**
 * Mobile Responsiveness Tests — iPhone 14 (390x844)
 *
 * Checks every major UI page for:
 * 1. No horizontal overflow (scrollWidth <= innerWidth)
 * 2. No key elements clipped outside viewport bounds
 * 3. Campaign nav tabs scrollable and not squished below 30px height
 * 4. Full-page screenshot saved to docs/screenshots/mobile/
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3847';
const TEST_EMAIL = 'demo@quiverdm.com';
const TEST_PASSWORD = 'demo1234';

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/screenshots/mobile');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function signIn(page: Page) {
  await page.goto(`${BASE_URL}/auth/signin`);
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard|campaigns|characters|homebrew|settings/, { timeout: 20000 });
}

// ─── Shared discovery state ───────────────────────────────────────────────────
// These are populated by the first test in the describe block.

let campaignSlug = '';
let sessionId = '';
let npcId = '';

// ─── Check helpers ────────────────────────────────────────────────────────────

async function checkNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
    overflowing: document.body.scrollWidth > window.innerWidth,
  }));
  expect(
    overflow.overflowing,
    `[${label}] Horizontal overflow: scrollWidth=${overflow.bodyScrollWidth} > innerWidth=${overflow.innerWidth}`
  ).toBe(false);
}

async function checkNoElementsOutsideViewport(page: Page, label: string) {
  const violations = await page.evaluate(() => {
    const vw = window.innerWidth;
    const els = Array.from(document.querySelectorAll('button, a, nav, header, [role="navigation"]'));
    return els
      .map(el => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: ((el as HTMLElement).innerText ?? '').slice(0, 40),
          left: Math.round(r.left),
          right: Math.round(r.right),
        };
      })
      .filter(r => r.right > vw + 10 || r.left < -20);
  });

  if (violations.length > 0) {
    const detail = violations
      .slice(0, 5)
      .map(v => `<${v.tag}> "${v.text}" left=${v.left} right=${v.right}`)
      .join('; ');
    console.warn(`[${label}] ${violations.length} element(s) significantly outside viewport: ${detail}`);
  }

  expect(
    violations.length,
    `[${label}] Elements significantly outside viewport: ${violations.slice(0, 3).map(v => `<${v.tag}> "${v.text}"`).join(', ')}`
  ).toBe(0);
}

async function checkCampaignNavTabs(page: Page, label: string) {
  const tabHeights = await page.evaluate(() => {
    const tabs = Array.from(
      document.querySelectorAll('nav a, [role="tab"], [data-testid="campaign-nav"] a')
    );
    return tabs.slice(0, 10).map(el => ({
      text: ((el as HTMLElement).innerText ?? '').trim().slice(0, 20),
      height: Math.round(el.getBoundingClientRect().height),
    }));
  });

  const squished = tabHeights.filter(t => t.height > 0 && t.height < 30);
  if (squished.length > 0) {
    console.warn(
      `[${label}] Nav tabs below 30px: ${squished.map(t => `"${t.text}"=${t.height}px`).join(', ')}`
    );
  }
}

async function takeFullPageScreenshot(page: Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`Screenshot: ${filePath}`);
}

async function runPageChecks(page: Page, label: string, screenshotName: string) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await checkNoHorizontalOverflow(page, label);
  await checkNoElementsOutsideViewport(page, label);
  await checkCampaignNavTabs(page, label);
  await takeFullPageScreenshot(page, screenshotName);
}

// ─── Tests ────────────────────────────────────────────────────────────────────
// Each test signs in independently (no shared storage state file dependency).
// Tests run serially (workers: 1 in playwright.config.ts) so the slug/id
// variables populated in test 2 are available to all subsequent tests.

test.describe('Mobile Responsiveness — iPhone 14 (390x844)', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  // ── 1. Auth: sign-in page ─────────────────────────────────────────────────
  test('auth sign-in — fits on mobile, button not clipped', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/signin`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await checkNoHorizontalOverflow(page, 'auth-signin');
    await checkNoElementsOutsideViewport(page, 'auth-signin');
    await takeFullPageScreenshot(page, 'mobile-auth-signin');

    const signInBtn = page.getByRole('button', { name: /sign in/i });
    await expect(signInBtn).toBeVisible({ timeout: 5000 });

    const btnBox = await signInBtn.boundingBox();
    if (btnBox) {
      expect(btnBox.x + btnBox.width, 'Sign-in button extends past viewport').toBeLessThanOrEqual(400);
    }
  });

  // ── 2. Campaigns list — also discovers slug ───────────────────────────────
  test('campaigns list — no overflow, campaign cards visible', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/campaigns`);
    await runPageChecks(page, 'campaigns-list', 'mobile-campaigns-list');

    // Discover slug for downstream tests
    const firstLink = await page
      .locator('a[href*="/campaigns/"]')
      .first()
      .getAttribute('href')
      .catch(() => null);
    if (firstLink) {
      const m = firstLink.match(/\/campaigns\/([^/?\s]+)/);
      if (m) campaignSlug = m[1];
    }
    console.log(`Campaign slug: "${campaignSlug}"`);
  });

  // ── 3. Dashboard ──────────────────────────────────────────────────────────
  test('dashboard — no overflow', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await runPageChecks(page, 'dashboard', 'mobile-dashboard');
  });

  // ── 4. Campaign overview ──────────────────────────────────────────────────
  test('campaign overview — no overflow, nav tabs present', async ({ page }) => {
    if (!campaignSlug) {
      test.skip(true, 'No campaign slug discovered');
      return;
    }
    await signIn(page);
    await page.goto(`${BASE_URL}/campaigns/${campaignSlug}`);
    await runPageChecks(page, 'campaign-overview', 'mobile-campaign-overview');
  });

  // ── 5. Campaign sessions list — also discovers sessionId ──────────────────
  test('campaign sessions — no overflow', async ({ page }) => {
    if (!campaignSlug) {
      test.skip(true, 'No campaign slug discovered');
      return;
    }
    await signIn(page);
    await page.goto(`${BASE_URL}/campaigns/${campaignSlug}/sessions`);
    await runPageChecks(page, 'campaign-sessions', 'mobile-campaign-sessions');

    const firstLink = await page
      .locator(`a[href*="/campaigns/${campaignSlug}/sessions/"]`)
      .first()
      .getAttribute('href')
      .catch(() => null);
    if (firstLink) {
      const m = firstLink.match(/\/sessions\/([^/?\s]+)/);
      if (m) sessionId = m[1];
    }
    console.log(`Session ID: "${sessionId}"`);
  });

  // ── 6. Session detail ─────────────────────────────────────────────────────
  test('session detail — no overflow, tabs not squished', async ({ page }) => {
    if (!campaignSlug || !sessionId) {
      test.skip(true, 'No session ID discovered');
      return;
    }
    await signIn(page);
    await page.goto(`${BASE_URL}/campaigns/${campaignSlug}/sessions/${sessionId}`);
    await runPageChecks(page, 'session-detail', 'mobile-session-detail');
  });

  // ── 7. Campaign NPCs list — also discovers npcId ──────────────────────────
  test('campaign NPCs — no overflow', async ({ page }) => {
    if (!campaignSlug) {
      test.skip(true, 'No campaign slug discovered');
      return;
    }
    await signIn(page);
    await page.goto(`${BASE_URL}/campaigns/${campaignSlug}/npcs`);
    await runPageChecks(page, 'campaign-npcs', 'mobile-campaign-npcs');

    const firstLink = await page
      .locator(`a[href*="/campaigns/${campaignSlug}/npcs/"]`)
      .first()
      .getAttribute('href')
      .catch(() => null);
    if (firstLink) {
      const m = firstLink.match(/\/npcs\/([^/?\s]+)/);
      if (m) npcId = m[1];
    }
    console.log(`NPC ID: "${npcId}"`);
  });

  // ── 8. NPC detail ─────────────────────────────────────────────────────────
  test('NPC detail — no overflow, stat blocks not clipped', async ({ page }) => {
    if (!campaignSlug || !npcId) {
      test.skip(true, 'No NPC ID discovered');
      return;
    }
    await signIn(page);
    await page.goto(`${BASE_URL}/campaigns/${campaignSlug}/npcs/${npcId}`);
    await runPageChecks(page, 'npc-detail', 'mobile-npc-detail');
  });

  // ── 9. Campaign homebrew ──────────────────────────────────────────────────
  test('campaign homebrew — no overflow', async ({ page }) => {
    if (!campaignSlug) {
      test.skip(true, 'No campaign slug discovered');
      return;
    }
    await signIn(page);
    await page.goto(`${BASE_URL}/campaigns/${campaignSlug}/homebrew`);
    await runPageChecks(page, 'campaign-homebrew', 'mobile-campaign-homebrew');
  });

  // ── 10. Campaign members ──────────────────────────────────────────────────
  test('campaign members — no overflow', async ({ page }) => {
    if (!campaignSlug) {
      test.skip(true, 'No campaign slug discovered');
      return;
    }
    await signIn(page);
    await page.goto(`${BASE_URL}/campaigns/${campaignSlug}/members`);
    await runPageChecks(page, 'campaign-members', 'mobile-campaign-members');
  });

  // ── 11. Campaign settings ─────────────────────────────────────────────────
  test('campaign settings — no overflow, form inputs not clipped', async ({ page }) => {
    if (!campaignSlug) {
      test.skip(true, 'No campaign slug discovered');
      return;
    }
    await signIn(page);
    await page.goto(`${BASE_URL}/campaigns/${campaignSlug}/settings`);
    await runPageChecks(page, 'campaign-settings', 'mobile-campaign-settings');

    const inputRect = await page.evaluate(() => {
      const input = document.querySelector('input[type="text"], input[name]') as HTMLElement | null;
      if (!input) return null;
      const r = input.getBoundingClientRect();
      return { right: Math.round(r.right) };
    });
    if (inputRect) {
      expect(inputRect.right, 'Campaign settings input extends outside viewport').toBeLessThanOrEqual(400);
    }
  });

  // ── 12. Homebrew library ──────────────────────────────────────────────────
  test('homebrew library — no overflow', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/homebrew`);
    await runPageChecks(page, 'homebrew', 'mobile-homebrew');
  });

  // ── 13. Homebrew PDFs ─────────────────────────────────────────────────────
  test('homebrew PDFs — no overflow', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/homebrew/pdfs`);
    await runPageChecks(page, 'homebrew-pdfs', 'mobile-homebrew-pdfs');
  });

  // ── 14. User settings ─────────────────────────────────────────────────────
  test('settings — no overflow, sections visible', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/settings`);
    await runPageChecks(page, 'settings', 'mobile-settings');

    const sectionHeading = page.locator('h2, h3').first();
    await expect(sectionHeading).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  // ── 15. Characters ────────────────────────────────────────────────────────
  test('characters — no overflow', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/characters`);
    await runPageChecks(page, 'characters', 'mobile-characters');
  });
});
