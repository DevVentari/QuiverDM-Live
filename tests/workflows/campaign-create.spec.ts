import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test('campaign create sheet - original campaign path creates and redirects', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'open-sheet', async () => {
    await page.goto('/campaigns/new');
    await expect(page).toHaveURL(/\/campaigns(\?create=true)?$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /new campaign/i })).toBeVisible({ timeout: 10_000 });
  }, 8_000);

  await checkpoint(testInfo, 'fill-and-create', async () => {
    const uniqueName = `QA Campaign ${Date.now()}`;
    await page.getByRole('textbox', { name: /campaign name/i }).fill(uniqueName);
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+/, { timeout: 15_000 });
  }, 20_000);
});

test('campaign create sheet - published adventure seeds brain-visible data', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'select-template', async () => {
    await page.goto('/campaigns/new');
    await page.getByRole('textbox', { name: /campaign name/i }).fill(`Curse QA ${Date.now()}`);
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /curse of strahd/i }).click();
    await expect(page.locator('input#startingLocation')).toHaveValue(/Barovia/i);
    await expect(page.locator('input#antagonistName')).toHaveValue(/Strahd/i);
  }, 12_000);

  await checkpoint(testInfo, 'create-campaign', async () => {
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+/, { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'seed-visible-in-brain', async () => {
    const campaignUrl = page.url().replace(/\/$/, '');
    await page.goto(`${campaignUrl}/brain`);
    await expect(page.getByText(/DM Brain/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Open Hooks/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).toContainText(/Strahd von Zarovich|Village of Barovia|Order of the Silver Dragon/i, { timeout: 10_000 });
    await expect(page.locator('body')).toContainText(/mist-shrouded realm of Barovia/i, { timeout: 10_000 });
  }, 20_000);
});

test('campaign create sheet - create without name shows validation error', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'open-create-form', async () => {
    await page.goto('/campaigns/new');
    await expect(page.getByRole('heading', { name: /new campaign/i })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page.getByText('Campaign name is required')).toBeVisible({ timeout: 3_000 });
    await expect(page).toHaveURL(/\/campaigns(\?create=true)?$/);
  }, 8_000);
});
