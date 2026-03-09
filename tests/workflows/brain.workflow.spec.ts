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

  await checkpoint(testInfo, 'seed-button-visible', async () => {
    const seedBtn = page.getByRole('button', { name: /seed from existing/i });
    await expect(seedBtn.first()).toBeVisible({ timeout: 10_000 });
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
    const npcLink = page.locator('a[href*="/npcs/"]').first();
    await expect(npcLink).toBeVisible({ timeout: 10_000 });
    await npcLink.click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }, 20_000);

  await checkpoint(testInfo, 'world-state-section-visible', async () => {
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
