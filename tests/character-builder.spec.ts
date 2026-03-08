import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Character Builder', () => {
  test('new character builder loads core tabs and actions', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters/new');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('tab', { name: /details/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: /race/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /class/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /background/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /scores/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create character/i })).toBeVisible();
  });

  test('race class and background selections update preview', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters/new');
    await page.waitForLoadState('domcontentloaded');

    const name = `E2E Builder ${Date.now()}`;
    await page.getByLabel(/^name\b/i).fill(name);

    await page.getByRole('tab', { name: /race/i }).click();
    await page.getByRole('button', { name: /^human$/i }).first().click();

    await page.getByRole('tab', { name: /class/i }).click();
    await page.getByRole('button', { name: /^fighter$/i }).first().click();

    await page.getByRole('tab', { name: /background/i }).click();
    await page.getByRole('button', { name: /^acolyte$/i }).first().click();

    await expect(page.getByText(name).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/human/i).first()).toBeVisible();
    await expect(page.getByText(/fighter/i).first()).toBeVisible();
    await expect(page.getByText(/acolyte/i).first()).toBeVisible();
  });

  test('ability score mode switching works and create submits', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/characters/new');
    await page.waitForLoadState('domcontentloaded');

    const characterName = `E2E Character ${Date.now()}`;
    await page.getByLabel(/^name\b/i).fill(characterName);

    await page.getByRole('tab', { name: /scores/i }).click();
    await page.getByRole('button', { name: /point buy/i }).click();
    await expect(page.getByText(/points remaining:\s*27\s*\/\s*27/i)).toBeVisible({ timeout: 5000 });

    await page.locator('button').filter({ hasText: '+' }).first().click();
    await expect(page.getByText(/points remaining:\s*26\s*\/\s*27/i)).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /^manual$/i }).click();
    const numberInputs = page.locator('input[type="number"]');
    await expect(numberInputs.first()).toBeVisible({ timeout: 5000 });
    await numberInputs.first().fill('16');

    await page.getByRole('button', { name: /create character/i }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/characters\/[a-zA-Z0-9_-]+$/, { timeout: 20000 });
    await expect(page.getByRole('heading').first()).toContainText(/e2e character/i, { timeout: 10000 });
  });
});
