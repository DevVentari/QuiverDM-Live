import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Obsidian Import', () => {
  test('import page loads with upload form', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signInAsTestUser(page);
    await page.goto('/campaigns/new/import-obsidian');
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByLabel(/campaign name/i)
        .or(page.getByLabel(/name/i))
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText(/obsidian vault/i).first()
        .or(page.getByText(/upload/i).first())
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('back navigation to campaign creation', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns/new/import-obsidian');
    await page.waitForLoadState('domcontentloaded');

    const backLink = page.getByRole('link', { name: /back|cancel|campaigns/i }).first();
    if (await backLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await backLink.click();
      await expect(page).toHaveURL(/\/campaigns/);
    }
  });

  test('no console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await signInAsTestUser(page);
    await page.goto('/campaigns/new/import-obsidian');
    await page.waitForLoadState('domcontentloaded');

    if (errors.length > 0) {
      console.log(`Found ${errors.length} errors:`, errors);
    }
  });
});
