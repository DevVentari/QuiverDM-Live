import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const DANA_EMAIL = process.env.QA_DANA_EMAIL ?? 'dana@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

const ITEM_NAME = `QA Power Item ${Date.now()}`;

async function ensureCampaignExists(page: any): Promise<void> {
  await page.goto('/campaigns');
  await page.waitForLoadState('domcontentloaded');

  const noCampaigns = page.getByText(/no campaigns yet/i);
  if (await noCampaigns.count() > 0) {
    await page.goto('/campaigns/new');
    await page.waitForLoadState('domcontentloaded');
    const nameInput = page.getByLabel(/^name$/i);
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill('Dana QA Campaign');
    await page.getByRole('button', { name: /create/i }).click();
    await page.waitForURL(/\/campaigns\/[a-zA-Z0-9_-]+(?!\/new)/, { timeout: 20_000 });
  }
}

async function ensureCharacterExists(page: any): Promise<string> {
  await page.goto('/characters');
  await page.waitForLoadState('domcontentloaded');

  const charLink = page
    .locator('a[href*="/characters/"]')
    .filter({ hasNot: page.locator('[href="/characters/new"]') })
    .first();

  if (await charLink.count() > 0) {
    const href = await charLink.getAttribute('href');
    return href as string;
  }

  await page.goto('/characters/new');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByLabel(/^name$/i)).toBeVisible({ timeout: 10_000 });
  await page.getByLabel(/^name$/i).fill('Dana QA Hero');
  await page.getByRole('button', { name: /create character/i }).click();
  await page.waitForURL(/\/characters\/[a-zA-Z0-9_-]+(?!\/new)/, { timeout: 15_000 });
  const url = page.url();
  const match = url.match(/(\/characters\/[^/?]+)/);
  return match ? match[1] : '/characters';
}

test('power-dm happy path: homebrew creation, PDF upload UI, character sheet tabs', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DANA_EMAIL, PASSWORD);
  }, 12_000);

  await checkpoint(testInfo, 'ensure-campaign', async () => {
    await ensureCampaignExists(page);
  }, 20_000);

  await checkpoint(testInfo, 'create-homebrew', async () => {
    await page.goto('/homebrew');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: /^create$/i })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /^create$/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await dialog.getByLabel(/^name$/i).fill(ITEM_NAME);

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

    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.getByPlaceholder(/search homebrew/i);
    if (await searchInput.count() > 0) {
      await searchInput.fill(ITEM_NAME.split(' ').slice(0, 3).join(' '));
      await page.waitForTimeout(400);
    }

    const itemLink = page.locator('a[href*="/homebrew/"]').filter({ hasText: ITEM_NAME.split(' ')[2] });
    await expect(itemLink.first()).toBeVisible({ timeout: 10_000 });
  }, 15_000);

  await checkpoint(testInfo, 'pdf-upload-ui', async () => {
    await page.goto('/homebrew/pdfs');
    await page.waitForLoadState('domcontentloaded');

    const uploadBtn = page.getByRole('button', { name: /upload pdf/i });
    await expect(uploadBtn).toBeVisible({ timeout: 10_000 });
    await expect(uploadBtn).toBeEnabled();

    await expect(page.getByText(/pdf only|50 mb/i).first()).toBeVisible({ timeout: 8_000 });

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1, { timeout: 5_000 });
    const acceptAttr = await fileInput.getAttribute('accept');
    expect(acceptAttr).toMatch(/pdf/i);
  }, 10_000);

  await checkpoint(testInfo, 'character-sheet-tabs', async () => {
    const characterHref = await ensureCharacterExists(page);

    await page.goto(characterHref);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/characters\/[a-zA-Z0-9_-]+/, { timeout: 10_000 });

    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible({ timeout: 10_000 });

    const expectedTabs = [/^overview$/i, /^spells$/i, /^inventory$/i, /^homebrew$/i, /^features$/i, /^skills$/i, /^background$/i];
    for (const label of expectedTabs) {
      await expect(tabList.getByRole('tab', { name: label })).toBeVisible({ timeout: 5_000 });
    }

    await tabList.getByRole('tab', { name: /^homebrew$/i }).click();
    const tabPanel = page.getByRole('tabpanel');
    await expect(tabPanel).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/homebrew items|homebrew spells|homebrew feats|active effects/i).first()).toBeVisible({ timeout: 8_000 });

    const acText = page.getByText(/\bAC\b/i).first();
    await expect(acText).toBeVisible({ timeout: 8_000 });
    const acContainer = acText.locator('..');
    const containerText = await acContainer.textContent();
    expect(containerText).toMatch(/\d/);
    expect(containerText).not.toMatch(/nan/i);
  }, 20_000);

  await checkpoint(testInfo, 'settings-meters', async () => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /usage/i }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/something went wrong|500|internal server error/i)).toHaveCount(0);
  }, 10_000);
});

test('power-dm failure path: oversized or invalid file upload shows error not crash', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, DANA_EMAIL, PASSWORD);
  }, 12_000);

  await checkpoint(testInfo, 'open-pdf-page', async () => {
    await page.goto('/homebrew/pdfs');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: /upload pdf/i })).toBeVisible({ timeout: 10_000 });
  }, 10_000);

  await checkpoint(testInfo, 'invalid-file-upload', async () => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a pdf'),
    });

    const uploadBtn = page.getByRole('button', { name: /upload pdf/i });
    if (await uploadBtn.isEnabled()) {
      await uploadBtn.click();
    }

    await expect(
      page.getByText(/pdf only|invalid file|not supported|please upload a pdf|invalid file type/i).first()
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/something went wrong|500|internal server error/i)).toHaveCount(0);

    await expect(page).toHaveURL(/\/homebrew\/pdfs/, { timeout: 3_000 });
  }, 15_000);
});
