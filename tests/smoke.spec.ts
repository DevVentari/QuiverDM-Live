import { test, expect, Page } from '@playwright/test';

const APP_URL = process.env.QA_APP_URL ?? 'http://localhost:3847';
const DANA_EMAIL = process.env.QA_DANA_EMAIL ?? 'dana@test.local';
const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

async function signInAs(page: Page, email: string, password: string) {
  await page.goto(`${APP_URL}/auth/signin`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/dashboard|campaigns/, { timeout: 15_000 });
}

test('sign-in redirects to dashboard', async ({ page }) => {
  await signInAs(page, DANA_EMAIL, PASSWORD);
  await expect(page).toHaveURL(/dashboard/);
});

test('dashboard renders campaign section', async ({ page }) => {
  await signInAs(page, VIC_EMAIL, PASSWORD);
  await expect(page.getByText(/campaign/i).first()).toBeVisible({ timeout: 10_000 });
});

test('campaign detail page loads', async ({ page }) => {
  await signInAs(page, VIC_EMAIL, PASSWORD);
  await page.goto(`${APP_URL}/campaigns/vics-test-campaign`);
  await expect(page).toHaveURL(/vics-test-campaign/);
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
});

test('campaign NPC section is accessible', async ({ page }) => {
  await signInAs(page, VIC_EMAIL, PASSWORD);
  await page.goto(`${APP_URL}/campaigns/vics-test-campaign/npcs`);
  await expect(page).toHaveURL(/npcs/);
  await expect(page.locator('body')).not.toContainText('500');
});

test('homebrew page loads', async ({ page }) => {
  await signInAs(page, VIC_EMAIL, PASSWORD);
  await page.goto(`${APP_URL}/campaigns/vics-test-campaign/homebrew`);
  await expect(page).toHaveURL(/homebrew/);
  await expect(page.locator('body')).not.toContainText('500');
});
