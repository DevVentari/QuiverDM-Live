import { test, expect } from '@playwright/test';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 global search — the ⌘K command palette (search.global). Results come from
// MeiliSearch (environmental), so this asserts the palette mechanics: opens from
// the header trigger and the keyboard shortcut, accepts a query, and closes on
// Escape — all without crashing.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-search-qa';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('v3 — global command bar', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Search QA');
  });

  test('command bar: opens, searches, and closes', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'trigger-opens-palette', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/overview`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });

      await expect(page.getByTestId('v3-search-trigger')).toBeVisible({ timeout: 12_000 });
      await page.getByTestId('v3-search-trigger').click();
      await expect(page.getByTestId('v3-search-input')).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'query-runs-and-escape-closes', async () => {
      // A short query shows the prompt; a real query runs the search (results may
      // be empty depending on the index) without crashing.
      await page.getByTestId('v3-search-input').fill('strahd');
      await page.waitForTimeout(600); // debounce + query
      await expect(page.locator('body')).not.toContainText(NO_CRASH);

      await page.keyboard.press('Escape');
      await expect(page.getByTestId('v3-search-input')).toBeHidden({ timeout: 8_000 });
    }, 20_000);

    await checkpoint(testInfo, 'keyboard-shortcut-opens', async () => {
      await page.keyboard.press('Control+k');
      await expect(page.getByTestId('v3-search-input')).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 15_000);
  });
});
