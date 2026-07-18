import { test, expect } from '@playwright/test';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// The v3 shell must paint the shared atmosphere on every DM surface: a layered,
// non-interactive backdrop (dual radial glows + grain + vignette) with a gentle
// breathing ember that respects prefers-reduced-motion.

const EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;

test.describe('v3 — shared atmosphere', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(EMAIL, PASSWORD);
  });

  test('backdrop layers render and breathe', async ({ page }, testInfo) => {
    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'backdrop-present', async () => {
      await page.goto('/v3');
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.getByText('Your worlds').first()).toBeVisible({ timeout: 12_000 });

      await expect(page.locator('.v3-atmosphere')).toHaveCount(1);
      await expect(page.locator('.v3-atmosphere .v3-ember')).toHaveCount(1);
      await expect(page.locator('.v3-atmosphere .v3-grain')).toHaveCount(1);
      await expect(page.locator('.v3-atmosphere .v3-vignette')).toHaveCount(1);
    }, 25_000);

    await checkpoint(testInfo, 'ember-breathes', async () => {
      const animName = await page
        .locator('.v3-ember')
        .first()
        .evaluate((el) => getComputedStyle(el as Element).animationName);
      expect(animName).toBe('v3-breathe');
    }, 15_000);
  });

  test('reduced motion stills the ember', async ({ page }, testInfo) => {
    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'no-animation-under-reduce', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/v3');
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.locator('.v3-ember')).toHaveCount(1);
      const animName = await page
        .locator('.v3-ember')
        .first()
        .evaluate((el) => getComputedStyle(el as Element).animationName);
      expect(animName).toBe('none');
    }, 25_000);
  });
});
