import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test('campaign create redirects from new campaign form', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'open-new-campaign', async () => {
    await page.goto('/campaigns/new');
    await expect(page).toHaveURL('/campaigns/new');
    await expect(page.getByText('Campaign Identity')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/^name$/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/^description$/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /create campaign/i })).toBeEnabled();
  }, 8_000);

  await checkpoint(testInfo, 'submit-create-campaign', async () => {
    const uniqueName = `QA Campaign ${Date.now()}`;
    await page.getByLabel(/^name$/i).fill(uniqueName);
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+/, { timeout: 10_000 });
  }, 12_000);
});
