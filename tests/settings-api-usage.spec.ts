import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Settings API Usage', () => {
  test('API usage page loads with header and no runtime JS errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signInAsTestUser(page);
    await page.goto('/settings/api-usage');
    await page.waitForLoadState('domcontentloaded');

    // Edge case: usage dashboard shell should render even with zero usage data.
    await expect(page.getByRole('heading', { name: /api usage/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/this period/i)).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('API usage page provides back navigation to settings', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings/api-usage');
    await page.waitForLoadState('domcontentloaded');

    // Edge case: back action should always return to settings.
    await page.locator('a[href="/settings"]').first().click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('API usage page shows either empty state or usage detail sections', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/settings/api-usage');
    await page.waitForLoadState('domcontentloaded');

    const emptyState = page.getByText(/no api usage recorded yet/i);
    if ((await emptyState.count()) > 0) {
      // Edge case: first-time users may have no usage history.
      await expect(emptyState.first()).toBeVisible({ timeout: 10000 });
      return;
    }

    // Edge case: active users should see at least one usage breakdown section.
    const usageByFeature = page.getByRole('heading', { name: /usage by feature/i });
    const usageByModel = page.getByRole('heading', { name: /usage by model/i });
    const recentCalls = page.getByRole('heading', { name: /recent api calls/i });
    const hasUsageSection =
      (await usageByFeature.count()) > 0 ||
      (await usageByModel.count()) > 0 ||
      (await recentCalls.count()) > 0;

    expect(hasUsageSection).toBe(true);
  });
});
