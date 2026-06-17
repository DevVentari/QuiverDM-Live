import { test, expect } from '@playwright/test';
import { checkpoint } from '../helpers';

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
