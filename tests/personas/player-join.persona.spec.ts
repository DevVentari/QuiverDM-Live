import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const PLAYER_EMAIL = process.env.QA_PLAYER_EMAIL ?? 'player@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const VIC_CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';
const PLAYER_INVITE_CODE = process.env.QA_PLAYER_INVITE_CODE ?? 'qa-player-invite-2026';

test('player-join happy path: join campaign via invite code and access campaign surfaces', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, PLAYER_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'accept-invite', async () => {
    await page.goto(`/join?code=${PLAYER_INVITE_CODE}`);
    await page.waitForLoadState('domcontentloaded');

    // Form pre-fills from ?code query param — submit it
    const joinBtn = page.getByRole('button', { name: /join campaign/i });
    await expect(joinBtn).toBeVisible({ timeout: 8_000 });
    await joinBtn.click();

    // Either redirected to campaign (first join) or "already a member" toast
    const redirected = await page.waitForURL(url => /\/campaigns\//.test(url.href), { timeout: 12_000 })
      .then(() => true)
      .catch(() => false);

    if (!redirected) {
      // Already a member — navigate directly
      const alreadyMsg = page.getByText(/already a member/i);
      if (await alreadyMsg.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await page.goto(`/campaigns/${VIC_CAMPAIGN_SLUG}`);
        await page.waitForURL(url => /\/campaigns\//.test(url.href), { timeout: 10_000 });
      } else {
        await expect(page).toHaveURL(/\/campaigns\//);
      }
    }

    await expect(page).toHaveURL(/\/campaigns\//);
  }, 20_000);

  await checkpoint(testInfo, 'player-sees-campaign', async () => {
    await page.goto(`/campaigns/${VIC_CAMPAIGN_SLUG}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(
      page.getByText(/vic.s test campaign/i).or(page.getByText(/vics test campaign/i)).first()
    ).toBeVisible({ timeout: 10_000 });

    // Player role badge visible
    await expect(page.getByText(/\bplayer\b/i).first()).toBeVisible({ timeout: 5_000 });
  }, 15_000);

  await checkpoint(testInfo, 'player-sees-sessions', async () => {
    await page.goto(`/campaigns/${VIC_CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const sessionsContent = page.getByRole('heading', { name: /sessions/i })
      .or(page.getByText(/no sessions/i))
      .or(page.locator('a[href*="/sessions/"]').first());
    await expect(sessionsContent.first()).toBeVisible({ timeout: 10_000 });
  }, 15_000);
});

test('player-join failure path: invalid invite code gives clear error', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, PLAYER_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'invalid-code-shows-error', async () => {
    await page.goto('/join');
    await page.waitForLoadState('domcontentloaded');

    const codeInput = page.getByLabel(/invite code/i);
    await expect(codeInput).toBeVisible({ timeout: 8_000 });
    await codeInput.fill('invalid-code-xyz-9999');

    await page.getByRole('button', { name: /join campaign/i }).click();

    await expect(
      page.getByText(/invalid|expired|not found/i)
        .or(page.locator('.text-destructive').filter({ hasText: /invalid|expired|not found/i }))
        .first()
    ).toBeVisible({ timeout: 10_000 });

    // Still on join page — not redirected
    await expect(page).toHaveURL(/\/join/);
  }, 15_000);
});
