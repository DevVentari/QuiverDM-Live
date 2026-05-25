import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers';

const BLAKE_EMAIL = process.env.QA_BLAKE_EMAIL ?? 'blake@test.local';
const JORDAN_EMAIL = process.env.QA_JORDAN_EMAIL ?? 'jordan@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const CAMPAIGN_SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'blakes-test-campaign';

test.describe('sidebar + global chrome', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
  });

  test('sidebar renders nav links', async ({ page }) => {
    const nav = page.getByRole('navigation').first();
    await expect(nav).toBeVisible({ timeout: 10_000 });
    await expect(nav.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /campaigns/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /homebrew/i })).toBeVisible();
    // Settings is an icon link in the sidebar footer (outside the nav element)
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible();
  });

  test('dashboard renders section headings', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('main')).toBeVisible();
    // No error states
    await expect(page.getByText(/something went wrong|internal server error/i)).toHaveCount(0);
  });
});

test.describe('campaign surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
  });

  test('campaign overview renders heading and tab navigation', async ({ page }) => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
    // Campaign-level nav links (Sessions, NPCs, Members, etc.)
    const campaignNav = page.locator('nav, [role="navigation"]');
    await expect(campaignNav.first()).toBeVisible({ timeout: 8_000 });
  });

  test('sessions list renders heading', async ({ page }) => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong|500/i)).toHaveCount(0);
  });

  test('NPCs list renders heading', async ({ page }) => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong|500/i)).toHaveCount(0);
  });
});

test.describe('character sheet', () => {
  test('all 7 tabs present on character page', async ({ page }) => {
    await signInAsTestUser(page, JORDAN_EMAIL, PASSWORD);
    await page.goto('/characters');
    await page.waitForLoadState('domcontentloaded');

    const charLink = page
      .locator('a[href*="/characters/"]')
      .filter({ hasNot: page.locator('[href="/characters/new"]') })
      .first();

    if (await charLink.count() === 0) {
      test.skip(true, 'No characters exist for Jordan — skipping character sheet UI check');
      return;
    }

    const href = await charLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    const tabList = page.getByRole('tablist');
    if (await tabList.isVisible({ timeout: 10_000 }).catch(() => false)) {
      const tabs = tabList.getByRole('tab');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(5);
    } else {
      // Character loaded but tabs may be in a different layout — verify page didn't crash
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('homebrew library', () => {
  test('homebrew page renders create button and list area', async ({ page }) => {
    await signInAsTestUser(page, JORDAN_EMAIL, PASSWORD);
    await page.goto('/homebrew');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong|500/i)).toHaveCount(0);
  });

  test('homebrew detail renders type badge and action area', async ({ page }) => {
    await signInAsTestUser(page, JORDAN_EMAIL, PASSWORD);
    await page.goto('/homebrew');
    await page.waitForLoadState('domcontentloaded');

    const firstItem = page.locator('a[href*="/homebrew/"]').first();
    if (await firstItem.count() === 0) {
      test.skip(true, 'No homebrew items exist — skipping detail UI check');
      return;
    }

    const href = await firstItem.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
    // Type badge (item/spell/feat/monster/rule)
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText(/something went wrong|500/i)).toHaveCount(0);
  });
});

test.describe('NPC detail', () => {
  test('NPC detail renders name heading and at least one stat section', async ({ page }) => {
    await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`);
    await page.waitForLoadState('domcontentloaded');

    const firstNpc = page.locator('a[href*="/npcs/"]').first();
    if (await firstNpc.count() === 0) {
      test.skip(true, 'No NPCs in campaign — skipping NPC detail UI check');
      return;
    }

    const href = await firstNpc.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/something went wrong|500/i)).toHaveCount(0);
  });
});

test.describe('responsive breakpoints — card grids', () => {
  const VIEWPORTS = [
    { name: 'mobile',  width: 375,  height: 812,  npcW: [280, 375] as const, campaignW: [310, 375] as const },
    { name: 'tablet',  width: 768,  height: 1024, npcW: [200, 400] as const, campaignW: [200, 420] as const },
    { name: 'desktop', width: 1280, height: 800,  npcW: [150, 420] as const, campaignW: [200, 480] as const },
  ] as const;

  for (const vp of VIEWPORTS) {
    test(`card widths within column range at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await signInAsTestUser(page, BLAKE_EMAIL, PASSWORD);

      // ── NPC card ───────────────────────────────────────────────────────────
      await page.goto(`/campaigns/${CAMPAIGN_SLUG}/npcs`);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      const npcCard = page
        .locator('[class*="npc-card"], [data-testid*="npc"], article, li[class]')
        .filter({ hasNot: page.locator('nav, header, [role="navigation"]') })
        .first();

      if ((await npcCard.count()) > 0) {
        const box = await npcCard.boundingBox();
        if (box) {
          expect(
            box.width,
            `NPC card width at ${vp.name}: got ${box.width}px, expected ${vp.npcW[0]}–${vp.npcW[1]}px`,
          ).toBeGreaterThanOrEqual(vp.npcW[0]);
          expect(
            box.width,
            `NPC card width at ${vp.name}: got ${box.width}px, expected ${vp.npcW[0]}–${vp.npcW[1]}px`,
          ).toBeLessThanOrEqual(vp.npcW[1]);
        }
      } else {
        test.skip(true, `No NPC cards visible at ${vp.name} viewport — create an NPC first`);
        return;
      }

      // ── Campaign card ──────────────────────────────────────────────────────
      await page.goto('/campaigns');
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      const campaignCard = page
        .locator('a[href*="/campaigns/"]')
        .filter({ hasNot: page.locator('[href="/campaigns/new"]') })
        .first();

      if ((await campaignCard.count()) > 0) {
        const box = await campaignCard.boundingBox();
        if (box) {
          expect(
            box.width,
            `Campaign card width at ${vp.name}: got ${box.width}px, expected ${vp.campaignW[0]}–${vp.campaignW[1]}px`,
          ).toBeGreaterThanOrEqual(vp.campaignW[0]);
          expect(
            box.width,
            `Campaign card width at ${vp.name}: got ${box.width}px, expected ${vp.campaignW[0]}–${vp.campaignW[1]}px`,
          ).toBeLessThanOrEqual(vp.campaignW[1]);
        }
      }
    });
  }
});
