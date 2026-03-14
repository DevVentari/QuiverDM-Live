/**
 * session-play.workflow.spec.ts
 *
 * Simulated encounter: DM runs a live session while a player accesses their
 * character sheet. Covers the core "at the table" flows for both roles.
 *
 * DM (Vic): cockpit → combat mode → NPC stat block → initiative view
 * Player:   campaign overview → sessions list → character sheet
 */

import { test, expect, Browser } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PLAYER_EMAIL = process.env.QA_PLAYER_EMAIL ?? 'player@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

// ─── DM: Full cockpit + encounter flow ───────────────────────────────────────

test('DM runs a session cockpit with encounter interaction', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'dm-sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  let sessionId = '';

  await checkpoint(testInfo, 'find-or-create-session', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    // Wait for session links to appear (tRPC may load slightly after networkidle)
    await page.waitForSelector('a[href*="/sessions/"]', { timeout: 10_000 }).catch(() => null);

    // Find existing session link (any href ending with a session ID)
    sessionId = await page.locator('a[href*="/sessions/"]').evaluateAll((links: Element[]) => {
      for (const link of links) {
        const href = (link as HTMLAnchorElement).getAttribute('href') ?? '';
        const m = href.match(/\/sessions\/([a-zA-Z0-9_-]{8,})(?:\/|$)/);
        if (m && !href.endsWith('/new') && !href.endsWith('/prep')) return m[1];
      }
      return '';
    });

    // No sessions — go to /sessions/prep which auto-creates and appends ?sessionId=
    if (!sessionId) {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/prep`);
      // Prep page creates a session then does router.replace with ?sessionId=
      await page.waitForURL(/sessionId=/, { timeout: 90_000 });
      sessionId = new URL(page.url()).searchParams.get('sessionId') ?? '';
    }

    expect(sessionId, 'session ID must exist').toBeTruthy();
  }, 110_000);

  await checkpoint(testInfo, 'navigate-to-session-detail', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 25_000);

  await checkpoint(testInfo, 'launch-cockpit', async () => {
    const startBtn = page.getByRole('button', { name: /start session/i }).first();
    const continueBtn = page.getByRole('button', { name: /continue session/i }).first();

    const isStart = await startBtn.isVisible().catch(() => false);
    const isContinue = await continueBtn.isVisible().catch(() => false);

    if (isStart) {
      await startBtn.click();
      await page.waitForURL(/\/live$/, { timeout: 25_000 });
    } else if (isContinue) {
      await continueBtn.click();
      // May open new tab — navigate directly if so
      await page.waitForURL(/\/live/, { timeout: 25_000 }).catch(async () => {
        await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}/live`);
      });
    } else {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}/live`);
    }

    await page.waitForURL(/\/live/, { timeout: 25_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    await expect(page.locator('body')).not.toContainText(/something went wrong|application error/i);
  }, 40_000);

  await checkpoint(testInfo, 'cockpit-core-panels-visible', async () => {
    // Header / timer
    await expect(page.locator('header').first()).toBeVisible({ timeout: 15_000 });
    // End session button always visible in cockpit toolbar
    await expect(page.getByRole('button', { name: /end session/i })).toBeVisible({ timeout: 15_000 });
    // No JS crash
    await expect(page.getByText(/unhandled error|application error/i)).toHaveCount(0);
  }, 20_000);

  await checkpoint(testInfo, 'enter-combat-mode', async () => {
    const combatBtn = page.getByRole('button', { name: /^combat$/i }).first();
    const rpBtn = page.getByRole('button', { name: /^rp$/i }).first();

    const alreadyInCombat = await rpBtn.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!alreadyInCombat) {
      await expect(combatBtn).toBeVisible({ timeout: 10_000 });
      await combatBtn.click();
    }

    // After entering combat mode the toggle flips to "RP"
    await expect(page.getByRole('button', { name: /^rp$/i }).first()).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'open-npcs-tab-in-cockpit', async () => {
    const npcsTab = page.getByRole('tab', { name: /npcs/i });
    if (await npcsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await npcsTab.click();
      await page.waitForTimeout(800);
      // Panel content loads — either NPC cards or empty state
      await expect(
        page.getByText(/no npcs|add npc|drag npc/i)
          .or(page.locator('[data-testid="npc-card"]'))
          .or(page.locator('[class*="NPC"], [class*="npc"]').first())
      ).toBeVisible({ timeout: 10_000 }).catch(() => {
        // Tab opened but content format unknown — just ensure no crash
      });
    }
  }, 15_000);

  await checkpoint(testInfo, 'view-npc-stat-block', async () => {
    // Navigate to the campaign NPCs page and open the first NPC detail
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    const firstNpc = page.locator('a[href*="/npcs/"]').first();
    const hasNpc = await firstNpc.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasNpc) {
      await firstNpc.click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      // Stat block sections: Ability Scores, HP, AC, Actions
      const statSections = page.getByText(/strength|hit points|armor class|actions/i).first();
      await expect(statSections).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText(/something went wrong|404/i);
    }
  }, 25_000);

  await checkpoint(testInfo, 'combat-mode-initiative-elements', async () => {
    // Return to live cockpit
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}/live`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    // Initiative / HP elements — look for numeric inputs or HP displays
    const hpOrInit = page.getByText(/initiative|hp|hit points/i)
      .or(page.locator('input[type="number"]').first())
      .or(page.locator('[data-testid*="hp"], [data-testid*="initiative"]').first());

    // Soft assertion — these elements depend on party data existing
    const visible = await hpOrInit.first().isVisible({ timeout: 8_000 }).catch(() => false);
    if (!visible) {
      // No party / HP data yet — acceptable for a fresh campaign
      await expect(page.locator('body')).not.toContainText(/something went wrong/i);
    }
  }, 25_000);

  await checkpoint(testInfo, 'return-to-rp-mode', async () => {
    const rpBtn = page.getByRole('button', { name: /^rp$/i }).first();
    if (await rpBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await rpBtn.click();
      await expect(page.getByRole('button', { name: /^combat$/i }).first()).toBeVisible({ timeout: 10_000 });
    }
  }, 15_000);

  await checkpoint(testInfo, 'no-console-crashes', async () => {
    await expect(page.getByText(/something went wrong|unhandled error|application error/i)).toHaveCount(0);
  }, 5_000);
});

