import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Settings Profile', () => {
  test('settings page shows profile section and role badge', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(/profile/i).first()).toBeVisible({ timeout: 10000 });

    const hasRoleBadge =
      (await page.getByText(/adventurer/i).count()) > 0 ||
      (await page.getByText(/dungeon master/i).count()) > 0 ||
      (await page.getByText(/warden/i).count()) > 0 ||
      (await page.getByText(/mythkeeper/i).count()) > 0;

    const hasPlanBadge =
      (await page.getByText(/wanderer/i).count()) > 0 ||
      (await page.getByText(/hero/i).count()) > 0 ||
      (await page.getByText(/fellowship/i).count()) > 0;

    expect(hasRoleBadge || hasPlanBadge).toBe(true);
    expect(pageErrors).toEqual([]);
  });

  test('settings API keys section shows Gemini free-tier badge', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(/google gemini api key/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/free tier/i)).toBeVisible();
  });

  test('settings exposes API usage entry point', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText(/view api usage/i)).toBeVisible({ timeout: 10000 });
  });
});
