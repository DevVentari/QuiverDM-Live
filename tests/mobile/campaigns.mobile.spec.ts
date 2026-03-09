import { test, expect } from '@playwright/test';
import { BASE_URL, signIn, pageChecks } from './helpers';

const SPEC = 'campaigns';

let campaignSlug = '';

test.describe('Campaigns — mobile', () => {
  test('campaigns list: no overflow, campaign cards render', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/campaigns`);

    await pageChecks(page, SPEC, SPEC, 'campaigns-list');

    const campaignContent = page
      .getByRole('heading', { name: /campaigns/i })
      .or(page.getByText(/your campaigns/i))
      .or(page.getByText(/no campaigns/i))
      .or(page.locator('a[href*="/campaigns/"]').first());
    await expect(campaignContent.first()).toBeVisible({ timeout: 10000 });

    const firstLink = await page
      .locator('a[href*="/campaigns/"]')
      .first()
      .getAttribute('href')
      .catch(() => null);
    if (firstLink) {
      const m = firstLink.match(/\/campaigns\/([^/?#\s]+)/);
      if (m) campaignSlug = m[1];
    }
    console.log(`Discovered campaign slug: "${campaignSlug}"`);
  });

  test('campaign detail: no overflow, nav works', async ({ page }) => {
    await signIn(page);

    if (!campaignSlug) {
      await page.goto(`${BASE_URL}/campaigns`);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      const firstLink = await page
        .locator('a[href*="/campaigns/"]')
        .first()
        .getAttribute('href')
        .catch(() => null);
      if (firstLink) {
        const m = firstLink.match(/\/campaigns\/([^/?#\s]+)/);
        if (m) campaignSlug = m[1];
      }
    }

    if (!campaignSlug) {
      test.skip(true, 'No campaign found for authenticated user');
      return;
    }

    await page.goto(`${BASE_URL}/campaigns/${campaignSlug}`);
    await pageChecks(page, SPEC, SPEC, 'campaign-detail');

    const navAccess = page
      .getByRole('link', { name: /overview|sessions|npcs|homebrew/i })
      .or(page.getByRole('button', { name: /menu|nav|sidebar/i }))
      .or(page.locator('[data-mobile-nav], [aria-label*="menu"]'))
      .first();
    await expect(navAccess).toBeVisible({ timeout: 8000 });
  });
});
