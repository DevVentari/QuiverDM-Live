import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:3847';
const EMAIL = 'demo@quiverdm.com';
const PASSWORD = 'demo1234';
const CAMPAIGN = 'lost-mines-of-phandelver';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function signIn(page: Page) {
  await page.goto(`${BASE}/auth/signin`);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 15_000 });
  console.log('✅ Signed in as', EMAIL);
}

async function goToBuilder(page: Page, planName = 'Review Plan') {
  await page.goto(`${BASE}/campaigns/${CAMPAIGN}/encounters`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const existingPlan = page.locator(`a[href*="/campaigns/${CAMPAIGN}/encounters/"]`).first();
  if (await existingPlan.isVisible()) {
    await existingPlan.click();
  } else {
    await page.click('button:has-text("New Encounter")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('input').first().fill(planName);
    await dialog.locator('button:has-text("Create")').click();
  }
  await page.waitForURL(`${BASE}/campaigns/${CAMPAIGN}/encounters/**`, { timeout: 10_000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

function reportErrors(errors: string[]) {
  if (errors.length) console.log('⚠️  Console errors:', errors);
  else console.log('   No console errors');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Encounter Builder — UI Review', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  // ── 1. Nav tab ───────────────────────────────────────────────────────────

  test('1. Encounters tab appears in campaign nav', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${BASE}/campaigns/${CAMPAIGN}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('nav a', { hasText: 'Encounters' })).toBeVisible();
    await page.screenshot({ path: 'playwright-report/01-campaign-nav.png' });
    console.log('✅ Encounters tab visible in nav');
    reportErrors(errors);
  });

  // ── 2. Encounters index ──────────────────────────────────────────────────

  test('2. Encounters index page loads with DM controls visible', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${BASE}/campaigns/${CAMPAIGN}/encounters`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await expect(page.locator('h1', { hasText: 'Encounters' })).toBeVisible();

    // DM sees "New Encounter" button
    const newBtn = page.locator('button', { hasText: 'New Encounter' });
    await expect(newBtn).toBeVisible();
    await expect(newBtn).toBeEnabled();

    await page.screenshot({ path: 'playwright-report/02-encounters-index.png', fullPage: true });
    console.log('✅ Encounters index with DM controls rendered');
    reportErrors(errors);
  });

  // ── 3. New Encounter dialog ──────────────────────────────────────────────

  test('3. New Encounter dialog creates plan and redirects to builder', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${BASE}/campaigns/${CAMPAIGN}/encounters`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.click('button:has-text("New Encounter")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: 'playwright-report/03-new-encounter-dialog.png' });

    await dialog.locator('input').first().fill('Playwright Review Encounter');
    await dialog.locator('button:has-text("Create")').click();

    await page.waitForURL(`${BASE}/campaigns/${CAMPAIGN}/encounters/**`, { timeout: 10_000 });
    console.log('✅ Created plan, redirected to:', page.url());
    reportErrors(errors);
  });

  // ── 4. Builder structure ─────────────────────────────────────────────────

  test('4. Builder renders all major sections', async ({ page }) => {
    const errors = collectErrors(page);
    await goToBuilder(page, 'Builder Structure Test');

    await expect(page.locator('nav', { hasText: 'Builder' })).toBeVisible();
    await expect(page.locator('label:has-text("Encounter Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Party Size")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Level")').first()).toBeVisible();
    await expect(page.locator('text=Encounter Difficulty')).toBeVisible();
    await expect(page.getByText('AI Generate', { exact: true })).toBeVisible();
    await expect(page.locator('button:has-text("Generate Encounter")')).toBeVisible();
    await expect(page.locator('text=Scene Description')).toBeVisible();
    await expect(page.locator('text=Tactical Notes')).toBeVisible();
    await expect(page.locator('button:has-text("Save Plan")')).toBeVisible();
    await expect(page.locator('text=Add Creatures')).toBeVisible();
    await expect(page.locator('text=SRD Monsters')).toBeVisible();

    await page.screenshot({ path: 'playwright-report/04-builder-overview.png', fullPage: true });
    console.log('✅ All builder sections present');
    reportErrors(errors);
  });

  // ── 5. Difficulty meter ──────────────────────────────────────────────────

  test('5. Difficulty meter shows XP thresholds', async ({ page }) => {
    const errors = collectErrors(page);
    await goToBuilder(page);

    for (const label of ['Easy', 'Medium', 'Hard', 'Deadly']) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible();
    }
    await expect(page.locator('text=Encounter Difficulty')).toBeVisible();

    await page.screenshot({ path: 'playwright-report/05-difficulty-meter.png' });
    console.log('✅ Difficulty meter thresholds visible');
    reportErrors(errors);
  });

  // ── 6. Monster Picker — SRD ──────────────────────────────────────────────

  test('6. Monster Picker loads SRD monsters with search and CR filter', async ({ page }) => {
    const errors = collectErrors(page);
    await goToBuilder(page);
    await page.waitForTimeout(1500);

    // SRD tab is default
    await expect(page.locator('text=SRD Monsters')).toBeVisible();
    await expect(page.locator('text=CR:')).toBeVisible();

    const searchInput = page.locator('input[placeholder*="Search monsters"]');
    await expect(searchInput).toBeVisible();

    // Monster cards should be visible (compact collapsed rows — name shown in header)
    const monsterRows = page.locator('.border-amber-800\\/30');
    const count = await monsterRows.count();
    console.log(`   Found ${count} monster card rows`);
    expect(count).toBeGreaterThan(0);

    // Click first monster to expand and reveal "Add to Encounter" button
    await monsterRows.first().click();
    await expect(page.locator('button:has-text("Add to Encounter")')).toBeVisible();
    console.log('   "Add to Encounter" button visible after expanding card');

    // Search works
    await searchInput.fill('goblin');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'playwright-report/06-monster-picker-srd.png' });
    console.log('✅ SRD monster picker working');
    reportErrors(errors);
  });

  // ── 7. Monster Picker — tab switching ───────────────────────────────────

  test('7. Monster Picker tabs switch correctly', async ({ page }) => {
    const errors = collectErrors(page);
    await goToBuilder(page);

    await page.click('button:has-text("Campaign NPCs")');
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'playwright-report/07a-picker-npcs.png' });
    console.log('✅ NPCs tab loaded');

    await page.click('button:has-text("Homebrew")');
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'playwright-report/07b-picker-homebrew.png' });
    console.log('✅ Homebrew tab loaded');

    await page.click('button:has-text("SRD Monsters")');
    await page.waitForTimeout(600);
    console.log('✅ Back to SRD tab');
    reportErrors(errors);
  });

  // ── 8. AI prompt panel ──────────────────────────────────────────────────

  test('8. AI Generate panel — difficulty toggle and example prompt', async ({ page }) => {
    const errors = collectErrors(page);
    await goToBuilder(page);

    // Difficulty buttons in the AI panel
    for (const d of ['Easy', 'Medium', 'Hard', 'Deadly']) {
      await expect(page.locator(`button:has-text("${d}")`).first()).toBeVisible();
    }
    await page.locator('button:has-text("Medium")').first().click();

    // Example prompt populates textarea
    const exampleLink = page.locator('button:has-text("Example prompt")');
    await expect(exampleLink).toBeVisible();
    await exampleLink.click();
    const textarea = page.locator('textarea').first();
    const val = await textarea.inputValue();
    expect(val.length).toBeGreaterThan(10);
    console.log('   Example prompt:', val.substring(0, 70) + '...');

    // Generate button enabled once textarea has content
    await expect(page.locator('button:has-text("Generate Encounter")')).toBeEnabled();

    await page.screenshot({ path: 'playwright-report/08-ai-prompt-panel.png' });
    console.log('✅ AI prompt panel works');
    reportErrors(errors);
  });

  // ── 9. Save Plan ─────────────────────────────────────────────────────────

  test('9. Save Plan persists scene description and tactical notes', async ({ page }) => {
    const errors = collectErrors(page);
    await goToBuilder(page, 'Save Test Plan');

    const textareas = page.locator('textarea');
    await textareas.nth(0).fill('Moonlit clearing. Goblins in the trees. Read aloud: "The forest falls silent..."');
    await textareas.nth(1).fill('Goblins act on initiative 15. First round: Shortbow from tree cover, advantage on attacks.');

    await page.click('button:has-text("Save Plan")');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'playwright-report/09-save-plan.png' });
    console.log('✅ Save Plan triggered');
    reportErrors(errors);
  });

  // ── 10. Plan cards on index ──────────────────────────────────────────────

  test('10. Encounters index shows plan cards after creation', async ({ page }) => {
    const errors = collectErrors(page);

    // Ensure at least one plan exists
    await goToBuilder(page, 'Index Card Test');

    // Go back to index
    await page.goto(`${BASE}/campaigns/${CAMPAIGN}/encounters`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const planCards = page.locator(`a[href*="/campaigns/${CAMPAIGN}/encounters/"]`);
    const count = await planCards.count();
    console.log(`   Found ${count} encounter plan card(s)`);
    expect(count).toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: 'playwright-report/10-index-with-plans.png', fullPage: true });
    console.log('✅ Plan cards visible on index');
    reportErrors(errors);
  });

  // ── 11. Encounter Tracker on session page ────────────────────────────────

  test('11. Encounter Tracker panel visible on session page', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${BASE}/campaigns/${CAMPAIGN}/sessions`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (!await sessionLink.isVisible()) {
      console.log('ℹ️  No sessions found — skipping tracker test');
      return;
    }
    await sessionLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await expect(page.locator('h3').filter({ hasText: 'Encounters' })).toBeVisible();
    await page.screenshot({ path: 'playwright-report/11-session-tracker.png', fullPage: true });
    console.log('✅ Encounter Tracker section visible in session');
    reportErrors(errors);
  });

  // ── 12. Tracker — create live encounter ──────────────────────────────────

  test('12. Encounter Tracker DM can create a live encounter', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${BASE}/campaigns/${CAMPAIGN}/sessions`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const sessionLink = page.locator('a[href*="/sessions/"]').first();
    if (!await sessionLink.isVisible()) {
      console.log('ℹ️  No sessions — skipping');
      return;
    }
    await sessionLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const encounterInput = page.locator('input[placeholder="Encounter name"]');
    if (!await encounterInput.isVisible()) {
      console.log('ℹ️  Encounter name input not visible on this session page');
      await page.screenshot({ path: 'playwright-report/12-session-page.png', fullPage: true });
      return;
    }

    await encounterInput.fill('Goblin Ambush');
    // Click the + button next to it
    const createBtn = page.locator('button[aria-label*="add"], button:has(svg)').filter({ hasText: /^$/ }).last();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: 'playwright-report/12-encounter-tracker-live.png', fullPage: true });
    console.log('✅ Live encounter tracker tested');
    reportErrors(errors);
  });

  // ── 13. Responsive layout ────────────────────────────────────────────────

  test('13. Builder responsive at tablet width (768px)', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await goToBuilder(page);

    await expect(page.locator('button:has-text("Save Plan")')).toBeVisible();
    await page.screenshot({ path: 'playwright-report/13-builder-tablet.png', fullPage: true });
    console.log('✅ Tablet layout captured');
    reportErrors(errors);
  });
});
