/**
 * Comprehensive QA — Homebrew→Character pipeline, Character sheet interactions, DM Brain
 * Tests: homebrew create, library→character link, character tabs, HP/death saves/conditions, brain
 */
import { chromium } from 'playwright';
import { writeFile } from 'fs/promises';

const BASE_URL = 'http://localhost:3847';
const SS_DIR = 'E:/Projects/QuiverDM/docs/screenshots/comprehensive-qa';
const EMAIL = 'demo@quiverdm.com';
const PASSWORD = 'demo1234';
const CHARACTER_ID = 'cmm7s6d5o00mn907wa8cw5ls6'; // Norm Alfella
const CAMPAIGN_SLUG = 'test-campaign';
const EXISTING_ITEM_ID = 'cmm7uo9sh00084nu7vffy3k2h'; // Sword of Bonfire Keep

let idx = 0;
async function ss(page, name) {
  const filename = `${String(++idx).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: `${SS_DIR}/${filename}`, fullPage: false });
  console.log(`  📸 ${filename}`);
  return filename;
}

async function main() {
  const results = [];
  function log(step, status, detail) {
    results.push({ step, status, detail });
    const icon = status === 'WORKS' ? '✅' : status === 'BROKEN' ? '❌' : status === 'MISSING' ? '⚠️' : '🔵';
    console.log(`${icon} [${status}] ${step}: ${detail}`);
  }

  // mkdir
  await import('fs/promises').then(fs => fs.mkdir(SS_DIR, { recursive: true }));

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 250)); });
  page.on('pageerror', err => consoleErrors.push(`PAGE: ${err.message.slice(0, 250)}`));

  // ── SIGN IN ────────────────────────────────────────────────────────────────
  console.log('\n=== Sign In ===');
  await page.goto(`${BASE_URL}/auth/signin`);
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|characters|onboarding|campaigns)/, { timeout: 20000 });
  await ss(page, 'signin-done');
  log('Sign In', 'WORKS', `Landed at ${page.url()}`);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1: HOMEBREW LIBRARY
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== Homebrew Library ===');
  await page.goto(`${BASE_URL}/homebrew`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  await ss(page, 'homebrew-library');

  const libraryTitle = await page.locator('h1, h2').first().textContent().catch(() => '');
  const hasItems = await page.locator('[data-testid="homebrew-card"], [class*="homebrew"]').count();
  log('Homebrew Library Loads', libraryTitle ? 'WORKS' : 'MISSING', `Title: "${libraryTitle?.trim()}", visible card count: ${hasItems}`);

  // ── CREATE NEW HOMEBREW ITEM ──────────────────────────────────────────────
  console.log('\n=== Create Homebrew Item ===');
  // Find create/new button
  const createBtn = page.locator('a[href*="/homebrew/new"], a[href*="/homebrew/create"], button').filter({ hasText: /new|create|add/i }).first();
  const hasCreate = await createBtn.isVisible({ timeout: 5000 }).catch(() => false);
  log('Homebrew Create Button', hasCreate ? 'WORKS' : 'MISSING', hasCreate ? 'Button found' : 'No create button visible');

  if (hasCreate) {
    await createBtn.click();
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await ss(page, 'homebrew-create-form');

    const formTitle = await page.locator('h1, h2').first().textContent().catch(() => '');
    log('Homebrew Create Form', formTitle ? 'WORKS' : 'MISSING', `Form title: "${formTitle?.trim()}"`);

    // Fill in a test item
    const nameInput = page.getByLabel(/name/i).first();
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('QA Test Sword of Dawn');

      // Set type to item if there's a type selector
      const typeSelect = page.getByLabel(/type/i).first();
      if (await typeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await typeSelect.selectOption('item').catch(() => {});
      }

      // Fill description
      const descField = page.getByLabel(/description/i).first();
      if (await descField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descField.fill('A gleaming sword that radiates the warmth of dawn. +1 to attack rolls.');
      }

      await ss(page, 'homebrew-create-filled');

      // Submit
      const submitBtn = page.getByRole('button', { name: /save|create|submit/i }).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        await ss(page, 'homebrew-create-submitted');

        const newUrl = page.url();
        const savedToDetail = newUrl.includes('/homebrew/') && !newUrl.includes('/new') && !newUrl.includes('/create');
        log('Homebrew Item Created', savedToDetail ? 'WORKS' : 'PARTIAL', `URL after save: ${newUrl}`);
      } else {
        log('Homebrew Submit Button', 'MISSING', 'No submit button found');
      }
    } else {
      log('Homebrew Name Input', 'BROKEN', 'Name input not found on create form');
    }
  }

  // ── ADD TO CHARACTER BUTTON (from existing item) ──────────────────────────
  console.log('\n=== Homebrew → Add to Character ===');
  await page.goto(`${BASE_URL}/homebrew/${EXISTING_ITEM_ID}`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  await ss(page, 'homebrew-item-detail');

  const itemTitle = await page.locator('h1, h2').first().textContent().catch(() => '');
  log('Homebrew Item Detail Page', itemTitle ? 'WORKS' : 'MISSING', `Title: "${itemTitle?.trim()}"`);

  // Find "Add to Character" button
  const addToCharBtn = page.locator('button').filter({ hasText: /add to character|add to.*(char|hero|player)/i }).first();
  const hasAddBtn = await addToCharBtn.isVisible({ timeout: 5000 }).catch(() => false);
  log('Add to Character Button', hasAddBtn ? 'WORKS' : 'MISSING', hasAddBtn ? 'Button visible on item detail page' : 'Button not found');

  if (hasAddBtn) {
    await addToCharBtn.click();
    await page.waitForTimeout(500);
    await ss(page, 'homebrew-add-to-char-dialog');

    // Dialog should open with character list
    const dialog = page.locator('[role="dialog"]');
    const hasDialog = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
    log('Add to Character Dialog', hasDialog ? 'WORKS' : 'MISSING', hasDialog ? 'Dialog opened' : 'No dialog appeared');

    if (hasDialog) {
      const dialogText = await dialog.textContent().catch(() => '');
      log('Add to Character Dialog Content', 'INFO', `Content preview: "${dialogText?.trim().slice(0, 120)}"`);

      // Find and click Norm Alfella
      const normBtn = dialog.locator('button, [role="option"]').filter({ hasText: /Norm/i }).first();
      const hasNorm = await normBtn.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasNorm) {
        await normBtn.click();
        await page.waitForTimeout(1500);
        await ss(page, 'homebrew-added-to-char');

        // Check for success toast
        const toastEl = page.locator('[data-sonner-toast]');
        const hasToast = await toastEl.count() > 0;
        const toastText = hasToast ? await toastEl.first().textContent().catch(() => '') : '';
        log('Add to Character Mutation', hasToast ? 'WORKS' : 'PARTIAL', `Toast: "${toastText?.trim()}", dialog closed: ${!(await dialog.isVisible().catch(() => false))}`);
      } else {
        log('Character Selection in Dialog', 'MISSING', 'Norm Alfella not found in character list');
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2: CHARACTER SHEET — FULL INTERACTION TEST
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== Character Sheet ===');
  await page.goto(`${BASE_URL}/characters/${CHARACTER_ID}`);
  await page.waitForLoadState('networkidle', { timeout: 20000 });
  await ss(page, 'char-sheet-loaded');

  const charTitle = await page.locator('h1, h2').first().textContent().catch(() => '');
  const crashed = await page.locator('text=Something went wrong').count();
  if (crashed) {
    log('Character Sheet Loads', 'BROKEN', 'Error boundary visible');
    await browser.close();
    return;
  }
  log('Character Sheet Loads', charTitle ? 'WORKS' : 'PARTIAL', `Title: "${charTitle?.trim()}"`);

  // ── HOMEBREW TAB ──────────────────────────────────────────────────────────
  console.log('\n=== Homebrew Tab on Character ===');
  const homebrewTab = page.locator('[role="tab"]').filter({ hasText: /homebrew/i }).first();
  const hasHomebrewTab = await homebrewTab.isVisible({ timeout: 5000 }).catch(() => false);
  log('Homebrew Tab Exists', hasHomebrewTab ? 'WORKS' : 'MISSING', hasHomebrewTab ? 'Tab found' : 'No homebrew tab');

  if (hasHomebrewTab) {
    await homebrewTab.click();
    await page.waitForTimeout(800);
    await ss(page, 'char-homebrew-tab');

    const tabPanel = page.locator('[role="tabpanel"]').first();
    const tabContent = await tabPanel.textContent().catch(() => '');
    const hasSwordOfBonfire = /bonfire|sword/i.test(tabContent || '');
    const hasEmptyState = /no homebrew|add items|browse/i.test(tabContent || '');
    log('Homebrew Tab Content', 'WORKS', `Has "Sword of Bonfire Keep": ${hasSwordOfBonfire}. Empty state: ${hasEmptyState}. Preview: "${tabContent?.trim().slice(0, 100)}"`);
  }

  // ── INVENTORY TAB ─────────────────────────────────────────────────────────
  console.log('\n=== Inventory Tab ===');
  const inventoryTab = page.locator('[role="tab"]').filter({ hasText: /inventory/i }).first();
  if (await inventoryTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await inventoryTab.click();
    await page.waitForTimeout(600);
    await ss(page, 'char-inventory-tab');
    const invContent = await page.locator('[role="tabpanel"]').first().textContent().catch(() => '');
    log('Inventory Tab', 'WORKS', `Content preview: "${invContent?.trim().slice(0, 100)}"`);
  }

  // ── OVERVIEW TAB: HP INTERACTIONS ─────────────────────────────────────────
  console.log('\n=== HP Interactions (Overview) ===');
  const overviewTab = page.locator('[role="tab"]').filter({ hasText: /overview/i }).first();
  await overviewTab.click();
  await page.waitForTimeout(600);

  // Current HP display
  const hpDisplay = page.locator('[title="Scroll up/down to adjust HP"]').first();
  const hasHpDisplay = await hpDisplay.isVisible({ timeout: 3000 }).catch(() => false);
  const hpText = hasHpDisplay ? await hpDisplay.textContent() : 'not found';
  log('HP Display', hasHpDisplay ? 'WORKS' : 'MISSING', `HP text: "${hpText?.trim()}"`);

  // HPTracker — look for a click-to-open HP edit modal or +/- buttons
  const hpTracker = page.locator('[data-testid="hp-tracker"], button[title*="HP"], button[aria-label*="HP"]').first();
  const hasHpTracker = await hpTracker.isVisible({ timeout: 3000 }).catch(() => false);
  log('HPTracker Button', hasHpTracker ? 'WORKS' : 'MISSING', hasHpTracker ? 'HPTracker button found' : 'No HPTracker button — HP only editable via scroll');

  // Scroll to change HP
  if (hasHpDisplay) {
    const hpBefore = await hpDisplay.textContent();
    await hpDisplay.dispatchEvent('wheel', { deltaY: -100 }); // scroll up = heal
    await page.waitForTimeout(300);
    const hpAfter = await hpDisplay.textContent();
    await ss(page, 'char-hp-after-scroll');
    log('HP Scroll Interaction', hpBefore !== hpAfter ? 'WORKS' : 'PARTIAL', `Before: "${hpBefore?.trim()}" → After: "${hpAfter?.trim()}"`);
  }

  // Temp HP — find temp HP field
  const tempHpEl = page.locator('[placeholder*="temp"], [aria-label*="temp"], input[title*="temp"]').first();
  const hasTempHp = await tempHpEl.isVisible({ timeout: 2000 }).catch(() => false);
  log('Temp HP Input', hasTempHp ? 'WORKS' : 'MISSING', hasTempHp ? 'Temp HP input visible' : 'No temp HP field found');

  await ss(page, 'char-overview-full');

  // ── DEATH SAVES ───────────────────────────────────────────────────────────
  console.log('\n=== Death Saves ===');
  const deathSavePips = page.locator('[data-testid*="death"], button[aria-label*="death"], .death-save').first();
  const hasDeathSaves = await deathSavePips.isVisible({ timeout: 3000 }).catch(() => false);

  // More likely: death saves use simple circle buttons
  const deathSaveArea = page.locator('text=Death Saves').first();
  const hasDeathSaveLabel = await deathSaveArea.isVisible({ timeout: 3000 }).catch(() => false);
  log('Death Saves Section', hasDeathSaveLabel ? 'WORKS' : 'MISSING', hasDeathSaveLabel ? 'Death Saves label visible' : 'Death Saves section not found');

  if (hasDeathSaveLabel) {
    // Click one success pip (usually small circles near the Death Saves text)
    const successPip = page.locator('button[aria-label*="success"], button[title*="success"]').first();
    const hasPip = await successPip.isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasPip) {
      // DeathSaves component renders simple circles — find them by proximity
      const deathSaveParent = deathSaveArea.locator('..').locator('..').locator('button').first();
      const hasParentBtn = await deathSaveParent.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasParentBtn) {
        await deathSaveParent.click();
        await page.waitForTimeout(300);
        await ss(page, 'char-death-save-clicked');
        log('Death Save Toggle', 'WORKS', 'Clicked death save pip');
      } else {
        log('Death Save Toggle', 'MISSING', 'Cannot find clickable death save pips');
      }
    } else {
      await successPip.click();
      await page.waitForTimeout(300);
      await ss(page, 'char-death-save-clicked');
      log('Death Save Toggle', 'WORKS', 'Clicked success pip');
    }
  }

  // ── CONDITIONS ────────────────────────────────────────────────────────────
  console.log('\n=== Conditions ===');
  const conditionsSection = page.locator('text=Conditions, text=conditions').first();
  const hasConditions = await conditionsSection.isVisible({ timeout: 3000 }).catch(() => false);
  log('Conditions Section', hasConditions ? 'WORKS' : 'MISSING', hasConditions ? 'Conditions section visible' : 'No conditions UI found on character sheet');

  // ── SPELLS TAB ────────────────────────────────────────────────────────────
  console.log('\n=== Spells Tab ===');
  const spellsTab = page.locator('[role="tab"]').filter({ hasText: /spell/i }).first();
  if (await spellsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await spellsTab.click();
    await page.waitForTimeout(600);
    await ss(page, 'char-spells-tab');
    const spellContent = await page.locator('[role="tabpanel"]').first().textContent().catch(() => '');
    const hasSpellSlots = /slot|cantrip|prepared/i.test(spellContent || '');
    log('Spells Tab', 'WORKS', `Spell slots visible: ${hasSpellSlots}. Preview: "${spellContent?.trim().slice(0, 100)}"`);
  }

  // ── SKILLS TAB ────────────────────────────────────────────────────────────
  console.log('\n=== Skills Tab ===');
  const skillsTab = page.locator('[role="tab"]').filter({ hasText: /skills/i }).first();
  if (await skillsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skillsTab.click();
    await page.waitForTimeout(600);
    await ss(page, 'char-skills-tab');
    const skillContent = await page.locator('[role="tabpanel"]').first().textContent().catch(() => '');
    const hasSkillList = /acrobatics|perception|stealth|athletics/i.test(skillContent || '');
    log('Skills Tab', 'WORKS', `Has skill list: ${hasSkillList}. Preview: "${skillContent?.trim().slice(0, 100)}"`);

    // Click a skill to roll
    const skillRollBtn = page.locator('[role="tabpanel"] button').first();
    if (await skillRollBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const skillLabel = await skillRollBtn.textContent();
      await skillRollBtn.click();
      await page.waitForTimeout(400);
      await ss(page, 'char-skill-rolled');
      log('Skill Roll', 'WORKS', `Rolled: "${skillLabel?.trim().slice(0, 30)}"`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 3: DM BRAIN
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== DM Brain ===');
  await page.goto(`${BASE_URL}/campaigns/${CAMPAIGN_SLUG}/brain`);
  await page.waitForLoadState('networkidle', { timeout: 20000 });
  await ss(page, 'brain-dashboard');

  const brainTitle = await page.locator('body').textContent().catch(() => '');
  const hasBrainHeading = /DM Brain/i.test(brainTitle || '');
  const hasError = /404|something went wrong|internal server error/i.test(brainTitle || '');
  log('Brain Dashboard Loads', hasBrainHeading && !hasError ? 'WORKS' : hasError ? 'BROKEN' : 'MISSING',
    hasBrainHeading ? 'DM Brain heading found' : 'Brain heading not found');

  // World Pressure
  const worldPressure = await page.locator('text=World Pressure').first().isVisible({ timeout: 5000 }).catch(() => false);
  log('World Pressure Section', worldPressure ? 'WORKS' : 'MISSING', worldPressure ? 'Visible' : 'Not found');

  // Open Hooks
  const openHooks = await page.locator('text=Open Hooks').first().isVisible({ timeout: 5000 }).catch(() => false);
  log('Open Hooks Section', openHooks ? 'WORKS' : 'MISSING', openHooks ? 'Visible' : 'Not found');

  // Entities
  const entityCards = await page.locator('[data-testid="entity-card"]').count();
  const hasEmptyState = await page.locator('text=no entities').first().isVisible({ timeout: 3000 }).catch(() => false);
  log('Brain Entity State', entityCards > 0 ? 'WORKS' : hasEmptyState ? 'PARTIAL' : 'MISSING',
    entityCards > 0 ? `${entityCards} entity cards visible` : `Empty state: ${hasEmptyState}`);

  await ss(page, 'brain-dashboard-full');

  // ── BRAIN ENTITY DETAIL ───────────────────────────────────────────────────
  if (entityCards > 0) {
    console.log('\n=== Brain Entity Detail ===');
    await page.locator('[data-testid="entity-card"]').first().click();
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await ss(page, 'brain-entity-detail');

    const entityUrl = page.url();
    log('Brain Entity Detail Navigation', entityUrl.includes('/brain/entities/') ? 'WORKS' : 'PARTIAL', `URL: ${entityUrl}`);

    const entityBody = await page.locator('body').textContent().catch(() => '');
    const hasProperties = /properties|description/i.test(entityBody || '');
    const hasRelationships = /relationship/i.test(entityBody || '');
    log('Entity Detail Properties Section', hasProperties ? 'WORKS' : 'MISSING', hasProperties ? 'Properties visible' : 'No properties section');
    log('Entity Detail Relationships Section', hasRelationships ? 'WORKS' : 'MISSING', hasRelationships ? 'Relationships visible' : 'No relationships section');

    // World State section
    const worldState = await page.locator('text=World State').first().isVisible({ timeout: 5000 }).catch(() => false);
    log('Entity World State Section', worldState ? 'WORKS' : 'MISSING', worldState ? 'World State accordion visible' : 'No World State section on entity detail');
  }

  // ── BRAIN — NPC WORLD STATE ───────────────────────────────────────────────
  console.log('\n=== Brain via NPC Page ===');
  await page.goto(`${BASE_URL}/campaigns/${CAMPAIGN_SLUG}/npcs`);
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  const npcLink = page.locator('a[href*="/npcs/"]:not([href$="/new"])').first();
  const hasNpc = await npcLink.isVisible({ timeout: 5000 }).catch(() => false);
  if (hasNpc) {
    await npcLink.click();
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await ss(page, 'npc-detail-world-state');

    const npcBody = await page.locator('body').textContent().catch(() => '');
    const hasWorldState = /World State/i.test(npcBody || '');
    log('NPC Detail → World State Section', hasWorldState ? 'WORKS' : 'MISSING',
      hasWorldState ? 'World State accordion on NPC detail page' : 'No World State section on NPC detail');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 4: IMPORT FROM MEDIA (quick smoke test)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== Import from Media ===');
  await page.goto(`${BASE_URL}/homebrew`);
  await page.waitForLoadState('networkidle', { timeout: 10000 });

  const importBtn = page.locator('button').filter({ hasText: /import|upload/i }).first();
  const hasImport = await importBtn.isVisible({ timeout: 5000 }).catch(() => false);
  log('Import Button Visible', hasImport ? 'WORKS' : 'MISSING', hasImport ? 'Import button found' : 'No import button on homebrew page');

  if (hasImport) {
    await importBtn.click();
    await page.waitForTimeout(500);
    await ss(page, 'import-dialog-open');

    const importDialog = page.locator('[role="dialog"]');
    const hasImportDialog = await importDialog.isVisible({ timeout: 3000 }).catch(() => false);
    log('Import Dialog Opens', hasImportDialog ? 'WORKS' : 'MISSING', hasImportDialog ? 'Dialog opened' : 'No dialog');

    if (hasImportDialog) {
      const dialogContent = await importDialog.textContent().catch(() => '');
      // Check for mode toggle (homebrew/notes) — removed in refactor; check for auto-detect wording
      const hasAutoDetect = /auto|detect|format/i.test(dialogContent || '');
      const hasDropZone = /drop|upload|browse/i.test(dialogContent || '');
      log('Import Dialog Content', 'WORKS', `Auto-detect wording: ${hasAutoDetect}, Drop zone: ${hasDropZone}. Preview: "${dialogContent?.trim().slice(0, 100)}"`);
      await page.keyboard.press('Escape');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FINAL: CONSOLE ERRORS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=== Console Errors ===');
  if (consoleErrors.length === 0) {
    log('Console Errors', 'WORKS', 'Zero JS errors across entire session');
  } else {
    const unique = [...new Set(consoleErrors)];
    log('Console Errors', 'BROKEN', `${unique.length} unique errors:\n  ${unique.join('\n  ')}`);
  }

  await ss(page, 'final-state');
  await browser.close();

  // ── REPORT ────────────────────────────────────────────────────────────────
  const reportPath = `${SS_DIR}/qa-results.json`;
  await writeFile(reportPath, JSON.stringify(results, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('COMPREHENSIVE QA RESULTS');
  console.log('='.repeat(60));
  const works = results.filter(r => r.status === 'WORKS').length;
  const broken = results.filter(r => r.status === 'BROKEN').length;
  const missing = results.filter(r => r.status === 'MISSING').length;
  const partial = results.filter(r => r.status === 'PARTIAL').length;
  console.log(`✅ WORKS: ${works}  ❌ BROKEN: ${broken}  ⚠️ MISSING: ${missing}  🔵 PARTIAL: ${partial}`);
  console.log('');
  results.filter(r => r.status !== 'WORKS' && r.status !== 'INFO').forEach(r => {
    const icon = r.status === 'BROKEN' ? '❌' : r.status === 'MISSING' ? '⚠️' : '🔵';
    console.log(`${icon} ${r.step}: ${r.detail}`);
  });
}

main().catch(console.error);
