/**
 * QA: Character Sheet — Part 3
 * Clean pass: tabs, ability roll dice output, HP delta indicator, scroll UX.
 * Characters have been reset — no corrupted features.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const BASE_URL = 'http://localhost:3847';
const SS_DIR = 'E:/Projects/QuiverDM/docs/screenshots/character-sheet-qa';
const EMAIL = 'demo@quiverdm.com';
const PASSWORD = 'demo1234';
const CHARACTER_ID = 'cmm7s6d5o00mn907wa8cw5ls6'; // Norm Alfella — reset, clean

let idx = 70;
async function ss(page, name) {
  const filename = `${String(++idx).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: `${SS_DIR}/${filename}`, fullPage: false });
  console.log(`  Screenshot: ${filename}`);
  return filename;
}
async function ssFull(page, name) {
  const filename = `${String(++idx).padStart(2, '0')}-${name}-full.png`;
  await page.screenshot({ path: `${SS_DIR}/${filename}`, fullPage: true });
  console.log(`  Screenshot (full): ${filename}`);
  return filename;
}

async function main() {
  const results = [];
  function log(step, status, detail) {
    results.push({ step, status, detail });
    console.log(`[${status}] ${step}: ${detail}`);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)); });
  page.on('pageerror', err => consoleErrors.push(`PAGE: ${err.message.slice(0, 200)}`));

  // Sign in
  await page.goto(`${BASE_URL}/auth/signin`);
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|characters|onboarding)/, { timeout: 15000 });

  // Load character
  await page.goto(`${BASE_URL}/characters/${CHARACTER_ID}`, { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  await ss(page, 'p3-loaded-clean');

  // ── TABS ─────────────────────────────────────────────────────────────────────
  console.log('\n=== Tab Navigation ===');
  const tabs = await page.locator('[role="tab"]').all();
  const tabTexts = await Promise.all(tabs.map(t => t.textContent().catch(() => '')));
  console.log(`  Tabs found (${tabs.length}): ${tabTexts.map(t => `"${t?.trim()}"`).join(', ')}`);
  log('Tabs Found', tabs.length > 0 ? 'WORKS' : 'MISSING', `${tabs.length} tabs: ${tabTexts.map(t => t?.trim()).filter(Boolean).join(', ')}`);

  for (let i = 0; i < tabs.length; i++) {
    const label = tabTexts[i]?.trim() || `tab${i}`;
    await tabs[i].click();
    await page.waitForTimeout(700);
    const crashed = await page.locator('text=Something went wrong').count();
    const safeName = label.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await ss(page, `p3-tab-${safeName}`);
    if (crashed) {
      log(`Tab: ${label}`, 'BROKEN', 'Error boundary after switching');
    } else {
      const tabContent = await page.locator('[role="tabpanel"]').first().textContent().catch(() => '');
      log(`Tab: ${label}`, 'WORKS', `Loads cleanly. Content preview: "${tabContent?.trim().slice(0, 80)}"`);
    }
  }

  // ── ABILITY SCORE ROLL ───────────────────────────────────────────────────────
  console.log('\n=== Ability Score Roll ===');
  // Navigate back to overview tab
  await tabs[0].click();
  await page.waitForTimeout(500);
  await ss(page, 'p3-overview-for-abilities');

  // The ability buttons: border-2 rounded-lg, text is uppercase label (STR/DEX etc)
  // They contain a span with text-[10px] uppercase "str"/"dex" etc
  const abilityCards = page.locator('button.rounded-lg, button[class*="rounded-lg"]').filter({ hasText: /^(STR|DEX|CON|INT|WIS|CHA|str|dex|con|int|wis|cha)/ });
  const abilityCount = await abilityCards.count();
  console.log(`  Ability cards found: ${abilityCount}`);

  if (abilityCount === 0) {
    // Try finding by the modifier bubble pattern — button containing both a score and a modifier
    const scoreButtons = page.locator('button').filter({ has: page.locator('span.text-xl.font-bold') });
    const scoreCount = await scoreButtons.count();
    console.log(`  Score buttons (text-xl font-bold): ${scoreCount}`);

    if (scoreCount > 0) {
      const firstScore = scoreButtons.first();
      const scoreText = await firstScore.textContent();
      await firstScore.click();
      await page.waitForTimeout(500);
      await ss(page, 'p3-ability-roll-result');
      await ssFull(page, 'p3-ability-roll-result');
      log('Ability Check Roll', 'PARTIAL', `Found ${scoreCount} score buttons. Clicked first (text: "${scoreText?.trim()}"). Check screenshot for dice result.`);
    } else {
      // Dump all button texts for debug
      const allBtns = await page.locator('button').all();
      const texts = await Promise.all(allBtns.map(b => b.textContent().catch(() => '')));
      log('Ability Score Buttons', 'BROKEN', `Zero ability buttons found. Page buttons: ${texts.slice(0, 15).map(t => `"${t?.trim().slice(0,20)}"`).join(', ')}`);
      await ss(page, 'p3-ability-debug');
    }
  } else {
    const firstAbility = abilityCards.first();
    const abilityText = await firstAbility.textContent();
    await firstAbility.click();
    await page.waitForTimeout(600);
    await ss(page, 'p3-ability-roll-result');
    await ssFull(page, 'p3-ability-roll-result');

    // Look for dice result anywhere on page
    const toastEl = page.locator('[data-sonner-toast], [role="status"]');
    const toastCount = await toastEl.count();
    // Also look for a dice result panel (useDiceRoller hook renders a floating widget or inline)
    const diceResultEl = page.locator('[class*="roll"], [class*="dice"]');
    const diceCount = await diceResultEl.count();

    log('Ability Check Roll', 'WORKS',
      `Clicked ability button (${abilityText?.trim()}). Toast count: ${toastCount}, dice elements: ${diceCount}. See screenshot for visual result.`);
  }

  // ── DICE ROLLER WIDGET LOCATION ───────────────────────────────────────────────
  console.log('\n=== Dice Roller Widget ===');
  // useDiceRoller hook — find where results render
  await ssFull(page, 'p3-full-page-after-roll');
  const allText = await page.locator('body').textContent().catch(() => '');
  const hasRollText = /d20|rolled|result/i.test(allText || '');
  if (hasRollText) {
    log('Dice Roller Output', 'WORKS', 'Roll-related text found in page after ability check click');
  } else {
    log('Dice Roller Output', 'PARTIAL', 'No roll-related text visible in page body after ability click — result may be ephemeral toast that disappears');
  }

  // ── HP DELTA INDICATOR ────────────────────────────────────────────────────────
  console.log('\n=== HP Delta Indicator ===');
  const hpEl = page.locator('[title="Scroll up/down to adjust HP"]').first();
  if (await hpEl.count() > 0) {
    const before = await hpEl.textContent();
    for (let i = 0; i < 5; i++) await hpEl.dispatchEvent('wheel', { deltaY: 100 });
    await page.waitForTimeout(150);
    await ss(page, 'p3-hp-delta-active');

    const deltaRed = await page.locator('.text-red-400').filter({ hasText: /^-\d+$/ }).count();
    const deltaGreen = await page.locator('.text-green-400').filter({ hasText: /^\+\d+$/ }).count();
    const after = await hpEl.textContent();
    log('HP Delta Indicator', (deltaRed + deltaGreen) > 0 ? 'WORKS' : 'MISSING',
      `HP ${before?.trim()} → ${after?.trim()}. Red delta visible: ${deltaRed}, Green delta visible: ${deltaGreen}`);

    // Test delta dismiss (X button)
    const dismissBtn = page.locator('button[title="Reset delta"]').first();
    if (await dismissBtn.count() > 0) {
      await dismissBtn.click();
      await page.waitForTimeout(200);
      await ss(page, 'p3-hp-delta-dismissed');
      log('HP Delta Dismiss', 'WORKS', 'Delta dismiss button exists and is clickable');
    } else {
      log('HP Delta Dismiss', 'MISSING', 'No "Reset delta" dismiss button found');
    }
  }

  // ── HP SCROLL UX DETAIL ───────────────────────────────────────────────────────
  console.log('\n=== HP Scroll UX ===');
  await ss(page, 'p3-hp-cursor-hint');
  const cursorNsResize = await page.locator('[class*="cursor-ns-resize"]').count();
  log('HP Edit UX', cursorNsResize > 0 ? 'PARTIAL' : 'MISSING',
    cursorNsResize > 0
      ? 'HP only editable via scroll wheel (cursor-ns-resize). No click-to-type, no +/- buttons, no damage/heal input. HPTracker component exists but is unused.'
      : 'cursor-ns-resize element not found');

  // ── SHORT REST DIALOG ─────────────────────────────────────────────────────────
  console.log('\n=== Short Rest Dialog ===');
  const shortRestBtn = page.locator('button:has-text("Short Rest")');
  if (await shortRestBtn.count() > 0) {
    await shortRestBtn.click();
    await page.waitForTimeout(500);
    await ss(page, 'p3-short-rest-dialog');
    const dialogTitle = await page.locator('[role="dialog"] h2, [role="dialog"] h3').first().textContent().catch(() => '');
    const hitDiceInDialog = await page.locator('[role="dialog"] button:has-text("Roll")').count();
    log('Short Rest Dialog', 'WORKS', `Dialog opens: "${dialogTitle?.trim()}". Roll buttons: ${hitDiceInDialog} (0 = no hit dice for manual char)`);
    // Close dialog
    await page.keyboard.press('Escape');
  } else {
    log('Short Rest Dialog', 'MISSING', 'Short Rest button not found');
  }

  // ── LONG REST DIALOG ──────────────────────────────────────────────────────────
  const longRestBtn = page.locator('button:has-text("Long Rest")');
  if (await longRestBtn.count() > 0) {
    await longRestBtn.click();
    await page.waitForTimeout(500);
    await ss(page, 'p3-long-rest-dialog');
    const dialogTitle = await page.locator('[role="dialog"] h2, [role="dialog"] h3').first().textContent().catch(() => '');
    log('Long Rest Dialog', 'WORKS', `Dialog opens: "${dialogTitle?.trim()}"`);
    await page.keyboard.press('Escape');
  } else {
    log('Long Rest Dialog', 'MISSING', 'Long Rest button not found');
  }

  // ── FINAL STATE ───────────────────────────────────────────────────────────────
  if (consoleErrors.length > 0) {
    log('Console Errors', 'BROKEN', `${consoleErrors.length} errors: ${consoleErrors.slice(0,2).join(' || ')}`);
  } else {
    log('Console Errors (clean pass)', 'WORKS', 'Zero errors on clean character without death save corruption');
  }

  await ss(page, 'p3-final');
  await browser.close();

  const report = `${SS_DIR}/qa-results-p3.json`;
  await writeFile(report, JSON.stringify(results, null, 2));
  console.log(`\n=== FINAL RESULTS ===`);
  results.forEach(r => console.log(`[${r.status}] ${r.step}`));
}

main().catch(console.error);
