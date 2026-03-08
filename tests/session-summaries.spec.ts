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

test.describe('Session Summaries', () => {
  test('summaries page loads without errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await signInAsTestUser(page);
    const href = await getCampaignHref(page);
    if (!href) { test.skip(true, 'No campaigns available for test user.'); return; }

    await page.goto(`${href}/summaries`);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('heading', { name: /session summaries/i })
        .or(page.getByText(/no summaries|no sessions/i))
    ).toBeVisible({ timeout: 15000 });

    expect(pageErrors).toEqual([]);
  });

  test('summaries show session cards or empty state', async ({ page }) => {
    await signInAsTestUser(page);
    const href = await getCampaignHref(page);
    if (!href) { test.skip(true, 'No campaigns available.'); return; }

    await page.goto(`${href}/summaries`);
    await page.waitForLoadState('domcontentloaded');

    const summaryCards = page.locator('[class*="card"], [data-testid*="summary"]');
    const emptyState = page.getByText(/no summaries|no sessions|generate a summary/i);

    const hasCards = await summaryCards.first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasCards || hasEmpty).toBeTruthy();
  });
});
