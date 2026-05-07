import { test, expect } from '@playwright/test';
import { signInAsTestUser } from './helpers/auth';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_CARD = 'a[href^="/campaigns/"]:not([href="/campaigns/new"])';

async function getCampaignHref(page: Parameters<typeof signInAsTestUser>[0]): Promise<string | null> {
  await page.goto('/campaigns');
  await page.waitForLoadState('domcontentloaded');
  const link = page.locator(CAMPAIGN_CARD).first();
  if (await link.count() === 0) return null;
  return link.getAttribute('href');
}

test.describe('Sessions', () => {
  test('sessions tab is accessible from a campaign', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    const href = await getCampaignHref(page);
    if (!href) { test.skip(); return; }

    await page.goto(`${href}/sessions`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/sessions/);
    await expect(
      page.getByRole('heading', { name: /sessions/i })
        .or(page.getByText(/no sessions|new session/i))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('new session button is visible for DMs', async ({ page }) => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    const href = await getCampaignHref(page);
    if (!href) { test.skip(); return; }

    await page.goto(`${href}/sessions`);
    await page.waitForLoadState('domcontentloaded');

    // DM should see "New Session" link (renders as <Link>, not <button>)
    await expect(
      page.getByRole('link', { name: /new session/i })
        .or(page.getByRole('button', { name: /new session/i }))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });
});
