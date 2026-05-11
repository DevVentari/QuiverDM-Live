import { expect, test } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Admin Overview Page', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    if (!page.url().includes('/admin')) {
      test.skip(true, 'Current user is not an admin; admin page redirected away.');
    }
  });

  test('page loads successfully', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /admin control over accounts, roles, and platform usage/i })).toBeVisible();
    await expect(page.getByText(/This console is separate from the player-facing app shell/i)).toBeVisible();
  });

  test('key navigation links are visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Manage Users/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Usage Tracker/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Return to dashboard/i })).toBeVisible();
  });

  test('overview cards render', async ({ page }) => {
    await expect(page.getByText(/Total Accounts/i)).toBeVisible();
    await expect(page.getByText(/Active Subscriptions/i)).toBeVisible();
    await expect(page.getByText(/30 Day API Cost/i)).toBeVisible();
  });
});
