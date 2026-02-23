import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

test.describe('Member invites', () => {
  test('members tab loads for DMs', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');

    const campaignLink = page.locator('a[href*="/campaigns/"]').first();
    if (await campaignLink.count() === 0) { test.skip(); return; }

    await campaignLink.click();
    await page.waitForLoadState('networkidle');

    // Members tab should be visible for DMs
    const membersLink = page.getByRole('link', { name: /members/i });
    await expect(membersLink).toBeVisible({ timeout: 10000 });
    await membersLink.click();
    await expect(page).toHaveURL(/members/);
  });

  test('invite dialog opens', async ({ page }) => {
    await signInAsTestUser(page);
    await page.goto('/campaigns');

    const campaignLink = page.locator('a[href*="/campaigns/"]').first();
    if (await campaignLink.count() === 0) { test.skip(); return; }

    await campaignLink.click();
    await page.getByRole('link', { name: /members/i }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /invite/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });
});
