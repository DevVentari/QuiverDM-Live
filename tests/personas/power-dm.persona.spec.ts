import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const DANA_EMAIL = process.env.QA_DANA_EMAIL ?? 'dana@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test.fixme('power-dm happy path: high-volume create/edit plus homebrew import', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DANA_EMAIL, PASSWORD);
  }, 12_000);

  // TODO: batch-create/edit NPCs quickly.
  // TODO: import PDF and validate detail output.
  // TODO: verify campaign usage linkage from homebrew.
  await page.goto('/homebrew/pdfs');
  await expect(page.getByRole('heading', { name: /pdf processing/i })).toBeVisible();
});

test.fixme('power-dm failure path: heavy flow degradation is detected by checkpoint budget', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'open-heavy-surface', async () => {
    await signInAsTestUser(page, DANA_EMAIL, PASSWORD);
    await page.goto('/homebrew');
  }, 12_000);

  // TODO: add strict budget assertions for heavy pages and fail on regression.
  await expect(page.getByRole('heading').first()).toContainText(/homebrew/i);
});
