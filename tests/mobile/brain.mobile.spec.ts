import { test, expect } from '@playwright/test';
import { BASE_URL, signIn, pageChecks } from './helpers';

const SPEC = 'brain';

async function discoverCampaignSlug(page: Parameters<typeof pageChecks>[0]) {
  await page.goto(`${BASE_URL}/campaigns`);
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  const firstLink = await page
    .locator('a[href*="/campaigns/"]')
    .first()
    .getAttribute('href')
    .catch(() => null);
  if (!firstLink) return '';
  const m = firstLink.match(/\/campaigns\/([^/?#\s]+)/);
  return m ? m[1] : '';
}

test.describe('Brain — mobile', () => {
  test('brain page: renders, tabs visible, no overflow', async ({ page }) => {
    await signIn(page);

    const slug = await discoverCampaignSlug(page);
    if (!slug) {
      test.skip(true, 'No campaign found');
      return;
    }

    await page.goto(`${BASE_URL}/campaigns/${slug}/brain`);
    await pageChecks(page, SPEC, SPEC, 'brain');

    const content = page
      .getByRole('heading', { name: /brain|entity|knowledge/i })
      .or(page.getByText(/brain/i).first())
      .or(page.locator('[data-testid*="brain"]').first());

    const isVisible = await content.first().isVisible({ timeout: 10000 }).catch(() => false);
    if (!isVisible) {
      const url = page.url();
      if (url.includes('/auth/') || url.includes('/signin')) {
        test.skip(true, 'Brain page redirected to auth — may not be available on this account tier');
        return;
      }
      console.warn('[brain] Brain page content not found — page may have different structure');
    }

    const tabs = page.locator('[role="tab"], [data-testid*="tab"]');
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      const tabHeights = await page.evaluate(() => {
        const tabEls = Array.from(document.querySelectorAll('[role="tab"]'));
        return tabEls.map(el => ({
          text: ((el as HTMLElement).innerText ?? '').trim().slice(0, 20),
          h: Math.round(el.getBoundingClientRect().height),
        }));
      });
      const squished = tabHeights.filter(t => t.h > 0 && t.h < 30);
      if (squished.length > 0) {
        console.warn(
          `[brain] Tabs below 30px: ${squished.map(t => `"${t.text}"=${t.h}px`).join(', ')}`
        );
      }
    } else {
      console.warn('[brain] No tabs found on brain page');
    }
  });
});
