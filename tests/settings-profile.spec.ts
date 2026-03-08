import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Settings Profile', () => {
  test('settings page shows profile role badge and plan badge without runtime JS errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Edge case: profile identity and tier context should always be visible on settings load.
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/profile/i)).toBeVisible();
    await expect(page.getByText(/adventurer|dungeon master|warden|mythkeeper/i)).toBeVisible();
    await expect(page.getByText(/wanderer|hero|fellowship/i)).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('settings API keys section shows Gemini free-tier badge', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Edge case: Gemini key guidance badge should remain visible for onboarding context.
    await expect(page.getByText(/google gemini api key/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/free tier/i)).toBeVisible();
  });

  test('settings exposes API usage entry point', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    // Edge case: users must always be able to reach API usage diagnostics from settings.
    await expect(page.getByRole('button', { name: /view api usage/i })).toBeVisible({ timeout: 10000 });
  });
});
