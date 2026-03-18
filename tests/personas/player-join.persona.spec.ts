import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const PLAYER_EMAIL = process.env.QA_PLAYER_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';
const PLAYER_INVITE_CODE = process.env.QA_PLAYER_INVITE_CODE ?? '';

test('player-join: join campaign via invite code', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, PLAYER_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'accept-invite', async () => {
    if (!PLAYER_INVITE_CODE) {
      // No invite code configured — just verify the join form renders
      await page.goto('/join');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByRole('button', { name: /join campaign/i })).toBeVisible({ timeout: 8_000 });
      return;
    }

    await page.goto(`/join?code=${PLAYER_INVITE_CODE}`);
    await page.waitForLoadState('domcontentloaded');

    const joinBtn = page.getByRole('button', { name: /join campaign/i });
    await expect(joinBtn).toBeVisible({ timeout: 8_000 });
    await joinBtn.click();

    // Either redirected to campaign (first join) or "already a member" toast
    const redirected = await page.waitForURL(url => /\/campaigns\//.test(url.href), { timeout: 12_000 })
      .then(() => true)
      .catch(() => false);

    if (!redirected) {
      const alreadyMsg = page.getByText(/already a member/i);
      if (await alreadyMsg.isVisible({ timeout: 3_000 }).catch(() => false)) {
        // already a member — that's fine
      } else {
        await expect(page).toHaveURL(/\/campaigns\//);
      }
    }
  }, 20_000);

  await checkpoint(testInfo, 'invalid-code-shows-error', async () => {
    await page.goto('/join');
    await page.waitForLoadState('domcontentloaded');

    const codeInput = page.getByLabel(/invite code/i);
    await expect(codeInput).toBeVisible({ timeout: 8_000 });
    await codeInput.fill('invalid-code-xyz-9999');
    await page.getByRole('button', { name: /join campaign/i }).click();

    await expect(
      page.getByText(/invalid|expired|not found/i)
        .or(page.locator('.text-destructive'))
        .first()
    ).toBeVisible({ timeout: 10_000 });

    await expect(page).toHaveURL(/\/join/);
  }, 15_000);
});

test('player-join: player portal — campaign list and hub', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, PLAYER_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'play-home-renders', async () => {
    await page.goto('/play');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(
      page.getByRole('heading', { name: /your campaigns/i })
        .or(page.getByText(/haven.t joined any campaigns/i))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'play-home-shows-campaign-card', async () => {
    await page.goto('/play');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const card = page.locator(`a[href="/play/${CAMPAIGN_SLUG}"]`).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'play-campaign-hub-renders', async () => {
    await page.goto(`/play/${CAMPAIGN_SLUG}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/party/i).first()).toBeVisible({ timeout: 8_000 });
  }, 15_000);

  await checkpoint(testInfo, 'play-mobile-bottom-nav', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/play/${CAMPAIGN_SLUG}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(page.getByRole('link', { name: /hub/i })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('link', { name: /recaps/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('link', { name: /npcs/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('link', { name: /lore/i }).first()).toBeVisible({ timeout: 5_000 });
  }, 15_000);
});

test('player-join: player portal — sessions, NPCs, lore, and live session gate', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, PLAYER_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'play-sessions-page', async () => {
    await page.goto(`/play/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(
      page.getByRole('heading', { name: /session recaps/i })
        .or(page.getByText(/no sessions yet/i))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'play-npcs-page', async () => {
    await page.goto(`/play/${CAMPAIGN_SLUG}/npcs`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(
      page.getByRole('heading', { name: /known npcs/i })
        .or(page.getByText(/hasn.t shared any npcs/i))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'play-lore-page', async () => {
    await page.goto(`/play/${CAMPAIGN_SLUG}/lore`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await expect(
      page.getByRole('heading', { name: /shared lore/i })
        .or(page.getByText(/hasn.t shared any lore/i))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'play-sidebar-dm-player-switcher', async () => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/play');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // DM/Player toggle visible in sidebar
    await expect(
      page.getByRole('link', { name: /\bDM\b/ })
        .or(page.getByRole('link', { name: /\bPlayer\b/ }))
        .first()
    ).toBeVisible({ timeout: 8_000 });
  }, 15_000);

  await checkpoint(testInfo, 'play-live-session-no-active-shows-fallback', async () => {
    await page.goto(`/play/${CAMPAIGN_SLUG}/session`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // No session in progress — shows fallback with back button
    await expect(
      page.getByText(/no session is currently in progress/i)
        .or(page.getByRole('link', { name: /back to hub/i }))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  }, 15_000);
});
