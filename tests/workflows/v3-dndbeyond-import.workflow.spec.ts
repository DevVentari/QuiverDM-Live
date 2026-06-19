import { test, expect } from '@playwright/test';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 Characters — D&D Beyond import affordance. The real import hits DDB over the
// network, so the success path is mocked at the tRPC layer; the affordance itself
// (DM-gated button → URL panel) is exercised against the real page.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-ddb-qa';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('v3 — D&D Beyond character import', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    // Vic is OWNER → isDM true → the import affordance shows.
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 DDB QA');
  });

  test('import: DM sees the affordance and a mocked import closes the panel', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'affordance-opens', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/characters`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      const btn = page.getByRole('button', { name: /Import from D&D Beyond/i });
      await expect(btn.first()).toBeVisible({ timeout: 12_000 });
      await btn.first().click();
      // The URL input appears.
      await expect(page.getByPlaceholder(/dndbeyond\.com\/characters/i)).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'mocked-import-succeeds', async () => {
      // Mock the import mutation so we don't call D&D Beyond. tRPC batch shape.
      await page.route('**/api/trpc/charactersDndBeyond.importCharacter**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ result: { data: { id: 'mock-char', name: 'Imported Hero' } } }]),
        });
      });

      await page.getByPlaceholder(/dndbeyond\.com\/characters/i).fill('https://www.dndbeyond.com/characters/123456');
      await page.getByRole('button', { name: /^Import$/ }).click();

      // On success the panel closes — the URL input disappears.
      await expect(page.getByPlaceholder(/dndbeyond\.com\/characters/i)).toBeHidden({ timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 20_000);
  });
});
