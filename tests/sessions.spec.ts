import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Sessions', () => {
  test('sessions tab is accessible from a campaign', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');

    // Find first campaign link
    const campaignLink = page.locator('a[href*="/campaigns/"]').first();
    const hasCampaign = await campaignLink.count() > 0;
    if (!hasCampaign) {
      test.skip(); // No campaigns to test with
      return;
    }

    await campaignLink.click();
    await page.waitForLoadState('networkidle');

    // Click Sessions tab
    await page.getByRole('link', { name: /sessions/i }).click();
    await expect(page).toHaveURL(/sessions/);
    await expect(
      page.getByRole('heading', { name: /sessions/i })
        .or(page.getByText(/no sessions|new session/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('new session button is visible for DMs', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');

    const campaignLink = page.locator('a[href*="/campaigns/"]').first();
    if (await campaignLink.count() === 0) { test.skip(); return; }

    await campaignLink.click();
    await page.getByRole('link', { name: /sessions/i }).click();
    await page.waitForLoadState('networkidle');

    // DM should see "New Session" button
    await expect(
      page.getByRole('button', { name: /new session/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
