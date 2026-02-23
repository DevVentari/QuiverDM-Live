import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Campaigns', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');
  });

  test('campaigns page loads', async ({ page }) => {
    // Either heading or empty state should be visible
    await expect(
      page.getByRole('heading', { name: /campaigns/i })
        .or(page.getByText(/no campaigns|create your first/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('new campaign button is visible for authenticated users', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /new campaign|create campaign/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test('campaign create dialog opens', async ({ page }) => {
    await page.getByRole('button', { name: /new campaign|create campaign/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('campaign name is required', async ({ page }) => {
    await page.getByRole('button', { name: /new campaign|create campaign/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /create/i }).click();
    // Should show validation error
    await expect(
      page.getByText(/required|name is required/i)
    ).toBeVisible({ timeout: 5000 });
  });
});
