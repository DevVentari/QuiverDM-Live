import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('session cockpit loads panels and mode toggle works', async ({ page, context }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  let sessionId: string;

  await checkpoint(testInfo, 'find-or-create-active-session', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Look for a planning session to start, or an active/in-progress one to continue
    const startBtn = page.getByRole('button', { name: /start session/i }).first();
    const continueBtn = page.getByRole('button', { name: /continue session/i }).first();

    const hasStart = await startBtn.isVisible().catch(() => false);
    const hasContinue = await continueBtn.isVisible().catch(() => false);

    if (hasStart || hasContinue) {
      // Already on a session detail page indirectly — find a session link first
    }

    // Navigate through a session card to get to the detail page
    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (await sessionLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const href = await sessionLink.getAttribute('href') ?? '';
      const match = href.match(/\/sessions\/([^/?]+)/);
      sessionId = match?.[1] ?? '';
    }

    // If no sessions, create one via prep
    if (!sessionId) {
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/prep`);
      await page.waitForURL(/sessionId=/, { timeout: 20_000 });
      const url = new URL(page.url());
      sessionId = url.searchParams.get('sessionId') ?? '';
    }

    expect(sessionId).toBeTruthy();
  }, 30_000);

  await checkpoint(testInfo, 'navigate-to-session-detail', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    // Session detail should have either "Start Session" or "Continue Session"
    const pageIndicator = page
      .getByRole('button', { name: /start session/i })
      .or(page.getByRole('button', { name: /continue session/i }))
      .or(page.getByRole('link', { name: /continue prep/i }));
    await expect(pageIndicator.first()).toBeVisible({ timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'launch-cockpit', async () => {
    const startBtn = page.getByRole('button', { name: /start session/i }).first();
    const continueBtn = page.getByRole('button', { name: /continue session/i }).first();

    const isStart = await startBtn.isVisible().catch(() => false);
    const isContinue = await continueBtn.isVisible().catch(() => false);

    if (isContinue) {
      // Already active — navigate directly to /live
      const [cockpitPage] = await Promise.all([
        context.waitForEvent('page').catch(() => null),
        continueBtn.click(),
      ]);
      if (cockpitPage) {
        await cockpitPage.waitForLoadState('domcontentloaded', { timeout: 20_000 });
        // Switch context to the new tab
        await cockpitPage.bringToFront();
        // reassign page reference by navigating there directly in the current page
        await page.goto(cockpitPage.url());
        await cockpitPage.close().catch(() => {});
      }
    } else if (isStart) {
      // Starts the session and redirects to /live
      await startBtn.click();
      await page.waitForURL(/\/live$/, { timeout: 20_000 });
    } else {
      // Fallback: navigate directly to /live (session may be in planning state still)
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions/${sessionId}/live`);
    }

    await page.waitForURL(/\/live/, { timeout: 20_000 });
  }, 30_000);

  await checkpoint(testInfo, 'cockpit-header-visible', async () => {
    // Header has the session title + timer
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 15_000 });
    // Session timer element
    await expect(page.locator('[class*="font-display"]').first()).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'cockpit-mode-toggle-visible', async () => {
    // Mode toggle button shows "RP" or "Combat" text with the swords icon
    const modeBtn = page.getByRole('button', { name: /^(rp|combat)$/i });
    await expect(modeBtn).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'party-overview-panel-visible', async () => {
    // Left column party panel — check for the PartyOverviewPanel container
    const partyPanel = page.locator('div').filter({ hasText: /party|characters|hp/i }).first();
    await expect(partyPanel).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'right-panel-tabs-visible', async () => {
    // Right panel has Prep and NPCs tabs
    await expect(page.getByRole('tab', { name: /prep/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab', { name: /npcs/i })).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'switch-to-combat-mode', async () => {
    const modeBtn = page.getByRole('button', { name: /^(rp|combat)$/i });
    const currentMode = await modeBtn.textContent().catch(() => 'rp');
    if (/rp/i.test(currentMode ?? '')) {
      await modeBtn.click();
      // After clicking, mode should show "Combat"
      await expect(page.getByRole('button', { name: /combat/i })).toBeVisible({ timeout: 10_000 });
    }
  }, 10_000);

  await checkpoint(testInfo, 'switch-back-to-rp-mode', async () => {
    const modeBtn = page.getByRole('button', { name: /combat/i });
    if (await modeBtn.isVisible().catch(() => false)) {
      await modeBtn.click();
      await expect(page.getByRole('button', { name: /^rp$/i })).toBeVisible({ timeout: 10_000 });
    }
  }, 10_000);

  await checkpoint(testInfo, 'end-session-button-visible', async () => {
    // Toolbar at the bottom has the End Session button
    await expect(page.getByRole('button', { name: /end session/i })).toBeVisible({ timeout: 10_000 });
    // Do NOT click it — leave the session intact
  }, 10_000);

  await checkpoint(testInfo, 'no-js-crash', async () => {
    // Verify no error boundary or crash message
    const errorText = page.getByText(/something went wrong|unhandled error|application error/i);
    await expect(errorText).toHaveCount(0);
  }, 5_000);
});
