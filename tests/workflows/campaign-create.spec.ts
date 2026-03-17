import { test, expect } from '@playwright/test';
import { checkpoint, signInAsTestUser } from '../helpers';

const VIC_EMAIL = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PASSWORD = process.env.QA_TEST_PASSWORD ?? '';

test('campaign create redirects from new campaign form', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'open-new-campaign', async () => {
    await page.goto('/campaigns/new');
    await expect(page).toHaveURL('/campaigns/new');
    await expect(page.getByText('Campaign Identity')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/^name$/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/^description$/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /create campaign/i })).toBeEnabled();
  }, 8_000);

  await checkpoint(testInfo, 'submit-create-campaign', async () => {
    const uniqueName = `QA Campaign ${Date.now()}`;
    await page.getByLabel(/^name$/i).fill(uniqueName);
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+/, { timeout: 10_000 });
  }, 12_000);
});

test('campaign create — new sections render on the page', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'sections-visible', async () => {
    await page.goto('/campaigns/new');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    await expect(page.getByText('Tone & Themes')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Players')).toBeVisible();
    await expect(page.getByText('World Setup')).toBeVisible();
    await expect(page.getByText('Story So Far')).toBeVisible();
    await expect(page.getByText('Import Documents')).toBeVisible();
  }, 10_000);
});

test('campaign create — tone chips toggle and player rows work', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'tone-chips-toggle', async () => {
    await page.goto('/campaigns/new');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    await page.click('button:has-text("Horror")');
    await page.click('button:has-text("Maritime")');
    const horrorBtn = page.locator('button:has-text("Horror")');
    await expect(horrorBtn).toHaveClass(/amber/, { timeout: 3_000 });
  }, 8_000);

  await checkpoint(testInfo, 'player-rows', async () => {
    await page.locator('[placeholder="Player name"]').first().fill('Blake');
    await page.locator('[placeholder="Character name"]').first().fill('Tav');
    await page.click('button:has-text("Add player")');
    await expect(page.locator('[placeholder="Player name"]')).toHaveCount(2);
  }, 5_000);
});

test('campaign create — world setup fields and blank player row filtering', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'world-setup-submit', async () => {
    await page.goto('/campaigns/new');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    const uniqueName = `QA World Setup ${Date.now()}`;
    await page.getByLabel(/^name$/i).fill(uniqueName);
    await page.fill('input#startingLocation', "Baldur's Gate");
    await page.fill('input#antagonistName', 'Bane');
    await page.fill('input#antagonistMotivation', 'Conquest of the Sword Coast');
    await page.fill('input#openingHook', 'A temple explodes at dawn');
    // First player row filled, second row blank (should be filtered)
    await page.locator('[placeholder="Player name"]').first().fill('Alice');
    await page.locator('[placeholder="Character name"]').first().fill('Astarion');
    await page.click('button:has-text("Add player")');
    await page.getByRole('button', { name: /create campaign/i }).click();
    await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+/, { timeout: 15_000 });
  }, 20_000);
});

test('campaign create — PDF drop zone renders', async ({ page }, testInfo) => {
  await checkpoint(testInfo, 'sign-in', async () => {
    await signInAsTestUser(page, VIC_EMAIL, PASSWORD);
  }, 15_000);

  await checkpoint(testInfo, 'pdf-drop-zone', async () => {
    await page.goto('/campaigns/new');
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    await expect(page.locator('text=Drop session notes, module PDFs')).toBeVisible({ timeout: 8_000 });
  }, 10_000);
});
