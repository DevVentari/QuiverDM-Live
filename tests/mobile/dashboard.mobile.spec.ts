import { test, expect } from '@playwright/test';
import { BASE_URL, signIn, pageChecks } from './helpers';

const SPEC = 'dashboard';

test.describe('Dashboard — mobile', () => {
  test('dashboard: no overflow, nav links visible', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/dashboard`);

    await pageChecks(page, 'dashboard', SPEC, 'dashboard');

    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    const navLinks = page
      .locator('nav a, [role="navigation"] a')
      .or(page.locator('[aria-label*="nav"] a'))
      .or(page.locator('a[href*="/campaigns"], a[href*="/dashboard"], a[href*="/homebrew"]'));

    const count = await navLinks.count();
    expect(count, 'No nav links found on dashboard').toBeGreaterThan(0);
  });
});
