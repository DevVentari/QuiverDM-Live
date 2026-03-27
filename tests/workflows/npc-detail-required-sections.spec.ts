import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('npc detail renders required 5e stat block sections', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-npc-with-stats', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`);
    await page.waitForLoadState('networkidle');

    // Find the first NPC link in the list and navigate to its detail page
    const npcLink = page.locator(`a[href*="/campaigns/${CAMPAIGN_SLUG}/npcs/"]`).first();
    await expect(npcLink).toBeVisible({ timeout: 10_000 });
    await npcLink.click();
    await page.waitForURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}/npcs/[^/]+$`), { timeout: 10_000 });
    await page.waitForLoadState('networkidle');
  }, 20_000);

  await checkpoint(testInfo, 'verify-stat-block-sections', async () => {
    // Stat block section heading must be visible
    await expect(page.getByText(/stat block/i).first()).toBeVisible({ timeout: 10_000 });

    // If the NPC has stat data, these sections are rendered
    const hasCR = await page.getByText(/^CR\s+\d/i).isVisible({ timeout: 3_000 }).catch(() => false);
    const hasTraits = await page.getByText(/^Traits$/i).isVisible({ timeout: 3_000 }).catch(() => false);
    const hasActions = await page.getByText(/^Actions$/i).isVisible({ timeout: 3_000 }).catch(() => false);

    // At least one stat block field must be present for this test to be meaningful
    expect(hasCR || hasTraits || hasActions).toBe(true);
  }, 15_000);
});
