import { test, expect } from '@playwright/test';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 Settings — Phase 4 honesty. The integrations panel claimed "Discord voice ·
// live transcription", which never existed (Discord is outbound recap only). It
// now reflects reality: in-app session recording + transcription, and Discord as
// outbound summaries.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-integrations-qa';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('v3 — integrations honesty', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Integrations QA');
  });

  test('settings: integrations reflect real capabilities', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'honest-integrations', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/settings`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });

      // Real: in-app recording + transcription, and Discord as outbound recap.
      await expect(page.getByText('Session recording').first()).toBeVisible({ timeout: 12_000 });
      await expect(page.getByText('Discord recap').first()).toBeVisible({ timeout: 8_000 });

      // The old false claims must be gone.
      await expect(page.locator('body')).not.toContainText('Discord voice');
      await expect(page.locator('body')).not.toContainText(/connected · live transcription/i);
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
