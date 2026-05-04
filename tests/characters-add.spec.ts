import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Character Add Sheet', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters');
  });

  test('Add Character button opens the sheet', async ({ page }) => {
    await page.getByRole('button', { name: /add character/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/import from d&d beyond/i)).toBeVisible();
    await expect(page.getByText(/or create manually/i)).toBeVisible();
  });

  test('sheet opens via ?create=true URL param', async ({ page }) => {
    await page.goto('/characters?create=true');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });

  test('/characters/new redirects to /characters?create=true', async ({ page }) => {
    await page.goto('/characters/new');
    await page.waitForURL(/\/characters\?create=true/, { timeout: 5000 });
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });

  test('manual create requires a name', async ({ page }) => {
    await page.goto('/characters?create=true');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel(/name/i)).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: /^create character$/i }).click();
    await expect(page.getByText(/name is required/i)).toBeVisible({ timeout: 3000 });
  });

  test('closing the sheet clears the URL param', async ({ page }) => {
    await page.goto('/characters?create=true');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForURL(/\/characters$/, { timeout: 3000 });
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
