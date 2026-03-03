import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const NORA_EMAIL = process.env.QA_NORA_EMAIL ?? 'nora@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test.fixme('new-dm happy path: onboarding to first campaign and first npc', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, NORA_EMAIL, PASSWORD);
  }, 15_000);

  // TODO: complete onboarding
  // TODO: create first campaign
  // TODO: create first NPC without stat block
  // TODO: assert confirmatory success UI copy for first-time user
  await expect(page).toHaveURL(/dashboard|campaigns|onboarding/);
});

test.fixme('new-dm failure path: invalid first campaign submit shows validation', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'open-campaign-form', async () => {
    await signInAsTestUser(page, NORA_EMAIL, PASSWORD);
    await page.goto('/campaigns/new');
  }, 15_000);

  // TODO: submit empty/invalid form and assert user-friendly guidance.
  await expect(page.getByRole('button', { name: /create campaign/i })).toBeVisible();
});
