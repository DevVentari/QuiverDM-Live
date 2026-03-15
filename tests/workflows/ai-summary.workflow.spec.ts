import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

// Tabs (Recap, Recordings) are inside lg:hidden — only visible below 1024px.
// Use a tablet viewport to access the tabbed session interface.
test.use({ viewport: { width: 900, height: 900 } });

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('AI summaries page loads and session summary panel renders', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'summaries-page-loads', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/summaries`);
    await page.waitForLoadState('domcontentloaded');
    // Page heading: "Session Summaries" — rendered after tRPC query resolves
    await expect(page.getByRole('heading', { name: /session summaries/i })).toBeVisible({ timeout: 25_000 });
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
      await page.waitForLoadState('domcontentloaded');
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
    await page.waitForLoadState('domcontentloaded');
    // Wait up to 25s for session detail links (IDs with 10+ chars after /sessions/)
    await page.locator(`a[href^="/campaigns/${CAMPAIGN_SLUG}/sessions/"]`).first()
      .waitFor({ state: 'attached', timeout: 25_000 }).catch(() => {});
    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible({ timeout: 10_000 });
  }, 40_000);

  let sessionDetailHref: string | null = null;

  await checkpoint(testInfo, 'find-completed-session', async () => {
    // Ensure session list has loaded (tRPC may still be in flight after navigate-to-sessions-list)
    await page.locator(`a[href^="/campaigns/${CAMPAIGN_SLUG}/sessions/"]`).first()
      .waitFor({ state: 'attached', timeout: 20_000 }).catch(() => {});

    const anySessionHref = await page.locator(`a[href^="/campaigns/${CAMPAIGN_SLUG}/sessions/"]`).evaluateAll((links) => {
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && /\/campaigns\/[^/]+\/sessions\/([a-zA-Z0-9_-]{10,})$/.test(href)) {
          return href;
        }
      }
      return null;
    });

    if (!anySessionHref) {
      // No sessions yet — skip the session detail checks gracefully
      return;
    }

    sessionDetailHref = anySessionHref as string;
    await page.goto(sessionDetailHref);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}/sessions/`));
  }, 30_000);

  await checkpoint(testInfo, 'summary-panel-renders', async () => {
    if (!sessionDetailHref) return; // No session available — skip gracefully
    // Re-navigate to session detail to ensure we're on the right page
    await page.goto(sessionDetailHref);
    await page.waitForLoadState('domcontentloaded');
    // SummaryPanel lives in the Recap tab — wait for it and click
    const recapTab = page.getByRole('tab', { name: /recap/i });
    await expect(recapTab).toBeVisible({ timeout: 25_000 });
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
  }, 40_000);

  await checkpoint(testInfo, 'player-recap-section-visible', async () => {
    if (!sessionDetailHref) return; // No session available — skip gracefully
    // PlayerRecapPanel appears on session detail — it renders even for non-completed sessions
    // Look for "Player Recap" heading or generate button in the panel
    const recapSection = page
      .getByText(/player recap/i)
      .or(page.getByRole('button', { name: /generate.*recap/i }));
    await expect(recapSection.first()).toBeVisible({ timeout: 15_000 });
  }, 15_000);
});
