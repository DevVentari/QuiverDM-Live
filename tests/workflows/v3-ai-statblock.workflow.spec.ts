import { test, expect } from '@playwright/test';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

// v3 Homebrew — AI statblock generation. The real path calls a multi-provider
// LLM (non-deterministic, external), so generation is mocked at the tRPC layer;
// what's under test is the affordance and that the result fills the creator form
// for review (it never auto-saves).

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-statblock-qa';

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

// tRPC uses the superjson transformer, so a mocked result wraps the value in `json`.
const STATBLOCK = {
  name: 'Gloomhollow Revenant',
  description: 'A mournful undead bound to the ruin it died defending.',
  size: 'Medium',
  creatureType: 'undead',
  cr: '4',
  ac: 14,
  hp: 71,
  speed: '30 ft.',
  abilities: { str: 16, dex: 12, con: 16, int: 9, wis: 11, cha: 14 },
};

test.describe('v3 — AI statblock generation', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Statblock QA');
  });

  test('ai generate: prompt fills the creator form for review', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'affordance-opens', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/homebrew`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await expect(page.getByTestId('ai-generate')).toBeVisible({ timeout: 12_000 });
      await page.getByTestId('ai-generate').click();
      await expect(page.getByTestId('ai-generate-input')).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);

    await checkpoint(testInfo, 'generation-fills-form', async () => {
      await page.route('**/api/trpc/homebrew.generateStatblock**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ result: { data: { json: STATBLOCK } } }]),
        });
      });

      await page.getByTestId('ai-generate-input').fill('a gloomy revenant haunting a ruined keep');
      await page.getByTestId('ai-generate-submit').click();

      // The generated values populate the creator form (name + HP shown here).
      await expect(page.getByPlaceholder('Festival Wraith').first()).toHaveValue('Gloomhollow Revenant', { timeout: 10_000 });
      await expect(page.getByPlaceholder('66').first()).toHaveValue('71', { timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