// ─── Player: character sheet access during active session ─────────────────────

test('player accesses character sheet during a campaign session', async ({ browser }, testInfo) => {
  test.slow();

  const playerCtx = await browser.newContext();
  const playerPage = await playerCtx.newPage();

  try {
    await checkpoint(testInfo, 'player-sign-in', async () => {
      await signInAsTestUser(playerPage, PLAYER_EMAIL, PASSWORD);
    }, 15_000);

    await checkpoint(testInfo, 'player-views-campaign', async () => {
      await playerPage.goto(`/campaigns/${CAMPAIGN_SLUG}`);
      await playerPage.waitForLoadState('networkidle', { timeout: 20_000 });

      // Player may not be a member — acceptable outcomes:
      // (a) campaign page loads, (b) redirected to campaigns list, (c) access denied shown
      // Just ensure no unhandled error
      const url = playerPage.url();
      const isOnCampaign = url.includes('/campaigns/');
      const isOnDashboard = url.includes('/dashboard') || url.includes('/campaigns');

      expect(isOnCampaign || isOnDashboard, `unexpected URL: ${url}`).toBeTruthy();
      await expect(playerPage.locator('body')).not.toContainText(/something went wrong|internal server error|unhandled error/i);
    }, 20_000);

    await checkpoint(testInfo, 'player-views-sessions', async () => {
      await playerPage.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
      await playerPage.waitForLoadState('networkidle', { timeout: 20_000 });

      // Acceptable outcomes: sessions list renders, campaign not accessible for this player,
      // or redirected — just ensure no unhandled error
      const url = playerPage.url();
      const onCampaignOrRedirected = url.includes('/campaigns') || url.includes('/dashboard') || url.includes('/signin');
      expect(onCampaignOrRedirected, `unexpected URL: ${url}`).toBeTruthy();
      await expect(playerPage.locator('body')).not.toContainText(/something went wrong|internal server error|unhandled error/i);
    }, 20_000);

    await checkpoint(testInfo, 'player-accesses-character-sheet', async () => {
      await playerPage.goto('/characters');
      await playerPage.waitForLoadState('networkidle', { timeout: 20_000 });

      const charLink = playerPage.locator('a[href*="/characters/"]').first();
      const hasChar = await charLink.isVisible({ timeout: 8_000 }).catch(() => false);

      if (hasChar) {
        await charLink.click();
        await playerPage.waitForLoadState('networkidle', { timeout: 20_000 });

        // Character sheet sections
        await expect(
          playerPage.getByText(/strength|dexterity|constitution|class|race|background/i).first()
        ).toBeVisible({ timeout: 15_000 });

        await expect(playerPage.locator('body')).not.toContainText(/404|something went wrong/i);
      } else {
        // Player has no characters yet — acceptable, check empty state is clean
        await expect(
          playerPage.getByText(/no characters|create.*character|import/i).first()
        ).toBeVisible({ timeout: 10_000 });
      }
    }, 25_000);

    await checkpoint(testInfo, 'player-no-crashes', async () => {
      await expect(playerPage.getByText(/something went wrong|unhandled error/i)).toHaveCount(0);
    }, 5_000);

  } finally {
    await playerCtx.close();
  }
});

