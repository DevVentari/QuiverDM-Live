import { expect, test } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

test('admin console workflow — overview to user detail to usage tracker', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page);
  }, 15_000);

  await checkpoint(testInfo, 'open-admin-overview', async () => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    if (!page.url().includes('/admin')) {
      test.skip(true, 'Current user is not an admin; admin page redirected away.');
    }

    await expect(page.getByText(/Platform Overview/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /Manage Users/i })).toBeVisible();
  }, 12_000);

  await checkpoint(testInfo, 'nav-has-health-link', async () => {
    await expect(page.getByRole('link', { name: /Health/i })).toBeVisible();
  }, 5_000);

  await checkpoint(testInfo, 'charts-render', async () => {
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'open-users', async () => {
    await page.getByRole('link', { name: /Manage Users/i }).click();
    await expect(page).toHaveURL(/\/admin\/users$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  }, 10_000);

  await checkpoint(testInfo, 'users-table-has-checkboxes', async () => {
    await expect(page.locator('table thead th input[type="checkbox"], table thead th [role="checkbox"]').first()).toBeVisible({ timeout: 8_000 });
  }, 8_000);

  await checkpoint(testInfo, 'open-detail-if-row-exists', async () => {
    const firstDetailLink = page.locator('table tbody tr a[href^="/admin/users/"]').first();
    if (!(await firstDetailLink.isVisible().catch(() => false))) {
      test.skip(true, 'No admin user row rendered.');
    }
    await firstDetailLink.click();
    await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/, { timeout: 10_000 });
    await expect(page.getByText(/Database-backed account inspection/i)).toBeVisible({ timeout: 10_000 });
  }, 12_000);

  await checkpoint(testInfo, 'open-usage-tracker', async () => {
    await page.goto('/admin/api-usage');
    await expect(page.getByRole('heading', { name: /Platform API Usage/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Cost and usage across all users/i)).toBeVisible();
  }, 12_000);

  await checkpoint(testInfo, 'open-health-page', async () => {
    await page.goto('/admin/health');
    await expect(page.getByRole('heading', { name: /Queue Depths/i })).toBeVisible({ timeout: 12_000 });
    await expect(page.getByText(/Database Tables/i)).toBeVisible();
  }, 15_000);
});
