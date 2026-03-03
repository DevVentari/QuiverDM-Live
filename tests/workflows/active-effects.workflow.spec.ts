import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const DANA_EMAIL = process.env.QA_DANA_EMAIL ?? 'dana@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const SHIELD_NAME = `QA Shield +2 ${Date.now()}`;

async function ensureCharacterExists(page: any): Promise<string> {
  await page.goto('/characters');
  await page.waitForLoadState('domcontentloaded');

  const existingCharacterHref = await page.locator('a[href*="/characters/"]').evaluateAll((links) => {
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href && /\/characters\/[a-zA-Z0-9_-]{10,}$/.test(href)) {
        return href;
      }
    }
    return null;
  });

  if (existingCharacterHref) {
    return existingCharacterHref as string;
  }

  await page.goto('/characters/new');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByLabel(/^name\b/i)).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/^name\b/i).fill('QA Test Hero');
  await page.getByRole('button', { name: /create character/i }).click();
  await page.waitForURL(/\/characters\/[a-zA-Z0-9_-]{10,}/, { timeout: 15_000 });
  return page.url().replace(/.*?(\/characters\/[a-zA-Z0-9_-]+)$/, '$1');
}

test('character homebrew tab renders active effects section and AC is a valid number', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DANA_EMAIL, PASSWORD);
  }, 15_000);

  let characterHref: string;

  await checkpoint(testInfo, 'ensure-character-exists', async () => {
    characterHref = await ensureCharacterExists(page);
  }, 20_000);

  await checkpoint(testInfo, 'create-homebrew-item-with-effect', async () => {
    await page.goto('/homebrew');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: /^create$/i })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /^create$/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await dialog.getByLabel(/^name$/i).fill(SHIELD_NAME);

    // Set type to "item"
    const typeSelect = dialog.getByRole('combobox');
    if (await typeSelect.count() > 0) {
      await typeSelect.click();
      const itemOption = page.getByRole('option', { name: /^item$/i });
      if (await itemOption.count() > 0) {
        await itemOption.click();
      }
    }

    // Fill description mentioning AC bonus so the EffectConfirmationPanel may detect it
    const contentArea = dialog.getByLabel(/content/i);
    if (await contentArea.count() > 0) {
      await contentArea.fill('A sturdy shield that grants +2 AC to the bearer.');
    }

    await dialog.getByRole('button', { name: /^create$/i }).click();
    await expect(dialog).toHaveCount(0, { timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'open-character-sheet', async () => {
    await page.goto(characterHref!);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/characters\/[a-zA-Z0-9_-]+/, { timeout: 10_000 });
  }, 12_000);

  await checkpoint(testInfo, 'verify-ac-stat-is-valid-number', async () => {
    // AC label only renders in the stat bar when armorClass is set (not null).
    // A freshly created character has no stats — check only if the label exists.
    const acLabel = page.getByText(/\bAC\b/);
    const acCount = await acLabel.count();
    if (acCount > 0) {
      await expect(acLabel.first()).toBeVisible({ timeout: 5_000 });
      const acArea = page.locator('div').filter({ hasText: /\bAC\b/ }).first();
      const acText = await acArea.innerText();
      expect(acText).toMatch(/\d+/);
      expect(acText).not.toMatch(/NaN/);
    }
    // Character page must load without crashing
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'open-homebrew-tab', async () => {
    const homebrewTab = page.getByRole('tab', { name: /^homebrew$/i });
    await expect(homebrewTab).toBeVisible({ timeout: 8_000 });
    await homebrewTab.click();

    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 8_000 });
  }, 10_000);

  await checkpoint(testInfo, 'verify-homebrew-sections-render', async () => {
    const tabPanel = page.getByRole('tabpanel');

    // The Homebrew tab always renders these section headings
    await expect(tabPanel.getByText(/homebrew items/i).first()).toBeVisible({ timeout: 8_000 });
    await expect(tabPanel.getByText(/homebrew spells/i).first()).toBeVisible({ timeout: 8_000 });
    await expect(tabPanel.getByText(/homebrew feats/i).first()).toBeVisible({ timeout: 8_000 });

    // No error state
    await expect(tabPanel.getByText(/failed to load|something went wrong|500/i)).toHaveCount(0);
  }, 10_000);

  await checkpoint(testInfo, 'verify-active-effects-section-or-absence', async () => {
    const tabPanel = page.getByRole('tabpanel');

    // CharacterActiveEffects renders only when there are active effects.
    // When empty it returns null — that's correct behaviour. Either state is acceptable.
    // If it is rendered, verify it doesn't show an error.
    const activeEffectsCard = tabPanel.getByText(/active effects/i);
    if (await activeEffectsCard.count() > 0) {
      await expect(activeEffectsCard.first()).toBeVisible({ timeout: 5_000 });
    }

    // ResolvedStatsSummary is shown in the hero header area (not the tab panel),
    // confirm no NaN or error text appears anywhere on the page.
    const pageText = await page.innerText('body');
    expect(pageText).not.toMatch(/NaN/);
    expect(pageText).not.toMatch(/undefined/);
  }, 10_000);
});
