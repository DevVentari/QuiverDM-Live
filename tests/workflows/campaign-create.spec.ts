import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser, ensureTestUserExists } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test.beforeAll(async () => {
  await ensureTestUserExists(VIC_EMAIL, PASSWORD);
});

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

test('campaign create sheet - featured adventure seed creates and forges', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'select-featured-seed', async () => {
    await page.goto('/campaigns/new');
    await page.getByRole('textbox', { name: /campaign name/i }).fill(`Curse QA ${Date.now()}`);
    await page.getByRole('button', { name: /continue/i }).click();
    // The simplified sheet exposes featured adventures as preseed cards.
    await page.getByTestId('featured-seed-cos').click();
  }, 12_000);

  await checkpoint(testInfo, 'create-campaign', async () => {
    await page.getByRole('button', { name: /create campaign/i }).click();
    // Create now navigates to the sessions surface (the forge reveal), with an
    // optional ?forged=<seed> query param that the page strips after first paint.
    await page.waitForURL(/\/campaigns\/(?!new$)[^/]+\/sessions(\?forged=.*)?$/, { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/something went wrong|internal server error/i);
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
