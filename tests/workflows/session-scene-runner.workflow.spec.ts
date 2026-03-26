import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test.describe('Session Scene Runner', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  });

  test('prep wizard scenes step shows read-aloud textarea', async ({ page }, testInfo) => {
    test.slow();
    await checkpoint(testInfo, 'navigate-to-sessions', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    });

    await checkpoint(testInfo, 'open-prep', async () => {
      const prepLink = page.locator('a[href*="/prep"]').first();
      await expect(prepLink).toBeVisible({ timeout: 10000 });
      await prepLink.click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    });

    await checkpoint(testInfo, 'navigate-to-scenes', async () => {
      const scenesNav = page.getByText('Scenes', { exact: false }).first();
      await scenesNav.click();
      await page.waitForTimeout(500);
    });

    await checkpoint(testInfo, 'verify-read-aloud', async () => {
      await expect(page.locator('textarea[placeholder*="Read this aloud"]')).toBeVisible({ timeout: 5000 });
    });
  });

  test('prep wizard scenes step has Import from Sourcebook button', async ({ page }, testInfo) => {
    test.slow();
    await checkpoint(testInfo, 'navigate-to-sessions', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    });

    await checkpoint(testInfo, 'open-prep', async () => {
      const prepLink = page.locator('a[href*="/prep"]').first();
      await expect(prepLink).toBeVisible({ timeout: 10000 });
      await prepLink.click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    });

    await checkpoint(testInfo, 'navigate-to-scenes', async () => {
      const scenesNav = page.getByText('Scenes', { exact: false }).first();
      await scenesNav.click();
      await page.waitForTimeout(500);
    });

    await checkpoint(testInfo, 'verify-import-button', async () => {
      await expect(page.getByText('Import from Sourcebook')).toBeVisible({ timeout: 5000 });
    });
  });

  test('cockpit shows scene runner above live notes', async ({ page }, testInfo) => {
    test.slow();
    await checkpoint(testInfo, 'navigate-to-sessions', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    });

    const liveLink = page.locator('a[href*="/live"]').first();
    if (!(await liveLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await checkpoint(testInfo, 'open-cockpit', async () => {
      await liveLink.click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      await page.waitForTimeout(2000);
    });

    await checkpoint(testInfo, 'verify-scene-runner', async () => {
      const hasScenes = await page.locator('text=/Scene \\d+ of \\d+/').isVisible({ timeout: 5000 }).catch(() => false);
      const hasNoScenes = await page.getByText('No scenes prepared').isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasScenes || hasNoScenes).toBe(true);
    });
  });

  test('cockpit right panel has Scene tab', async ({ page }, testInfo) => {
    test.slow();
    await checkpoint(testInfo, 'navigate-to-sessions', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    });

    const liveLink = page.locator('a[href*="/live"]').first();
    if (!(await liveLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await checkpoint(testInfo, 'open-cockpit', async () => {
      await liveLink.click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    });

    await checkpoint(testInfo, 'verify-scene-tab', async () => {
      await expect(page.getByRole('tab', { name: 'Scene' })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('tab', { name: 'Prep' })).not.toBeVisible();
    });
  });

  test('scene navigation advances to next scene', async ({ page }, testInfo) => {
    test.slow();
    await checkpoint(testInfo, 'navigate-to-sessions', async () => {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    });

    const liveLink = page.locator('a[href*="/live"]').first();
    if (!(await liveLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await checkpoint(testInfo, 'open-cockpit', async () => {
      await liveLink.click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      await page.waitForTimeout(2000);
    });

    const sceneCounter = page.locator('text=/Scene \\d+ of \\d+/').first();
    if (!(await sceneCounter.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const initialText = await sceneCounter.textContent();
    const match = initialText?.match(/Scene (\d+) of (\d+)/);
    if (!match || parseInt(match[2]) < 2) {
      test.skip();
      return;
    }

    await checkpoint(testInfo, 'navigate-scene', async () => {
      const nextBtn = page.getByRole('button', { name: /Next/i }).first();
      await nextBtn.click();
      await page.waitForTimeout(500);
      const newText = await sceneCounter.textContent();
      expect(newText).toContain('Scene 2 of');
    });
  });
});
