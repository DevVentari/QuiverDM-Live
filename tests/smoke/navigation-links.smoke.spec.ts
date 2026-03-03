import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const QA_TEST_PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

const TOP_LEVEL_ROUTES = [
  { path: '/dashboard', label: 'dashboard' },
  { path: '/campaigns', label: 'campaigns' },
  { path: '/characters', label: 'characters' },
  { path: '/homebrew', label: 'homebrew' },
  { path: '/homebrew/pdfs', label: 'homebrew-pdfs' },
  { path: '/settings', label: 'settings' },
];

const CAMPAIGN_ROUTES = [
  { path: `/campaigns/${CAMPAIGN_SLUG}`, label: 'campaign-overview' },
  { path: `/campaigns/${CAMPAIGN_SLUG}/sessions`, label: 'campaign-sessions' },
  { path: `/campaigns/${CAMPAIGN_SLUG}/npcs`, label: 'campaign-npcs' },
  { path: `/campaigns/${CAMPAIGN_SLUG}/members`, label: 'campaign-members' },
  { path: `/campaigns/${CAMPAIGN_SLUG}/homebrew`, label: 'campaign-homebrew' },
  { path: `/campaigns/${CAMPAIGN_SLUG}/summaries`, label: 'campaign-summaries' },
  { path: `/campaigns/${CAMPAIGN_SLUG}/encounters`, label: 'campaign-encounters' },
  { path: `/campaigns/${CAMPAIGN_SLUG}/search`, label: 'campaign-search' },
  { path: `/campaigns/${CAMPAIGN_SLUG}/settings`, label: 'campaign-settings' },
];

const ERROR_PATTERN = /404|not found|internal server error|application error|something went wrong/i;

test('all navigation links resolve without error', async ({ page }) => {
  await signInAsTestUser(page, VIC_EMAIL, QA_TEST_PASSWORD);

  for (const route of [...TOP_LEVEL_ROUTES, ...CAMPAIGN_ROUTES]) {
    await test.step(route.label, async () => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      const body = await page.textContent('body');
      expect(body, `Route ${route.path} returned an error page`).not.toMatch(ERROR_PATTERN);
      expect(body?.trim().length, `Route ${route.path} returned an empty body`).toBeGreaterThan(0);
    });
  }
});
