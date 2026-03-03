import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test.fixme('error-resilience happy path: app recovers after transient API error', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  // TODO: intercept one critical API call with temporary 500, then allow retry success.
  // TODO: assert user can recover without page reload.
  await page.goto('/campaigns');
  await expect(page.getByRole('heading').first()).toContainText(/campaign/i);
});

test.fixme('error-resilience failure path: hard API failure surfaces clear user-facing error', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'open-failing-flow', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    await page.goto('/campaigns/new');
  }, 15_000);

  // TODO: force persistent API failure and assert explicit actionable error copy.
  await expect(page.getByRole('button', { name: /create campaign/i })).toBeVisible();
});
