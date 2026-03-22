import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test('campaign create wizard — original campaign path, create redirects', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'open-wizard', async () => {
    await page.goto('/campaigns/new');
    await expect(page).toHaveURL('/campaigns/new');
    await expect(page.getByText('Choose your path')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Published Adventure')).toBeVisible();
    await expect(page.getByText('Original Campaign')).toBeVisible();
  }, 8_000);

  await checkpoint(testInfo, 'step1-original', async () => {
    await page.getByText('Original Campaign').click();
    const nextBtn = page.getByRole('button', { name: /^next$/i });
    await expect(nextBtn).toBeEnabled({ timeout: 3_000 });
    await nextBtn.click();
  }, 5_000);

  await checkpoint(testInfo, 'step2-skip', async () => {
    await expect(page.getByText('Import your party')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Skip for now').click();
  }, 5_000);

  await checkpoint(testInfo, 'step3-fill-name', async () => {
    await expect(page.getByText('World setup')).toBeVisible({ timeout: 5_000 });
    const uniqueName = `QA Campaign ${Date.now()}`;
    await page.getByLabel(/campaign name/i).fill(uniqueName);
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 5_000);

  await checkpoint(testInfo, 'step4-create', async () => {
    await expect(page.getByText('Confirm & create')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Original Campaign')).toBeVisible();
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+/, { timeout: 15_000 });
  }, 20_000);
});

test('campaign create wizard — published adventure pre-fills step 3', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'step1-published', async () => {
    await page.goto('/campaigns/new');
    await page.getByText('Published Adventure').click();
    await expect(page.getByPlaceholder('Search adventures...')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Curse of Strahd').first().click();
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 10_000);

  await checkpoint(testInfo, 'step2-skip', async () => {
    await expect(page.getByText('Import your party')).toBeVisible({ timeout: 5_000 });
    await page.getByText('Skip for now').click();
  }, 5_000);

  await checkpoint(testInfo, 'step3-prefilled', async () => {
    await expect(page.getByText('World setup')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByLabel(/campaign name/i)).toHaveValue('Curse of Strahd', { timeout: 3_000 });
    await expect(page.locator('input#startingLocation')).toHaveValue(/Barovia/i);
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 8_000);

  await checkpoint(testInfo, 'step4-create', async () => {
    await expect(page.getByText('Confirm & create')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Curse of Strahd').first()).toBeVisible();
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+/, { timeout: 15_000 });
  }, 20_000);
});

test('campaign create wizard — adventure search filter works', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'search-filter', async () => {
    await page.goto('/campaigns/new');
    await page.getByText('Published Adventure').click();
    await expect(page.getByPlaceholder('Search adventures...')).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder('Search adventures...').fill('Dragon Heist');
    await expect(page.getByText('Waterdeep: Dragon Heist')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText('Curse of Strahd')).not.toBeVisible();
  }, 8_000);
});

test('campaign create wizard — create without name shows validation error', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-step4', async () => {
    await page.goto('/campaigns/new');
    await page.getByText('Original Campaign').click();
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByText('Skip for now').click();
    await expect(page.getByText('World setup')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /^next$/i }).click();
  }, 10_000);

  await checkpoint(testInfo, 'create-without-name', async () => {
    await expect(page.getByText('Confirm & create')).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page.getByText('Campaign name is required')).toBeVisible({ timeout: 3_000 });
    await expect(page).toHaveURL('/campaigns/new');
  }, 8_000);
});
