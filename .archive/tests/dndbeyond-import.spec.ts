import { test, expect } from '@playwright/test';

/**
 * End-to-End Test for D&D Beyond Character Import
 *
 * Tests the complete workflow of importing public D&D Beyond characters
 * using Crawl4AI integration with real character URLs.
 *
 * Test Characters:
 * - https://www.dndbeyond.com/characters/138913536
 * - https://www.dndbeyond.com/characters/47998691
 */

test.describe('D&D Beyond Character Import', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];
  let campaignId: string;

  test.beforeEach(async ({ page }) => {
    // Capture console errors and warnings
    consoleErrors = [];
    consoleWarnings = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    // Navigate to campaigns page
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Get the campaign ID from URL or selector
    await page.waitForTimeout(1000);
    const url = page.url();
    const match = url.match(/campaigns\/([a-zA-Z0-9-]+)/);
    if (match) {
      campaignId = match[1];
    }
  });

  test('should display Import from D&D Beyond button', async ({ page }) => {
    // Navigate to campaign overview
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Look for the import button
    const importButton = page.getByRole('button', { name: /Import from D&D Beyond/i });
    await expect(importButton).toBeVisible();

    await page.screenshot({
      path: 'test-results/dndbeyond-import-button.png',
      fullPage: true
    });
  });

  test('should open import dialog when clicking Import button', async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Click import button
    const importButton = page.getByRole('button', { name: /Import from D&D Beyond/i });
    await importButton.click();

    // Wait for dialog to open
    await page.waitForTimeout(500);

    // Check dialog title
    await expect(page.getByText('Import Character from D&D Beyond')).toBeVisible();

    // Check form fields are present
    await expect(page.getByPlaceholder('e.g., John Smith')).toBeVisible();
    await expect(page.getByPlaceholder(/https:\/\/www.dndbeyond.com\/characters\/.../)).toBeVisible();

    // Check import button is disabled when URL is empty
    const dialogImportButton = page.getByRole('button', { name: /^Import Character$/i }).last();
    await expect(dialogImportButton).toBeDisabled();

    await page.screenshot({
      path: 'test-results/dndbeyond-import-dialog.png',
      fullPage: true
    });
  });

  test('should validate URL format', async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Open dialog
    const importButton = page.getByRole('button', { name: /Import from D&D Beyond/i });
    await importButton.click();
    await page.waitForTimeout(500);

    // Try with invalid URL
    const urlInput = page.getByPlaceholder(/https:\/\/www.dndbeyond.com\/characters\/.../);
    await urlInput.fill('https://invalid-url.com');

    // Try to import
    const dialogImportButton = page.getByRole('button', { name: /^Import Character$/i }).last();
    await dialogImportButton.click();

    // Should show error
    await expect(page.getByText(/Invalid D&D Beyond/i)).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test-results/dndbeyond-import-invalid-url.png',
      fullPage: true
    });
  });

  test('should import character 138913536 successfully', async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Open import dialog
    const importButton = page.getByRole('button', { name: /Import from D&D Beyond/i });
    await importButton.click();
    await page.waitForTimeout(500);

    // Fill in character URL
    const urlInput = page.getByPlaceholder(/https:\/\/www.dndbeyond.com\/characters\/.../);
    await urlInput.fill('https://www.dndbeyond.com/characters/138913536');

    await page.screenshot({
      path: 'test-results/dndbeyond-import-filled-138913536.png',
      fullPage: true
    });

    // Click import
    const dialogImportButton = page.getByRole('button', { name: /^Import Character$/i }).last();
    await dialogImportButton.click();

    // Wait for import to complete (this may take a while due to Crawl4AI)
    // Look for success message
    await expect(page.getByText(/imported successfully|updated successfully/i)).toBeVisible({
      timeout: 60000 // 60 seconds for character scraping
    });

    await page.screenshot({
      path: 'test-results/dndbeyond-import-success-138913536.png',
      fullPage: true
    });

    // Dialog should close automatically
    await page.waitForTimeout(3000);

    // Navigate to Players section to verify import
    const playersCard = page.locator('text=Players').nth(1).locator('..');
    await playersCard.click();
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-results/dndbeyond-import-player-list-138913536.png',
      fullPage: true
    });

    // Should see the imported character in the list
    // (We'll look for any player card, exact name depends on character)
    const playerCards = page.locator('[data-testid="player-card"], .player-card, div:has(> div:has-text("Level"))');
    await expect(playerCards.first()).toBeVisible({ timeout: 5000 });
  });

  test('should import character 47998691 successfully', async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Open import dialog
    const importButton = page.getByRole('button', { name: /Import from D&D Beyond/i });
    await importButton.click();
    await page.waitForTimeout(500);

    // Fill in character URL
    const urlInput = page.getByPlaceholder(/https:\/\/www.dndbeyond.com\/characters\/.../);
    await urlInput.fill('https://www.dndbeyond.com/characters/47998691');

    await page.screenshot({
      path: 'test-results/dndbeyond-import-filled-47998691.png',
      fullPage: true
    });

    // Click import
    const dialogImportButton = page.getByRole('button', { name: /^Import Character$/i }).last();
    await dialogImportButton.click();

    // Wait for import to complete
    await expect(page.getByText(/imported successfully|updated successfully/i)).toBeVisible({
      timeout: 60000
    });

    await page.screenshot({
      path: 'test-results/dndbeyond-import-success-47998691.png',
      fullPage: true
    });

    // Dialog should close automatically
    await page.waitForTimeout(3000);

    // Navigate to Players section to verify import
    const playersCard = page.locator('text=Players').nth(1).locator('..');
    await playersCard.click();
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-results/dndbeyond-import-player-list-47998691.png',
      fullPage: true
    });

    // Should see the imported character in the list
    const playerCards = page.locator('[data-testid="player-card"], .player-card, div:has(> div:has-text("Level"))');
    await expect(playerCards.first()).toBeVisible({ timeout: 5000 });
  });

  test('should re-sync existing character (update)', async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // First import
    let importButton = page.getByRole('button', { name: /Import from D&D Beyond/i });
    await importButton.click();
    await page.waitForTimeout(500);

    let urlInput = page.getByPlaceholder(/https:\/\/www.dndbeyond.com\/characters\/.../);
    await urlInput.fill('https://www.dndbeyond.com/characters/138913536');

    let dialogImportButton = page.getByRole('button', { name: /^Import Character$/i }).last();
    await dialogImportButton.click();

    await expect(page.getByText(/imported successfully|updated successfully/i)).toBeVisible({
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    // Second import (should update)
    importButton = page.getByRole('button', { name: /Import from D&D Beyond/i });
    await importButton.click();
    await page.waitForTimeout(500);

    urlInput = page.getByPlaceholder(/https:\/\/www.dndbeyond.com\/characters\/.../);
    await urlInput.fill('https://www.dndbeyond.com/characters/138913536');

    await page.screenshot({
      path: 'test-results/dndbeyond-import-resync.png',
      fullPage: true
    });

    dialogImportButton = page.getByRole('button', { name: /^Import Character$/i }).last();
    await dialogImportButton.click();

    // Should show "updated successfully" for re-sync
    await expect(page.getByText(/updated successfully/i)).toBeVisible({
      timeout: 60000
    });

    await page.screenshot({
      path: 'test-results/dndbeyond-import-resync-success.png',
      fullPage: true
    });
  });

  test('should import both characters in sequence', async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    const characterUrls = [
      'https://www.dndbeyond.com/characters/138913536',
      'https://www.dndbeyond.com/characters/47998691'
    ];

    for (let i = 0; i < characterUrls.length; i++) {
      const url = characterUrls[i];
      const characterId = url.split('/').pop();

      console.log(`Importing character ${i + 1}/${characterUrls.length}: ${characterId}`);

      // Open import dialog
      const importButton = page.getByRole('button', { name: /Import from D&D Beyond/i });
      await importButton.click();
      await page.waitForTimeout(500);

      // Fill in character URL
      const urlInput = page.getByPlaceholder(/https:\/\/www.dndbeyond.com\/characters\/.../);
      await urlInput.fill(url);

      // Click import
      const dialogImportButton = page.getByRole('button', { name: /^Import Character$/i }).last();
      await dialogImportButton.click();

      // Wait for success
      await expect(page.getByText(/imported successfully|updated successfully/i)).toBeVisible({
        timeout: 60000
      });

      await page.screenshot({
        path: `test-results/dndbeyond-import-sequential-${characterId}.png`,
        fullPage: true
      });

      // Wait for dialog to close
      await page.waitForTimeout(3000);
    }

    // Navigate to Players section
    const playersCard = page.locator('text=Players').nth(1).locator('..');
    await playersCard.click();
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-results/dndbeyond-import-both-characters.png',
      fullPage: true
    });

    // Should see at least 2 player cards
    const playerCards = page.locator('[data-testid="player-card"], .player-card, div:has(> div:has-text("Level"))');
    const count = await playerCards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Filter out expected errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    console.log('Console Errors:', realErrors);
    expect(realErrors).toHaveLength(0);
  });

  test('should handle import with custom player name', async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Open import dialog
    const importButton = page.getByRole('button', { name: /Import from D&D Beyond/i });
    await importButton.click();
    await page.waitForTimeout(500);

    // Fill in player name
    const playerNameInput = page.getByPlaceholder('e.g., John Smith');
    await playerNameInput.fill('Custom Player Name');

    // Fill in character URL
    const urlInput = page.getByPlaceholder(/https:\/\/www.dndbeyond.com\/characters\/.../);
    await urlInput.fill('https://www.dndbeyond.com/characters/138913536');

    await page.screenshot({
      path: 'test-results/dndbeyond-import-custom-name.png',
      fullPage: true
    });

    // Click import
    const dialogImportButton = page.getByRole('button', { name: /^Import Character$/i }).last();
    await dialogImportButton.click();

    // Wait for success
    await expect(page.getByText(/imported successfully|updated successfully/i)).toBeVisible({
      timeout: 60000
    });
  });

  test.afterEach(async ({ page }) => {
    // Filter out expected errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon') &&
        !err.includes('manifest.json')
    );

    if (realErrors.length > 0) {
      console.log('Console Errors:', realErrors);
      console.log('Console Warnings:', consoleWarnings);
    }
  });
});
