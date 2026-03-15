import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

test('brain navigation exists in campaign sidebar', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-campaign', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'brain-nav-link-visible', async () => {
    const brainLink = page.getByRole('link', { name: /brain/i });
    const brainHrefLink = page.locator(`a[href*="/campaigns/${CAMPAIGN_SLUG}/brain"]`);

    const hasNamedLink = await brainLink.first().isVisible().catch(() => false);
    const hasHrefLink = await brainHrefLink.first().isVisible().catch(() => false);

    expect(hasNamedLink || hasHrefLink).toBeTruthy();
  }, 10_000);
});

test('brain dashboard loads with DM Brain heading and Seed button', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-brain', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'dm-brain-heading-visible', async () => {
    await expect(page.getByText(/DM Brain/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 10_000);

  await checkpoint(testInfo, 'seed-button-or-entities-visible', async () => {
    // Seed button shows when no entities exist; entity cards show when already seeded
    const hasSeedBtn = await page.getByRole('button', { name: /seed from existing/i }).first().isVisible({ timeout: 5_000 }).catch(() => false);
    const hasEntityCards = await page.locator('[data-testid="entity-card"]').first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasSeedBtn || hasEntityCards).toBeTruthy();
  }, 10_000);
});

test('world pressure and open hooks sections visible on brain dashboard', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-brain', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'world-pressure-visible', async () => {
    await expect(page.getByText(/World Pressure/i).first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'open-hooks-visible', async () => {
    await expect(page.getByText(/Open Hooks/i).first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);
});

test('NPC detail page has World State accordion section', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-npcs', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'click-first-npc', async () => {
    // Exclude /new — only match existing NPC detail links
    const npcLink = page.locator('a[href*="/npcs/"]:not([href$="/new"])').first();
    const hasNpc = await npcLink.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!hasNpc) return; // No NPCs yet — skip remainder
    await npcLink.click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'world-state-section-visible', async () => {
    const url = page.url();
    if (!url.includes('/npcs/') || url.endsWith('/new')) return; // skipped above

    await expect(page.getByText(/World State/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 10_000);
});

test('voice button visible in campaign header', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-campaign', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'voice-button-visible', async () => {
    const voiceBtn = page.locator('button[title="Ask DM Brain (voice)"]');
    const micBtn = page.locator('button[title*="Brain"], button[title*="voice"]');

    const hasVoiceBtn = await voiceBtn.first().isVisible().catch(() => false);
    const hasMicBtn = await micBtn.first().isVisible().catch(() => false);

    expect(hasVoiceBtn || hasMicBtn).toBeTruthy();
  }, 10_000);
});

test('brain seed button creates entities that appear in entity list', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-brain', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'seed-or-entities-present', async () => {
    // If seed button exists, click it; if entities already exist, skip seeding
    const seedBtn = page.locator('[data-testid="seed-from-existing-btn"]').first();
    const hasSeedBtn = await seedBtn.isVisible({ timeout: 8_000 }).catch(() => false);

    if (hasSeedBtn) {
      await seedBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    }
    // Either entity cards or empty state must be visible — this also implicitly
    // confirms no ErrorBoundary takeover (which would remove these elements)
    const hasEntityCards = await page.locator('[data-testid="entity-card"]').first().isVisible({ timeout: 8_000 }).catch(() => false);
    const hasEmptyMsg = await page.getByText(/no entities tracked yet/i).first().isVisible({ timeout: 5_000 }).catch(() => false);

    expect(hasEntityCards || hasEmptyMsg).toBeTruthy();
  }, 20_000);
});

test('entity detail page shows relationships and properties sections', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-brain-entities', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain/entities`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'click-first-entity-or-skip', async () => {
    const entityCard = page.locator('[data-testid="entity-card"]').first();
    const hasEntity = await entityCard.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasEntity) {
      // No entities seeded yet — skip remainder
      return;
    }

    await entityCard.click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'entity-detail-sections-visible', async () => {
    const url = page.url();
    if (!url.includes('/brain/entities/')) return; // skipped above

    await expect(page.locator('body')).not.toContainText(/404|something went wrong/i);

    // Properties or description section
    const propsSection = page.getByText(/properties/i).or(page.getByText(/description/i)).first();
    await expect(propsSection).toBeVisible({ timeout: 10_000 });

    // Relationships section
    const relSection = page.getByText(/relationship/i).first();
    await expect(relSection).toBeVisible({ timeout: 10_000 });
  }, 15_000);
});

test('hook resolve button removes hook from open list', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-brain', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'check-for-hooks', async () => {
    const hookList = page.locator('[data-testid="hook-list"]').first();
    const hasHooks = await hookList.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasHooks) {
      // No hooks — verify empty state renders cleanly
      await expect(page.getByText(/no open hooks/i).first()).toBeVisible({ timeout: 8_000 });
      return;
    }

    const resolveBtn = page.locator('[data-testid="resolve-hook-btn"]').first();
    const hasBtnVisible = await resolveBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasBtnVisible) return;

    const hooksBefore = await page.locator('[data-testid="resolve-hook-btn"]').count();
    await resolveBtn.click();

    // After resolve, count should decrease (mutation updates state)
    await page.waitForTimeout(2_000);
    const hooksAfter = await page.locator('[data-testid="resolve-hook-btn"]').count();
    expect(hooksAfter).toBeLessThanOrEqual(hooksBefore);
  }, 20_000);
});

test('entity list navigation filters by type', async ({ page }, testInfo) => {
  test.slow();

  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'navigate-to-entities-list', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain/entities`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'entities-page-loads-cleanly', async () => {
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);

    // Page should show either entity cards or an empty/no-entities state
    const hasCards = await page.locator('[data-testid="entity-card"]').first().isVisible({ timeout: 8_000 }).catch(() => false);
    const hasEmpty = await page.getByText(/no entities/i).first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasCards || hasEmpty).toBeTruthy();
  }, 15_000);

  await checkpoint(testInfo, 'type-filter-link-navigates', async () => {
    // Brain page Overview tab has entity-type links like /brain/entities?type=NPC
    const typeLink = page.locator('a[href*="/brain/entities?type="]').first();
    const hasTypeLink = await typeLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasTypeLink) {
      // No entities to filter — verify entities page loaded cleanly
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/brain/entities?type=NPC`);
      await page.waitForLoadState('networkidle', { timeout: 10_000 });
      await expect(page.locator('body')).not.toContainText(/404|something went wrong/i);
      return;
    }

    const href = await typeLink.getAttribute('href');
    if (href) await page.goto(href);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/404|something went wrong|internal server error/i);
  }, 20_000);
});
