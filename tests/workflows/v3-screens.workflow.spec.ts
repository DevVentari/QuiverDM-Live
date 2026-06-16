import { test, expect } from '@playwright/test';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 acceptance smoke: every v3 surface (DM app + player portal) must render on a
// real campaign without crashing. Data-light campaigns are fine — screens show
// their empty states; the gate is "renders + no crash", not "has data".

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vic-s-test-campaign';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error|404 \| this page/i;

// seg + an optional always-present static marker (independent of seeded data)
const DM_SCREENS: { seg: string; marker?: string | RegExp }[] = [
  { seg: 'overview' },
  { seg: 'npcs', marker: 'Cast of Characters' },
  { seg: 'characters', marker: 'The Party' },
  { seg: 'compendium', marker: 'Monsters' },
  { seg: 'homebrew', marker: 'Homebrew Creator' },
  { seg: 'combat' },
  { seg: 'battle-map' },
  { seg: 'world-map' },
  { seg: 'location-map' },
  { seg: 'locations' },
  { seg: 'scenes', marker: /Theatre of the Mind/i },
  { seg: 'sessions' },
  { seg: 'recordings' },
  { seg: 'settings' },
];

test.describe('v3 — screen surfaces render', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, "Vic's Test Campaign");
  });

  test('v3 DM surfaces render', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'v3-picker', async () => {
      await page.goto('/v3');
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.getByText('Your worlds').first()).toBeVisible({ timeout: 12_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    for (const s of DM_SCREENS) {
      await checkpoint(testInfo, `screen-${s.seg}`, async () => {
        await page.goto(`/v3/campaigns/${SLUG}/${s.seg}`);
        await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
        // The v3 DM shell renders on every campaign-scoped screen, data or not.
        await expect(page.getByText(/QuiverDM v3/i).first()).toBeVisible({ timeout: 12_000 });
        if (s.marker) {
          await expect(page.getByText(s.marker).first()).toBeVisible({ timeout: 8_000 });
        }
        await expect(page.locator('body')).not.toContainText(NO_CRASH);
      }, 25_000);
    }
  });

  test('v3 player portal renders', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    for (const seg of ['', 'character', 'journal', 'combat']) {
      await checkpoint(testInfo, `player-${seg || 'lobby'}`, async () => {
        await page.goto(`/v3/play/${SLUG}${seg ? `/${seg}` : ''}`);
        await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
        // The player shell shows the "Player view" eyebrow on every player screen.
        await expect(page.getByText(/Player view/i).first()).toBeVisible({ timeout: 12_000 });
        await expect(page.locator('body')).not.toContainText(NO_CRASH);
      }, 25_000);
    }
  });
});
