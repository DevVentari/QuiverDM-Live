import { test, expect } from '@playwright/test';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 Homebrew — PDF import. The real path POSTs to /api/homebrew/upload-pdf
// (store + create record + queue extraction). The upload is mocked here so the
// test doesn't depend on storage/worker infra; the affordance + success wiring
// is what's under test.

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-homebrew-qa';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('v3 — homebrew PDF import', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Homebrew QA');
  });

  test('import: selecting a PDF uploads and reports background extraction', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'affordance-visible', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/homebrew`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.getByTestId('import-pdf')).toBeVisible({ timeout: 12_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'mocked-upload-succeeds', async () => {
      await page.route('**/api/homebrew/upload-pdf', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, pdf: { id: 'mock-pdf', filename: 'monsters.pdf', processingStatus: 'pending' } }),
        });
      });

      // Drive the hidden input directly (avoids the OS file picker).
      await page.getByTestId('pdf-file-input').setInputFiles({
        name: 'monsters.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 fake test pdf'),
      });

      await expect(page.getByText(/Imported — extracting/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 20_000);
  });
});
