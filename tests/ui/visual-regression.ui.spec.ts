/**
 * Visual regression tests using Playwright's built-in screenshot comparison.
 *
 * FIRST RUN: Execute with --update-snapshots to generate baselines.
 *   npx playwright test tests/ui/visual-regression.ui.spec.ts --update-snapshots
 *
 * Subsequent runs diff against the stored baseline in tests/ui/__snapshots__/.
 * Commit the snapshot files alongside the test.
 *
 * Tolerance: maxDiffPixels:200 to absorb minor font/anti-aliasing variation.
 */
import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

const BLAKE_EMAIL = process.env.QA_BLAKE_EMAIL ?? 'blake@test.local';
const JORDAN_EMAIL = process.env.QA_JORDAN_EMAIL ?? 'jordan@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'blakes-test-campaign';

const SNAP_OPTS = { maxDiffPixels: 200, animations: 'disabled' } as const;

test.describe('visual regression — key pages', () => {
  test('dashboard', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    // Mask dynamic content (timestamps, live counters) to reduce noise
    await expect(page).toHaveScreenshot('dashboard.png', {
      ...SNAP_OPTS,
      mask: [page.locator('time, [data-testid="timestamp"]')],
    });
  });

  test('campaigns list', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect(page).toHaveScreenshot('campaigns-list.png', SNAP_OPTS);
  });

  test('campaign overview', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect(page).toHaveScreenshot('campaign-overview.png', SNAP_OPTS);
  });

  test('sessions list', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect(page).toHaveScreenshot('sessions-list.png', SNAP_OPTS);
  });

  test('NPCs list', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect(page).toHaveScreenshot('npcs-list.png', SNAP_OPTS);
  });

  test('homebrew library', async ({ page }) => {
    await signInAsTestUser(page, JORDAN_EMAIL, PASSWORD);
    await page.goto('/homebrew');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect(page).toHaveScreenshot('homebrew-library.png', SNAP_OPTS);
  });

  test('characters list', async ({ page }) => {
    await signInAsTestUser(page, JORDAN_EMAIL, PASSWORD);
    await page.goto('/characters');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect(page).toHaveScreenshot('characters-list.png', SNAP_OPTS);
  });

  test('settings page', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect(page).toHaveScreenshot('settings.png', SNAP_OPTS);
  });
});

test.describe('visual regression — NPC detail stat block', () => {
  test('NPC detail with stat block', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`);
    await page.waitForLoadState('domcontentloaded');

    const firstNpc = page.locator('a[href*="/npcs/"]').first();
    if (await firstNpc.count() === 0) {
      test.skip(true, 'No NPCs — skipping NPC visual regression');
      return;
    }

    await firstNpc.click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect(page).toHaveScreenshot('npc-detail.png', SNAP_OPTS);
  });
});

test.describe('visual regression — character sheet', () => {
  test('character sheet overview tab', async ({ page }) => {
    await signInAsTestUser(page, JORDAN_EMAIL, PASSWORD);
    await page.goto('/characters');
    await page.waitForLoadState('domcontentloaded');

    const charLink = page
      .locator('a[href*="/characters/"]')
      .filter({ hasNot: page.locator('[href="/characters/new"]') })
      .first();

    if (await charLink.count() === 0) {
      test.skip(true, 'No characters — skipping character sheet visual regression');
      return;
    }

    await charLink.click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect(page).toHaveScreenshot('character-sheet-overview.png', SNAP_OPTS);
  });
});
