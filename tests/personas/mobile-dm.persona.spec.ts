import { test, expect, devices } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test.use({ ...devices['iPhone 13'] });

test.fixme('mobile-dm happy path: critical routes stay usable on phone viewport', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'mobile-sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  // TODO: verify mobile nav access and key actions on dashboard/campaign pages.
  await page.goto('/dashboard');
  await expect(page.getByRole('heading').first()).toContainText(/dashboard/i);
});

test.fixme('mobile-dm failure path: detect layout break on core actions', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'open-mobile-campaigns', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    await page.goto('/campaigns');
  }, 15_000);

  // TODO: assert key buttons are visible and not clipped/offscreen.
  await expect(page.getByRole('button').first()).toBeVisible();
});
