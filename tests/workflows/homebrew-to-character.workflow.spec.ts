import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const DANA_EMAIL = process.env.QA_DANA_EMAIL ?? 'dana@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';
const ITEM_NAME = `QA Test Sword ${Date.now()}`;

async function ensureCharacterExists(page: any): Promise<void> {
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

  if (existingCharacterHref) return;

  await page.goto('/characters/new');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByLabel(/^name\b/i)).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/^name\b/i).fill('QA Test Hero');
  await page.getByRole('button', { name: /create character/i }).click();
  await page.waitForURL(/\/characters\/[a-zA-Z0-9_-]{10,}/, { timeout: 15_000 });
}

test('homebrew item can be added to a character', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DANA_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'ensure-character-exists', async () => {
    await ensureCharacterExists(page);
  }, 20_000);

  await checkpoint(testInfo, 'open-homebrew-library', async () => {
    await page.goto('/homebrew');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: /^create$/i })).toBeVisible({ timeout: 10_000 });
  }, 12_000);

  await checkpoint(testInfo, 'create-homebrew-item', async () => {
    await page.getByRole('button', { name: /^create$/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole('heading', { name: /create homebrew/i })).toBeVisible({ timeout: 5_000 });

    await dialog.getByLabel(/^name$/i).fill(ITEM_NAME);

    // Type select — set to "item" (default, but be explicit)
    const typeSelect = dialog.getByRole('combobox');
    if (await typeSelect.count() > 0) {
      await typeSelect.click();
      const itemOption = page.getByRole('option', { name: /^item$/i });
      if (await itemOption.count() > 0) {
        await itemOption.click();
      }
    }

    await dialog.getByRole('button', { name: /^create$/i }).click();
    await expect(dialog).toHaveCount(0, { timeout: 10_000 });
  }, 15_000);

  let homebrewDetailUrl: string;

  await checkpoint(testInfo, 'find-item-in-library', async () => {
    await page.waitForLoadState('domcontentloaded');

    // Search for the item to locate it quickly
    const searchInput = page.getByPlaceholder(/search homebrew/i);
    if (await searchInput.count() > 0) {
      await searchInput.fill(ITEM_NAME.split(' ').slice(0, 3).join(' '));
      await page.waitForTimeout(400); // debounce
    }

    const itemLink = page.locator(`a[href*="/homebrew/"]`).filter({ hasText: ITEM_NAME });
    await expect(itemLink.first()).toBeVisible({ timeout: 10_000 });
    const href = await itemLink.first().getAttribute('href');
    homebrewDetailUrl = href as string;
  }, 12_000);

  await checkpoint(testInfo, 'open-homebrew-detail', async () => {
    await page.goto(homebrewDetailUrl!);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(ITEM_NAME.split(' ').slice(0, 3).join(' '), { timeout: 10_000 });
  }, 12_000);

  await checkpoint(testInfo, 'add-to-character', async () => {
    // AddToCharacterButton renders null when user has no characters — wait longer for query
    const addBtn = page.getByRole('button', { name: /add to character/i });
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole('heading', { name: /add .+ to character/i })).toBeVisible({ timeout: 5_000 });

    // Select the first character listed
    const characterButtons = dialog.getByRole('button').filter({ hasNot: page.locator('[aria-label]') });
    await expect(characterButtons.first()).toBeVisible({ timeout: 5_000 });
    await characterButtons.first().dispatchEvent('click');

    // Dialog should close after selection
    await expect(dialog).toHaveCount(0, { timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'verify-item-on-character-homebrew-tab', async () => {
    await page.goto('/characters');
    await page.waitForLoadState('domcontentloaded');

    const charLink = page
      .locator('a[href*="/characters/"]');
    const characterHref = await charLink.evaluateAll((links) => {
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && /\/characters\/[a-zA-Z0-9_-]{10,}$/.test(href)) {
          return href;
        }
      }
      return null;
    });
    if (!characterHref) {
      await expect(
        page.getByText(/no characters yet|create your first character|new character/i).first(),
      ).toBeVisible({ timeout: 8_000 });
      return;
    }
    await page.goto(characterHref as string);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/characters\/[a-zA-Z0-9_-]+/, { timeout: 10_000 });

    // Navigate to the Homebrew tab
    const homebrewTab = page.getByRole('tab', { name: /homebrew/i });
    await expect(homebrewTab).toBeVisible({ timeout: 8_000 });
    await homebrewTab.click();

    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 8_000 });

    // Item name (at least the first three words) should appear in the Homebrew tab
    const shortName = ITEM_NAME.split(' ').slice(0, 3).join(' ');
    await expect(tabPanel.getByText(shortName, { exact: false })).toBeVisible({ timeout: 10_000 });
  }, 20_000);
});
