import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('NPCs', () => {
  test('NPC list loads for a campaign', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');

    const campaignLink = page.locator('a[href*="/campaigns/"]').first();
    if (await campaignLink.count() === 0) { test.skip(); return; }

    await campaignLink.click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: /npcs/i }).click();
    await expect(page).toHaveURL(/npcs/);

    await expect(
      page.getByRole('heading', { name: /npcs/i })
        .or(page.getByText(/no npcs|add.*npc/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('NPC create button is visible for DMs', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');

    const campaignLink = page.locator('a[href*="/campaigns/"]').first();
    if (await campaignLink.count() === 0) { test.skip(); return; }

    await campaignLink.click();
    await page.getByRole('link', { name: /npcs/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('button', { name: /new npc|add npc|create npc/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
