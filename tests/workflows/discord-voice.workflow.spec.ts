import { test, expect } from '@playwright/test';
import {
  checkpoint,
  signInAsTestUser,
  ensureTestUserExists,
  ensureTestCampaignExists,
  TEST_USER_PASSWORD,
} from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = 'v3-discord-voice-qa';

// Discord voice (Phase 1) — the user-facing surface that's fully wired and
// headless-testable is the "Continue with Discord" sign-in entry point. Signing
// in with Discord stores the player's Discord user id, which the voice bot later
// uses to label each recorded track with the speaker's character name. The bot
// itself (gateway + voice receive) is verified manually — see
// docs/runbooks/discord-voice-bot.md. The identity resolver is unit-tested in
// src/lib/discord/__tests__/identity.test.ts.

const NO_CRASH = /something went wrong|internal server error|unhandled error|client-side exception|application error/i;

test.describe('discord voice — sign-in entry point', () => {
  test('signin: Continue with Discord is offered', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'discord-signin-button', async () => {
      await page.goto('/auth/signin');
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });

      await expect(page.getByRole('button', { name: /continue with discord/i })).toBeVisible({
        timeout: 12_000,
      });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });

  test('signup: Sign up with Discord is offered', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'discord-signup-button', async () => {
      await page.goto('/auth/signup');
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });

      await expect(page.getByRole('button', { name: /sign up with discord/i })).toBeVisible({
        timeout: 12_000,
      });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});

test.describe('discord voice — DM config surface', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC_EMAIL, PASSWORD);
    await ensureTestCampaignExists(VIC_EMAIL, SLUG, 'V3 Discord Voice QA');
  });

  test('settings: the DM can configure the Discord voice channel', async ({ page }, testInfo) => {
    test.slow();

    await checkpoint(testInfo, 'sign-in', async () => {
      await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'voice-settings-visible', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/settings`);
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });

      const control = page.getByTestId('discord-voice-settings');
      await expect(control).toBeVisible({ timeout: 12_000 });
      // The guild + voice-channel inputs are present to fill in.
      await expect(control.getByPlaceholder(/server \(guild\) id/i)).toBeVisible({ timeout: 6_000 });
      await expect(control.getByPlaceholder(/voice channel id/i)).toBeVisible({ timeout: 6_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
