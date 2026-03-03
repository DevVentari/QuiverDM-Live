import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('AI summaries page loads and session summary panel renders', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'summaries-page-loads', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/summaries`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    // Page heading: "Session Summaries"
    await expect(page.getByRole('heading', { name: /session summaries/i })).toBeVisible({ timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'summaries-content-renders', async () => {
    // Either summary cards or the sessions-without-summaries section renders — no blank error screen
    const hasSummaryCards = await page.locator('[class*="hover:border-primary"]').first().isVisible().catch(() => false);
    const hasPendingSection = await page.getByText(/sessions without summaries/i).isVisible().catch(() => false);
    const hasBadge = await page.getByText(/\d+ summaries/i).isVisible().catch(() => false);
    // At minimum the badge should be visible (even if 0 summaries)
    expect(hasSummaryCards || hasPendingSection || hasBadge).toBe(true);
  }, 10_000);

  await checkpoint(testInfo, 'click-summary-if-available', async () => {
    // If any summary cards exist, click the first one and verify recap text
    const summaryCard = page.locator('[class*="hover:border-primary"]').first();
    const cardVisible = await summaryCard.isVisible().catch(() => false);
    if (cardVisible) {
      await summaryCard.click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      // Should now be on the session detail page
      await expect(page).toHaveURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}/sessions/`));
      // AI Summary lives in Recap tab — click it first
      const recapTab = page.getByRole('tab', { name: /recap/i });
      if (await recapTab.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await recapTab.click();
      }
      await expect(page.getByText(/ai summary/i)).toBeVisible({ timeout: 15_000 });
    }
  }, 25_000);

  await checkpoint(testInfo, 'navigate-to-sessions-list', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible({ timeout: 10_000 });
  }, 20_000);

  await checkpoint(testInfo, 'find-completed-session', async () => {
    // Look for a completed session badge or any session to click
    const completedBadge = page.getByText(/completed/i).first();
    const anySessionHref = await page.locator('a[href*="/sessions/"]').evaluateAll((links) => {
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && /\/campaigns\/[^/]+\/sessions\/([a-zA-Z0-9_-]{10,})$/.test(href)) {
          return href;
        }
      }
      return null;
    });

    const hasCompleted = await completedBadge.isVisible().catch(() => false);

    if (hasCompleted) {
      // Click the parent link of the completed badge
      const sessionRow = page.locator('a[href*="/sessions/"]').filter({ has: page.getByText(/completed/i) }).first();
      if (await sessionRow.isVisible().catch(() => false)) {
        const href = await sessionRow.getAttribute('href');
        if (href && /\/campaigns\/[^/]+\/sessions\/([a-zA-Z0-9_-]{10,})$/.test(href)) {
          await page.goto(href);
        } else if (anySessionHref) {
          await page.goto(anySessionHref as string);
        } else {
          return;
        }
      } else if (anySessionHref) {
        await page.goto(anySessionHref as string);
      } else {
        return;
      }
    } else if (anySessionHref) {
      await page.goto(anySessionHref as string);
    } else {
      // No sessions yet — skip the session detail checks gracefully
      return;
    }

    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}/sessions/`));
  }, 20_000);

  await checkpoint(testInfo, 'summary-panel-renders', async () => {
    // SummaryPanel lives in the Recap tab — wait for it and click
    const recapTab = page.getByRole('tab', { name: /recap/i });
    await expect(recapTab).toBeVisible({ timeout: 15_000 });
    await recapTab.click();
    await expect(page.getByRole('tabpanel')).toBeVisible({ timeout: 5_000 });
    // The SummaryPanel card should be present in the Recap tab
    await expect(page.getByText(/ai summary/i)).toBeVisible({ timeout: 15_000 });
    // It either shows "No summary yet", "Generating summary...", or actual summary content
    const states = page
      .getByText(/no summary yet/i)
      .or(page.getByText(/generating summary/i))
      .or(page.getByText(/regenerate/i))
      .or(page.getByRole('button', { name: /generate/i }));
    await expect(states.first()).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'player-recap-section-visible', async () => {
    // PlayerRecapPanel appears on session detail — it renders even for non-completed sessions
    // Look for "Player Recap" heading or generate button in the panel
    const recapSection = page
      .getByText(/player recap/i)
      .or(page.getByRole('button', { name: /generate.*recap/i }));
    await expect(recapSection.first()).toBeVisible({ timeout: 15_000 });
  }, 15_000);
});
