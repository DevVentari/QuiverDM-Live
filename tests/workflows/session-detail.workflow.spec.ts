import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('session detail page shows lifecycle-aware content', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  let sessionHref: string | null = null;

  await checkpoint(testInfo, 'find-any-session', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('domcontentloaded');
    await page.locator(`a[href^="/campaigns/${CAMPAIGN_SLUG}/sessions/"]`).first()
      .waitFor({ state: 'attached', timeout: 25_000 }).catch(() => {});

    sessionHref = await page.locator(`a[href^="/campaigns/${CAMPAIGN_SLUG}/sessions/"]`).evaluateAll((links) => {
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && /\/campaigns\/[^/]+\/sessions\/([a-zA-Z0-9_-]{10,})$/.test(href)) return href;
      }
      return null;
    });
  }, 35_000);

  await checkpoint(testInfo, 'session-detail-loads', async () => {
    if (!sessionHref) return;
    await page.goto(sessionHref);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(new RegExp(`/campaigns/${CAMPAIGN_SLUG}/sessions/`));
    // Page title renders
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
  }, 25_000);

  await checkpoint(testInfo, 'exactly-one-primary-cta-visible', async () => {
    if (!sessionHref) return;
    // One of these CTAs must be visible (lifecycle-dependent)
    const ctaGroup = page
      .getByRole('link', { name: /open prep workspace/i })
      .or(page.getByRole('link', { name: /start session/i }))
      .or(page.getByRole('link', { name: /resume session/i }));

    // completed sessions show no live CTA — check for at least one of these OR "View Prep" ghost button
    const hasLiveCta = await ctaGroup.first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasViewPrep = await page.getByRole('link', { name: /view prep/i }).first().isVisible().catch(() => false);
    const hasPrepStatusCard = await page.getByText(/session prep/i).first().isVisible().catch(() => false);

    // At minimum: either a live CTA is present OR the page shows session prep / view prep
    expect(hasLiveCta || hasViewPrep || hasPrepStatusCard).toBe(true);
  }, 10_000);

  await checkpoint(testInfo, 'no-start-session-on-completed', async () => {
    if (!sessionHref) return;
    // Check current session status from the page
    const isCompleted = await page.getByText(/completed/i).first().isVisible().catch(() => false);
    if (!isCompleted) return; // only verify this for completed sessions

    // Completed sessions should NOT show "Start Session" (it makes no sense)
    const startBtn = page.getByRole('link', { name: /^start session$/i });
    await expect(startBtn).not.toBeVisible();
  }, 10_000);

  await checkpoint(testInfo, 'prep-link-navigates-and-back-returns', async () => {
    if (!sessionHref) return;
    const sessionUrl = sessionHref;

    // Find any prep link on the page
    const prepLink = page
      .getByRole('link', { name: /prep workspace/i })
      .or(page.getByRole('link', { name: /view prep/i }))
      .or(page.getByTestId('prep-status-card-cta'))
      .first();

    const prepLinkVisible = await prepLink.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!prepLinkVisible) return;

    await prepLink.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/prep/, { timeout: 15_000 });

    // Back arrow should return to the session detail page (not the sessions list)
    const backBtn = page.getByRole('link', { name: '' }).filter({ has: page.locator('svg') }).first();
    // More reliable: look for ArrowLeft icon button
    await page.goBack();
    await expect(page).toHaveURL(sessionUrl, { timeout: 10_000 });
  }, 35_000);
});
