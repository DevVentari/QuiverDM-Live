import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

const CAMPAIGN_CARD = 'a[href^="/campaigns/"]:not([href="/campaigns/new"])';

async function getCampaignHref(page: Parameters<typeof signInAsTestUser>[0]): Promise<string | null> {
  await page.goto('/campaigns');
  await page.waitForLoadState('domcontentloaded');
  const link = page.locator(CAMPAIGN_CARD).first();
  if (await link.count() === 0) return null;
  return link.getAttribute('href');
}

test.describe('NPCs', () => {
  test('NPC list loads for a campaign', async ({ page }) => {
    await signInAsTestUser(page);
    const href = await getCampaignHref(page);
    if (!href) { test.skip(); return; }

    await page.goto(`${href}/npcs`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/npcs/);

    await expect(
      page.getByRole('heading', { name: /npcs/i })
        .or(page.getByText(/no npcs|add.*npc/i))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('NPC create button is visible for DMs', async ({ page }) => {
    await signInAsTestUser(page);
    const href = await getCampaignHref(page);
    if (!href) { test.skip(); return; }

    await page.goto(`${href}/npcs`);
    await page.waitForLoadState('domcontentloaded');

    // "New NPC" is rendered as a link (Button asChild + Link)
    await expect(
      page.getByRole('link', { name: /new npc/i })
        .or(page.getByRole('button', { name: /new npc|add npc|create npc/i }))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });
});
