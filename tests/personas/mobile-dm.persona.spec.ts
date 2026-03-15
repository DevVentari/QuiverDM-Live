import { test, expect, devices } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vics-test-campaign';

// Spread iPhone 13 viewport/touch settings but stay on Chromium (no WebKit installed)
const { defaultBrowserType: _, ...iPhone13 } = devices['iPhone 13'];
test.use(iPhone13);

test('mobile-dm happy path: critical routes stay usable on phone viewport', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'mobile-sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'mobile-dashboard-renders', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

    // No significant horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = page.viewportSize()!.width;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 16); // 16px tolerance for scrollbar
  }, 15_000);

  await checkpoint(testInfo, 'mobile-campaigns-renders', async () => {
    await page.goto('/campaigns');
    await page.waitForLoadState('domcontentloaded');

    const campaignContent = page.getByRole('heading', { name: /campaigns/i })
      .or(page.getByText(/your campaigns/i))
      .or(page.getByText(/no campaigns/i))
      .or(page.locator('a[href*="/campaigns/"]').first());
    await expect(campaignContent.first()).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'mobile-campaign-nav-accessible', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
    await page.waitForLoadState('domcontentloaded');

    // Campaign name visible on mobile — wait for tRPC to resolve (layout h1)
    await expect(
      page.getByRole('heading').first()
    ).toBeVisible({ timeout: 20_000 });

    // At least one nav link or mobile menu trigger is reachable
    const navAccess = page
      .getByRole('link', { name: /overview|sessions|npcs/i })
      .or(page.getByRole('button', { name: /menu|nav|sidebar/i }))
      .or(page.locator('[data-mobile-nav], [aria-label*="menu"]'))
      .first();
    await expect(navAccess).toBeVisible({ timeout: 10_000 });
  }, 35_000);
});

test('mobile-dm failure path: core form inputs are reachable on phone viewport', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'mobile-sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'mobile-npc-form-usable', async () => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs/new`);
    await page.waitForLoadState('domcontentloaded');

    // Name field must be visible and interactable — wait for tRPC/React to render
    const nameField = page.getByLabel(/^name$/i);
    await expect(nameField).toBeVisible({ timeout: 20_000 });

    const box = await nameField.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    // Submit button must be within reasonable scroll reach
    const submitBtn = page.getByRole('button', { name: /create npc/i });
    await expect(submitBtn).toBeVisible({ timeout: 8_000 });

    const btnBox = await submitBtn.boundingBox();
    expect(btnBox).not.toBeNull();
    // Button should exist on page — not clipped to zero size
    expect(btnBox!.width).toBeGreaterThan(0);
    expect(btnBox!.height).toBeGreaterThan(0);
  }, 30_000);
});
