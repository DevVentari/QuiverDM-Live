import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Settings API Usage', () => {
  test('API usage page loads with header and no runtime JS errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signInAsTestUser(page);
    await page.goto('/settings/api-usage');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /api usage/i })).toBeVisible({ timeout: 10000 });
    expect(pageErrors).toEqual([]);
  });

  test('API usage page provides back navigation to settings', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings/api-usage');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('a[href="/settings"]').first().click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('API usage page shows either empty state or usage detail sections', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings/api-usage');
    await page.waitForLoadState('domcontentloaded');

    const emptyState = page.getByText(/no api usage recorded yet/i);
    if ((await emptyState.count()) > 0) {
      await expect(emptyState.first()).toBeVisible({ timeout: 10000 });
      return;
    }

    const usageByFeature = page.getByText(/usage by feature/i);
    const usageByModel = page.getByText(/usage by model/i);
    const recentCalls = page.getByText(/recent api calls/i);
    const hasUsageSection =
      (await usageByFeature.count()) > 0 ||
      (await usageByModel.count()) > 0 ||
      (await recentCalls.count()) > 0;

    expect(hasUsageSection).toBe(true);
  });
});
