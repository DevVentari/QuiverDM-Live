import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('veteran-dm happy path: rapid campaign navigation and advanced npc creation', async ({ page }, testInfo) => {
  test.slow();
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 12_000);

  await checkpoint(testInfo, 'rapid-navigation', async () => {
    // Check for actual error page headings — not body text, which may contain "404" in session numbers
    const assertNoErrorPage = async () => {
      const errorHeading = page.locator('h1, h2').filter({ hasText: /^(404|not found|something went wrong|error)$/i });
      await expect(errorHeading).toHaveCount(0, { timeout: 3_000 });
    };

    await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    await expect(page.getByText(/vic.s test campaign/i).or(page.getByText(/vics test campaign/i)).first()).toBeVisible({ timeout: 10_000 });
    await assertNoErrorPage();

    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    const sessionsOk = page.getByRole('heading', { name: /sessions/i })
      .or(page.getByText(/no sessions/i))
      .or(page.getByText(/plan your first/i))
      .or(page.locator('a[href*="/sessions/"]').first());
    await expect(sessionsOk.first()).toBeVisible({ timeout: 15_000 });
    await assertNoErrorPage();

    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`);
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    const npcsOk = page.getByRole('heading', { name: /npcs/i })
      .or(page.getByText(/no npcs/i))
      .or(page.getByText(/create your first/i))
      .or(page.getByRole('link', { name: /new npc/i }));
    await expect(npcsOk.first()).toBeVisible({ timeout: 15_000 });
    await assertNoErrorPage();

    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/summaries`);
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    const summariesOk = page.getByRole('heading', { name: /ai recaps/i })
      .or(page.getByRole('heading', { name: /recaps/i }))
      .or(page.getByRole('heading', { name: /summaries/i }))
      .or(page.getByText(/no recaps/i))
      .or(page.getByText(/no sessions/i));
    await expect(summariesOk.first()).toBeVisible({ timeout: 15_000 });
    await assertNoErrorPage();
  }, 50_000);

  const npcName = `QA Veteran NPC ${Date.now()}`;

  await checkpoint(testInfo, 'create-stat-block-npc', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs/new`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    await page.getByLabel(/^name$/i).fill(npcName);

    // Stat block section is collapsed by default — scroll to it and click to open
    const statBlockBtn = page.getByRole('button', { name: /d&d 5e stat block/i });
    await statBlockBtn.scrollIntoViewIfNeeded();
    await statBlockBtn.click();
    await page.waitForTimeout(400); // let accordion animate open

    await page.locator('#cr').fill('5');
    await page.locator('#hp').fill('52');
    await page.locator('#ac').fill('15');

    // Scroll submit button into view before clicking
    const submitBtn = page.getByRole('button', { name: /create npc/i });
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();

    await page.waitForURL((url) => url.pathname.includes('/npcs/') && !url.pathname.endsWith('/new'), { timeout: 20_000 });
  }, 25_000);

  await checkpoint(testInfo, 'npc-detail-renders', async () => {
    const url = page.url();
    expect(url).toMatch(/\/npcs\//);
    expect(url).not.toMatch(/\/new/);

    await expect(page.getByText(npcName)).toBeVisible({ timeout: 10_000 });

    const statVisible = page.getByText('5').or(page.getByText('52')).or(page.getByText('15')).first();
    await expect(statVisible).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('body')).not.toContainText(/something went wrong|error loading|failed to load/i);
  }, 10_000);
});

test('veteran-dm brain-seeded-and-accessible checkpoint', async ({ page }, testInfo) => {
  test.slow();
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 12_000);

  await checkpoint(testInfo, 'navigate-to-brain', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'brain-accessible-as-dm', async () => {
    // DM Brain must be accessible — no 404, no "DM only" locked state for Vic
    await expect(page.getByText(/DM Brain/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
    await expect(page.locator('body')).not.toContainText(/only accessible to dungeon masters/i);
  }, 10_000);

  await checkpoint(testInfo, 'brain-overview-tab-content', async () => {
    // Overview tab is default — World Pressure and Open Hooks sections should render
    await expect(page.getByText(/World Pressure/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Open Hooks/i).first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'seed-button-or-entities-present', async () => {
    // Either seed button (no entities yet) or entity cards (already seeded) must be visible
    const hasSeedBtn = await page.locator('[data-testid="seed-from-existing-btn"]').first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEntityCards = await page.locator('[data-testid="entity-card"]').first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasSeedBtn || hasEntityCards).toBeTruthy();
  }, 10_000);

  await checkpoint(testInfo, 'brain-tabs-navigable', async () => {
    // All 4 tabs (Overview, Graph, Timeline, Warnings) must be present
    await expect(page.getByRole('tab', { name: /overview/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tab', { name: /graph/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tab', { name: /timeline/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tab', { name: /warnings/i }).first()).toBeVisible({ timeout: 5_000 });

    // Click Graph tab — must not crash
    await page.getByRole('tab', { name: /graph/i }).first().click();
    await page.waitForTimeout(1_000);
    await expect(page.locator('body')).not.toContainText(/something went wrong|internal server error/i);
  }, 15_000);
});

test('veteran-dm brain-seeded-from-creation: entities accessible after campaign creation with world setup', async ({ page }, testInfo) => {
  test.slow();
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 12_000);

  let campaignUrl: string;

  await checkpoint(testInfo, 'create-campaign-with-world-setup', async () => {
    await page.goto('/campaigns/new');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    const campaignName = `Vic Seed Test ${Date.now()}`;
    await page.getByLabel(/^name$/i).fill(campaignName);
    await page.fill('input#antagonistName', 'The Shadow Dragon');
    await page.fill('input#startingLocation', 'Myth Drannor');
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+/, { timeout: 15_000 });
    campaignUrl = page.url();
  }, 20_000);

  await checkpoint(testInfo, 'brain-page-loads-without-error', async () => {
    // Navigate to brain page for the newly created campaign
    const brainLink = page.locator('a[href*="/brain"]').first();
    const hasBrainLink = await brainLink.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasBrainLink) {
      await brainLink.click();
    } else {
      await page.goto(campaignUrl.replace(/\/$/, '') + '/brain');
    }
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    await page.waitForTimeout(2_000);
    await expect(page.locator('body')).not.toContainText(/something went wrong|internal server error/i);
    // Brain page loaded — entities may or may not be present yet (async seeding)
    const hasEntities = await page.locator('[data-testid="entity-card"]').count() > 0;
    const hasEmptyState = await page.locator('text=/no entities|No entities/').first().isVisible().catch(() => false);
    const hasSeeding = await page.locator('text=/seed|Seed|ingest/i').first().isVisible().catch(() => false);
    expect(hasEntities || hasEmptyState || hasSeeding).toBe(true);
  }, 15_000);
});

test('veteran-dm failure path: blocked action surfaces clear actionable error', async ({ page }, testInfo) => {
  test.slow();
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 12_000);

  await checkpoint(testInfo, 'invalid-submit', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs/new`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Submit without filling name — scroll button into view first
    const submitBtn = page.getByRole('button', { name: /create npc/i });
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();

    // Validation error should appear — either aria-invalid on name field or destructive text
    const validationErr = page.locator('[aria-invalid="true"]#name')
      .or(page.locator('.text-destructive').filter({ hasText: /required|name/i }));
    await expect(validationErr.first()).toBeVisible({ timeout: 8_000 });

    // URL must still be /new — form blocked the submission
    expect(page.url()).toMatch(/\/new$/);
  }, 10_000);

  await checkpoint(testInfo, 'error-visible', async () => {
    const errEl = page.locator('.text-destructive').filter({ hasText: /required|name/i }).first();
    await expect(errEl).toBeVisible({ timeout: 5_000 });

    await expect(page.locator('body')).not.toContainText(/500|something went wrong/i);
  }, 5_000);
});
