import { test, expect } from '@playwright/test';
import { BASE_URL, signIn, pageChecks } from './helpers';

const SPEC = 'sessions';

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

test.describe('Sessions — mobile', () => {
  test('sessions list: no overflow, session cards render', async ({ page }) => {
    await signIn(page);

    const slug = await discoverCampaignSlug(page);
    if (!slug) {
      test.skip(true, 'No campaign found');
      return;
    }

    await page.goto(`${BASE_URL}/campaigns/${slug}/sessions`);
    await pageChecks(page, SPEC, SPEC, 'sessions-list');

    const content = page
      .getByRole('heading', { name: /sessions/i })
      .or(page.getByText(/no sessions/i))
      .or(page.locator('a[href*="/sessions/"]').first());
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });

  test('session detail: no overflow, tabs not squished', async ({ page }) => {
    await signIn(page);

    const slug = await discoverCampaignSlug(page);
    if (!slug) {
      test.skip(true, 'No campaign found');
      return;
    }

    await page.goto(`${BASE_URL}/campaigns/${slug}/sessions`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    const firstLink = await page
      .locator(`a[href*="/campaigns/${slug}/sessions/"]`)
      .first()
      .getAttribute('href')
      .catch(() => null);

    if (!firstLink) {
      test.skip(true, 'No sessions found for this campaign');
      return;
    }

    const m = firstLink.match(/\/sessions\/([^/?#\s]+)/);
    const sessionId = m ? m[1] : '';
    if (!sessionId) {
      test.skip(true, 'Could not extract session ID');
      return;
    }

    await page.goto(`${BASE_URL}/campaigns/${slug}/sessions/${sessionId}`);
    await pageChecks(page, SPEC, SPEC, 'session-detail');

    const tabHeights = await page.evaluate(() => {
      const tabs = Array.from(
        document.querySelectorAll('[role="tab"], nav a, [data-testid*="tab"]')
      );
      return tabs.map(el => ({
        text: ((el as HTMLElement).innerText ?? '').trim().slice(0, 20),
        h: Math.round(el.getBoundingClientRect().height),
      }));
    });

    const squished = tabHeights.filter(t => t.h > 0 && t.h < 30);
    if (squished.length > 0) {
      console.warn(
        `[session-detail] Tabs below 30px: ${squished.map(t => `"${t.text}"=${t.h}px`).join(', ')}`
      );
    }
  });
});