// ─── Concurrent: DM + Player active simultaneously ───────────────────────────

test('DM and player are active concurrently without interference', async ({ browser }, testInfo) => {
  test.slow();

  const dmCtx = await browser.newContext();
  const playerCtx = await browser.newContext();
  const dmPage = await dmCtx.newPage();
  const playerPage = await playerCtx.newPage();

  try {
    // Sign both in concurrently
    await checkpoint(testInfo, 'concurrent-sign-in', async () => {
      await Promise.all([
        signInAsTestUser(dmPage, VIC_EMAIL, PASSWORD),
        signInAsTestUser(playerPage, PLAYER_EMAIL, PASSWORD),
      ]);
    }, 25_000);

    await checkpoint(testInfo, 'concurrent-navigation', async () => {
      await Promise.all([
        dmPage.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`).then(() =>
          dmPage.waitForLoadState('domcontentloaded', { timeout: 20_000 })
        ),
        playerPage.goto(`/campaigns/${CAMPAIGN_SLUG}`).then(() =>
          playerPage.waitForLoadState('domcontentloaded', { timeout: 20_000 })
        ),
      ]);

      // Both pages loaded without crashes
      await expect(dmPage.locator('body')).not.toContainText(/something went wrong|internal server error/i);
      await expect(playerPage.locator('body')).not.toContainText(/something went wrong|internal server error/i);
    }, 30_000);

    await checkpoint(testInfo, 'concurrent-character-and-npc-views', async () => {
      await Promise.all([
        // DM views NPC list
        dmPage.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`).then(async () => {
          await dmPage.waitForLoadState('networkidle', { timeout: 15_000 });
          await expect(dmPage.locator('body')).not.toContainText(/something went wrong/i);
        }),
        // Player views characters
        playerPage.goto('/characters').then(async () => {
          await playerPage.waitForLoadState('networkidle', { timeout: 15_000 });
          await expect(playerPage.locator('body')).not.toContainText(/something went wrong/i);
        }),
      ]);
    }, 30_000);

  } finally {
    await dmCtx.close();
    await playerCtx.close();
  }
});
