/**
 * QA: Character Sheet Player Session — Part 2
 * Focused tests: ability score rolling, tabs, dice roller UI, error investigation.
 * Runs after HP is already confirmed working.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const BASE_URL = 'http://localhost:3847';
const SS_DIR = 'E:/Projects/QuiverDM/docs/screenshots/character-sheet-qa';
const EMAIL = 'demo@quiverdm.com';
const PASSWORD = 'demo1234';
// Use a fresh character that hasn't had HP forced to 0
const CHARACTER_ID = 'cmm7s6f8o00mv907wioxzfqo5'; // Skreek Swicschnout (Rogue)

let screenshotIndex = 50; // Start at 50 to not overwrite part 1
async function ss(page, name) {
  const filename = `${String(++screenshotIndex).padStart(2, '0')}-${name}.png`;
  const path = `${SS_DIR}/${filename}`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  Screenshot: ${filename}`);
  return filename;
}

async function main() {
  if (!existsSync(SS_DIR)) await mkdir(SS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Capture console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(`PAGE ERROR: ${err.message}`));

  const results = [];
  function log(step, status, detail) {
    const entry = { step, status, detail };
    results.push(entry);
    console.log(`[${status}] ${step}: ${detail}`);
  }

  // Sign in
  await page.goto(`${BASE_URL}/auth/signin`);
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|characters|campaigns|onboarding)/, { timeout: 15000 });
  console.log(`Signed in. URL: ${page.url()}`);

  // ── CHARACTER SHEET LOAD ─────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/characters/${CHARACTER_ID}`, { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  const charTitle = await page.locator('h1').first().textContent().catch(() => '');
  console.log(`Character: ${charTitle?.trim()}`);
  await ss(page, 'p2-character-loaded');

  // ── TEST: CRASH INVESTIGATION — what caused "Something went wrong" ───────────
  console.log('\n=== Crash Investigation ===');
  // Force HP to 0 as part 1 did, then click death save, watch for errors
  const hpEl = page.locator('[title="Scroll up/down to adjust HP"]').first();
  if (await hpEl.count() > 0) {
    for (let i = 0; i < 60; i++) await hpEl.dispatchEvent('wheel', { deltaY: 100 });
    await page.waitForTimeout(1500); // let debounce fire and save complete
    await ss(page, 'p2-hp-at-zero');

    const deathSaves = page.locator('text=Death Saves');
    if (await deathSaves.count() > 0) {
      // Click a death save success button
      const successDots = page.locator('.rounded-full.border').all();
      const dots = await successDots;
      if (dots.length > 0) {
        await dots[0].click();
        await page.waitForTimeout(800);
        await ss(page, 'p2-death-save-after-click');

        // Check if page crashed
        const crashed = await page.locator('text=Something went wrong').count();
        if (crashed > 0) {
          log('Death Save Toggle — Crash', 'BROKEN', 'Clicking death save success triggers "Something went wrong" error boundary. Likely the onUpdate Promise<void> inside DeathSaves.onChange is not awaited properly OR the features patch structure causes a server error.');
          await ss(page, 'p2-crash-confirmed');
          // Log any console errors captured
          if (consoleErrors.length > 0) {
            log('Console Errors at Crash', 'BROKEN', consoleErrors.slice(0, 5).join(' | '));
          }
        } else {
          log('Death Save Toggle', 'WORKS', 'No crash after clicking death save');
        }
      }
    }
  }

  // ── Navigate fresh to character (different char to avoid HP=0 state) ─────────
  console.log('\n=== Navigate to Norm Alfella for tab/ability tests ===');
  const NORM_ID = 'cmm7s6d5o00mn907wa8cw5ls6';
  await page.goto(`${BASE_URL}/characters/${NORM_ID}`, { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  const normTitle = await page.locator('h1').first().textContent().catch(() => '');
  console.log(`Character: ${normTitle?.trim()}`);
  await ss(page, 'p2-norm-loaded');

  // ── TEST: ABILITY SCORE ROLL ─────────────────────────────────────────────────
  console.log('\n=== Ability Score Roll Test ===');
  await ss(page, 'p2-overview-tab-full');

  // The ability score buttons have specific class structure — find by role button within card
  // From code: buttons with class containing "rounded-lg border-2"
  // Try finding them by their text content (str, dex, etc.)
  const abilityScoreLabels = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  let abilityButtonFound = false;

  for (const label of abilityScoreLabels) {
    const btn = page.locator(`button:has-text("${label}")`).first();
    if (await btn.count() > 0) {
      abilityButtonFound = true;
      console.log(`  Found ability button: ${label}`);
      await btn.click();
      await page.waitForTimeout(500);
      await ss(page, `p2-ability-roll-${label}`);

      // Check for dice result — useDiceRoller might show a floating panel or toast
      const toasts = await page.locator('[role="status"], [data-sonner-toast], [class*="toast"]').count();
      const floatingDice = await page.locator('[class*="dice-result"], [class*="DiceRoller"], [class*="dice_roll"]').count();

      if (toasts > 0 || floatingDice > 0) {
        log(`Ability Check Roll (${label.toUpperCase()})`, 'WORKS', `Clicking ${label} shows dice result (toast: ${toasts}, floating: ${floatingDice})`);
      } else {
        // Take full page screenshot to find dice result anywhere on page
        await page.screenshot({ path: `${SS_DIR}/p2-ability-roll-fullpage.png`, fullPage: true });
        log(`Ability Check Roll (${label.toUpperCase()})`, 'PARTIAL', `Button clicked, no visible toast/dice panel found in viewport. Check p2-ability-roll-${label}.png for result.`);
      }
      break;
    }
  }

  if (!abilityButtonFound) {
    // Try a broader selector
    const allButtons = await page.locator('button').all();
    const buttonTexts = await Promise.all(allButtons.map(b => b.textContent().catch(() => '')));
    const abilityBtns = buttonTexts.filter(t => abilityScoreLabels.includes(t?.trim().toLowerCase()));
    log('Ability Score Buttons', 'BROKEN', `No ability score buttons found. All button texts: ${buttonTexts.slice(0, 20).map(t => `"${t?.trim()}"`).join(', ')}`);
    await ss(page, 'p2-no-ability-buttons');
  }

  // ── TEST: TABS ───────────────────────────────────────────────────────────────
  console.log('\n=== Tab Navigation Test ===');

  // Tabs use role="tab" — inspect what's actually there
  const allTabs = await page.locator('[role="tab"]').all();
  const tabTexts = await Promise.all(allTabs.map(t => t.textContent().catch(() => '')));
  console.log(`  Found ${allTabs.length} tabs: ${tabTexts.map(t => `"${t?.trim()}"`).join(', ')}`);
  log('Tab Count', allTabs.length > 0 ? 'WORKS' : 'MISSING', `${allTabs.length} tabs found: ${tabTexts.map(t => t?.trim()).join(', ')}`);

  // Click each tab and screenshot
  for (let i = 0; i < allTabs.length; i++) {
    const tabText = tabTexts[i]?.trim() || `tab-${i}`;
    await allTabs[i].click();
    await page.waitForTimeout(600);
    const errorShown = await page.locator('text=Something went wrong, text=Failed to load').count();
    await ss(page, `p2-tab-${tabText.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);

    if (errorShown > 0) {
      log(`Tab: ${tabText}`, 'BROKEN', 'Error boundary triggered after switching to this tab');
    } else {
      log(`Tab: ${tabText}`, 'WORKS', `Tab "${tabText}" loads without errors`);
    }
  }

  // ── TEST: DICE ROLLER PERSISTENCE ───────────────────────────────────────────
  console.log('\n=== Dice Roller UI ===');
  // Navigate back to overview
  const overviewTab = page.locator('[role="tab"]').first();
  await overviewTab.click();
  await page.waitForTimeout(300);

  // Look for any persistent dice roller (useDiceRoller hook)
  const diceRollerEl = await page.locator('[class*="dice"], [data-testid="dice"]').count();
  const diceHistoryEl = await page.locator('text=rolled, text=Roll').count();
  await ss(page, 'p2-dice-roller-search');
  await page.screenshot({ path: `${SS_DIR}/p2-dice-roller-fullpage.png`, fullPage: true });

  if (diceRollerEl > 0) {
    log('Dice Roller Component', 'WORKS', `Found ${diceRollerEl} dice-related elements`);
  } else {
    log('Dice Roller Component', 'PARTIAL', 'useDiceRoller hook exists but no persistent dice panel visible — results may disappear immediately');
  }

  // ── TEST: HP HEAL INTERACTION DETAIL ────────────────────────────────────────
  console.log('\n=== HP Heal Result Verification ===');
  // Scroll up 3 = should be visible immediately
  const hpEl2 = page.locator('[title="Scroll up/down to adjust HP"]').first();
  if (await hpEl2.count() > 0) {
    const before = await hpEl2.textContent();

    // Take 5 damage
    for (let i = 0; i < 5; i++) await hpEl2.dispatchEvent('wheel', { deltaY: 100 });
    await page.waitForTimeout(100);
    const afterDmg = await hpEl2.textContent();
    await ss(page, 'p2-hp-delta-visible');

    // Check delta indicator appears
    const deltaEl = page.locator('.text-red-400, .text-green-400').filter({ hasText: /[+-]\d+/ });
    const deltaCount = await deltaEl.count();
    log('HP Delta Indicator', deltaCount > 0 ? 'WORKS' : 'MISSING',
      `Delta indicator after damage: ${deltaCount > 0 ? 'visible' : 'not found'}. HP: ${before?.trim()} → ${afterDmg?.trim()}`);
  }

  // ── CONSOLE ERRORS SUMMARY ───────────────────────────────────────────────────
  if (consoleErrors.length > 0) {
    log('Console Errors (total)', 'BROKEN', `${consoleErrors.length} errors captured: ${consoleErrors.slice(0, 3).join(' || ')}`);
  } else {
    log('Console Errors', 'WORKS', 'No console errors captured during session');
  }

  await ss(page, 'p2-final');
  await browser.close();

  const reportPath = `${SS_DIR}/qa-results-p2.json`;
  await writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nResults: ${reportPath}`);
  console.log('\nAll results:');
  results.forEach(r => console.log(`  [${r.status}] ${r.step}: ${r.detail}`));
}

main().catch(console.error);
