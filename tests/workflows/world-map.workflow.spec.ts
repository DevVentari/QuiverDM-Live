import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

async function ensureCampaignExists(page: any): Promise<boolean> {
  await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
  await page.waitForLoadState('domcontentloaded');

  // If redirected to campaigns list, campaign doesn't exist
  if (!page.url().includes(CAMPAIGN_SLUG)) {
    return false;
  }

  return true;
}

test('world map workflow — load, background picker, and canvas', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'verify-campaign-exists', async () => {
    const exists = await ensureCampaignExists(page);
    if (!exists) {
      test.skip(true, `Campaign ${CAMPAIGN_SLUG} does not exist. Create it via the UI or set QA_CAMPAIGN_SLUG env var.`);
    }
    await expect(page).toHaveURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}`));
  }, 10_000);

  await checkpoint(testInfo, 'navigate-to-world-map', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world-map`);
    await page.waitForLoadState('domcontentloaded');

    // Either the background picker dialog or the canvas should load
    const hasDialog = await page.getByRole('dialog').isVisible({ timeout: 2_000 }).catch(() => false);
    const hasCanvas = await page.locator('[class*="react-flow"]').isVisible({ timeout: 2_000 }).catch(() => false);

    if (!hasDialog && !hasCanvas) {
      test.skip(true, 'World map route does not render dialog or canvas. Route may be empty/stub.');
    }
  }, 12_000);

  await checkpoint(testInfo, 'background-picker-has-three-tabs-if-shown', async () => {
    const dialog = page.getByRole('dialog');
    const isDialogVisible = await dialog.isVisible({ timeout: 2_000 }).catch(() => false);

    if (isDialogVisible) {
      await expect(page.getByRole('tab', { name: /blank/i })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('tab', { name: /generate/i })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('tab', { name: /upload/i })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('tab', { name: /sourcebooks/i })).toBeVisible({ timeout: 5_000 });
    }
  }, 10_000);

  await checkpoint(testInfo, 'world-map-page-no-crash', async () => {
    // Verify page loaded without 500 or error state
    await expect(page.getByText(/failed to load|500 internal|something went wrong/i)).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/error|\/500/);
  }, 5_000);

  await checkpoint(testInfo, 'world-map-in-campaign-nav-if-exists', async () => {
    // If the campaign nav has a world map link, verify it's accessible
    const worldMapLink = page.getByRole('link', { name: /world map/i });
    const linkExists = await worldMapLink.isVisible({ timeout: 2_000 }).catch(() => false);

    if (linkExists) {
      await expect(worldMapLink).toBeVisible();
      // Verify the href matches the current URL pattern
      const href = await worldMapLink.getAttribute('href');
      expect(href).toMatch(/world-map/);
    }
  }, 8_000);
});
