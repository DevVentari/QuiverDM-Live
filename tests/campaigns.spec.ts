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

  test('new campaign link is visible for authenticated users', async ({ page }) => {
    // Button asChild + Link renders as an <a> element
    await expect(
      page.getByRole('link', { name: /new campaign/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test('new campaign link navigates to create page', async ({ page }) => {
    await page.getByRole('link', { name: /new campaign/i }).first().click();
    await page.waitForURL(/\/campaigns\/new/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /new campaign/i })).toBeVisible({ timeout: 10000 });
  });

  test('campaign name is required', async ({ page }) => {
    await page.goto('/campaigns/new');
    // Fill with whitespace only — passes HTML5 required but fails Zod .min(1) after .trim()
    await page.getByRole('textbox', { name: /^name$/i }).fill('   ');
    await page.getByRole('button', { name: /create/i }).click();
    // Should show Zod validation error
    await expect(
      page.getByText(/required|name is required/i)
    ).toBeVisible({ timeout: 5000 });
  });
});
