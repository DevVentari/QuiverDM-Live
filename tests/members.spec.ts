import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

const CAMPAIGN_CARD = 'a[href^="/campaigns/"]:not([href="/campaigns/new"])';

async function getCampaignHref(page: Parameters<typeof signInAsTestUser>[0]): Promise<string | null> {
  await page.goto('/campaigns');
  await page.waitForLoadState('networkidle');
  const link = page.locator(CAMPAIGN_CARD).first();
  if (await link.count() === 0) return null;
  return link.getAttribute('href');
}

test.describe('Member invites', () => {
  test('members tab loads for DMs', async ({ page }) => {
    await signInAsTestUser(page);
    const href = await getCampaignHref(page);
    if (!href) { test.skip(); return; }

    await page.goto(`${href}/members`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/members/);
  });

  test('invite dialog opens', async ({ page }) => {
    await signInAsTestUser(page);
    const href = await getCampaignHref(page);
    if (!href) { test.skip(); return; }

    await page.goto(`${href}/members`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /invite/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });
});
