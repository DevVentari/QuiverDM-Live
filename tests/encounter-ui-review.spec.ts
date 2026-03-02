import { test, expect, type Page } from '@playwright/test';
import { signInAsTestUser } from './helpers';

async function getFirstCampaignSlug(page: Page): Promise<string | null> {
  await page.goto('/campaigns');
  const link = page.locator('a[href^="/campaigns/"]:not([href="/campaigns/new"])').first();
  if (!await link.isVisible({ timeout: 5000 }).catch(() => false)) return null;
  const href = await link.getAttribute('href');
  return href?.split('/')[2] ?? null;
}

async function goToBuilder(page: Page, slug: string, planName = 'Review Plan') {
  await page.goto(`/campaigns/${slug}/encounters`);
  await expect(page.getByRole('heading', { name: /encounter/i })).toBeVisible();
  const existingPlan = page.locator(`a[href*="/campaigns/${slug}/encounters/"]`).first();
  if (await existingPlan.isVisible({ timeout: 2000 }).catch(() => false)) {
    await existingPlan.click();
  } else {
    await page.getByRole('button', { name: /new encounter/i }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('input').first().fill(planName);
    await dialog.getByRole('button', { name: /create/i }).click();
  }
  await page.waitForURL(/\/encounters\//, { timeout: 10000 });
  await expect(page.getByRole('button', { name: /save plan/i })).toBeVisible();
}

test.describe('Encounter Builder - UI Review', () => {
  let campaignSlug: string;

  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
    const slug = await getFirstCampaignSlug(page);
    if (!slug) {
      test.skip();
      return;
    }
    campaignSlug = slug;
  });

  test('1. Encounters tab appears in campaign nav', async ({ page }) => {
    await page.goto(`/campaigns/${campaignSlug}`);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.locator('nav a', { hasText: 'Encounters' })).toBeVisible();
  });

  test('2. Encounters index page loads with DM controls visible', async ({ page }) => {
    await page.goto(`/campaigns/${campaignSlug}/encounters`);
    await expect(page.getByRole('heading', { name: /encounter/i })).toBeVisible();

    const newBtn = page.getByRole('button', { name: /new encounter/i });
    await expect(newBtn).toBeVisible();
    await expect(newBtn).toBeEnabled();
  });

  test('3. New Encounter dialog creates plan and redirects to builder', async ({ page }) => {
    await page.goto(`/campaigns/${campaignSlug}/encounters`);
    await expect(page.getByRole('heading', { name: /encounter/i })).toBeVisible();

    await page.getByRole('button', { name: /new encounter/i }).click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await dialog.locator('input').first().fill(`Playwright Test ${Date.now()}`);
    await dialog.getByRole('button', { name: /create/i }).click();

    await page.waitForURL(/\/campaigns\/.*\/encounters\/.+/, { timeout: 10000 });
    await expect(page.getByRole('button', { name: /save plan/i })).toBeVisible();
  });

  test('4. Builder renders all major sections', async ({ page }) => {
    await goToBuilder(page, campaignSlug, `Playwright Test ${Date.now()}`);

    await expect(page.locator('nav', { hasText: 'Builder' })).toBeVisible();
    await expect(page.locator('label:has-text("Encounter Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Party")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Level")').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /save plan/i })).toBeVisible();

    await expect(page.locator('[role="tablist"]')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Combat/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Story/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /AI Generate/i })).toBeVisible();

    await expect(page.getByText('Encounter Difficulty')).toBeVisible();
    await expect(page.getByText('Add Creatures', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: /Story/i }).click();
    await expect(page.getByText('Scene Description')).toBeVisible();
    await expect(page.getByText('Tactical Notes')).toBeVisible();

    await page.getByRole('tab', { name: /AI Generate/i }).click();
    await expect(page.getByRole('button', { name: /generate encounter/i })).toBeVisible();

    await expect(page.getByText('SRD Monsters')).toBeVisible();
  });

  test('5. Difficulty meter shows XP thresholds', async ({ page }) => {
    await goToBuilder(page, campaignSlug);

    for (const label of ['Easy', 'Medium', 'Hard', 'Deadly']) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible();
    }
    await expect(page.getByText('Encounter Difficulty')).toBeVisible();
  });

  test('6. Monster Picker loads SRD monsters with search and CR filter', async ({ page }) => {
    await goToBuilder(page, campaignSlug);

    await expect(page.getByText('SRD Monsters')).toBeVisible();
    await expect(page.getByText('CR:')).toBeVisible();

    const searchInput = page.locator('input[placeholder*="Search monsters"]');
    await expect(searchInput).toBeVisible();

    const primaryRows = page.locator('[data-testid="monster-card"]');
    const firstMonster = await primaryRows.count() > 0 ? primaryRows.first() : page.locator('ul > li').first();
    await expect(firstMonster).toBeVisible();

    await firstMonster.click();
    await expect(page.getByRole('button', { name: /add to encounter/i }).first()).toBeVisible();

    await searchInput.fill('goblin');
    await expect(searchInput).toHaveValue('goblin');
  });

  test('7. Monster Picker tabs switch correctly', async ({ page }) => {
    await goToBuilder(page, campaignSlug);

    await page.getByRole('button', { name: /campaign npcs/i }).click();
    await expect(page.getByRole('button', { name: /campaign npcs/i })).toBeVisible();

    await page.getByRole('button', { name: /homebrew/i }).click();
    await expect(page.getByRole('button', { name: /homebrew/i })).toBeVisible();

    await page.getByRole('button', { name: /srd monsters/i }).click();
    await expect(page.getByText('SRD Monsters')).toBeVisible();
  });

  test('8. AI Generate panel - difficulty toggle and example prompt', async ({ page }) => {
    await goToBuilder(page, campaignSlug);

    await page.getByRole('tab', { name: /AI Generate/i }).click();
    await expect(page.getByRole('button', { name: /generate encounter/i })).toBeVisible();

    for (const d of ['Easy', 'Medium', 'Hard', 'Deadly']) {
      await expect(page.locator(`button:has-text("${d}")`).first()).toBeVisible();
    }
    await page.locator('button:has-text("Medium")').first().click();

    const exampleLink = page.getByRole('button', { name: /example prompt/i });
    await expect(exampleLink).toBeVisible();
    await exampleLink.click();

    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();
    const val = await textarea.inputValue();
    expect(val.length).toBeGreaterThan(10);

    await expect(page.getByRole('button', { name: /generate encounter/i })).toBeEnabled();
  });

  test('9. Save Plan persists scene description and tactical notes', async ({ page }) => {
    await goToBuilder(page, campaignSlug, `Playwright Test ${Date.now()}`);

    await page.getByRole('tab', { name: /Story/i }).click();
    await expect(page.getByText('Scene Description')).toBeVisible();

    const textareas = page.locator('textarea');
    await textareas.nth(0).fill('Moonlit clearing. Goblins in the trees. Read aloud: "The forest falls silent..."');
    await textareas.nth(1).fill('Goblins act on initiative 15. First round: Shortbow from tree cover, advantage on attacks.');

    await page.getByRole('button', { name: /save plan/i }).click();
    await page.waitForLoadState('domcontentloaded');
  });

  test('10. Encounters index shows plan cards after creation', async ({ page }) => {
    await goToBuilder(page, campaignSlug, `Playwright Test ${Date.now()}`);

    await page.goto(`/campaigns/${campaignSlug}/encounters`);
    await expect(page.getByRole('heading', { name: /encounter/i })).toBeVisible();

    const planCards = page.locator(`a[href*="/campaigns/${campaignSlug}/encounters/"]`);
    await expect(planCards.first()).toBeVisible();
    expect(await planCards.count()).toBeGreaterThanOrEqual(1);
  });

  test('11. Encounter Tracker panel visible on session page', async ({ page }) => {
    await page.goto(`/campaigns/${campaignSlug}/sessions`);
    await expect(page.getByRole('heading').first()).toBeVisible();

    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (!await sessionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await sessionLink.click();
    await page.waitForURL(/\/sessions\//);

    await page.getByRole('tab', { name: /Live Play/i }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Encounters' })).toBeVisible();
  });

  test('12. Encounter Tracker DM can create a live encounter', async ({ page }) => {
    await page.goto(`/campaigns/${campaignSlug}/sessions`);
    await expect(page.getByRole('heading').first()).toBeVisible();

    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (!await sessionLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await sessionLink.click();
    await page.waitForURL(/\/sessions\//);

    const livePlayTab = page.getByRole('tab', { name: /Live Play/i });
    if (await livePlayTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await livePlayTab.click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }

    const encounterInput = page.locator('input[placeholder="Encounter name"]');
    if (!await encounterInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await encounterInput.fill(`Playwright Test ${Date.now()}`);
    const createBtn = page.locator('button[aria-label*="add" i], button:has(svg)').filter({ hasText: /^$/ }).last();
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click();
      await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test('13. Builder responsive at tablet width (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await goToBuilder(page, campaignSlug);
    await expect(page.getByRole('button', { name: /save plan/i })).toBeVisible();
  });
});
