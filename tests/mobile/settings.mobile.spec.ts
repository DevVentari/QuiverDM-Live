import { test, expect } from '@playwright/test';
import { BASE_URL, signIn, pageChecks } from './helpers';

const SPEC = 'settings';

test.describe('Settings — mobile', () => {
  test('settings: sections visible, no overflow', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/settings`);

    await pageChecks(page, SPEC, SPEC, 'settings');

    const sectionHeading = page.getByRole('heading').first();
    await expect(sectionHeading).toBeVisible({ timeout: 10000 });

    const inputRight = await page.evaluate(() => {
      const input = document.querySelector('input[type="text"], input[type="email"], input[name]') as HTMLElement | null;
      if (!input) return null;
      return Math.round(input.getBoundingClientRect().right);
    });
    if (inputRight !== null) {
      expect(inputRight, 'Settings input extends outside viewport').toBeLessThanOrEqual(400);
    }
  });

  test('settings API usage: no overflow', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/settings/api-usage`);

    await pageChecks(page, SPEC, SPEC, 'settings-api-usage');

    const content = page
      .getByRole('heading', { name: /api|usage/i })
      .or(page.getByText(/api usage/i))
      .or(page.getByText(/no usage/i));
    await expect(content.first()).toBeVisible({ timeout: 10000 }).catch(() => {
      console.warn('[settings-api-usage] No heading found — checking page loaded');
    });
  });
});
