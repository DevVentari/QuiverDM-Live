import { test, expect } from '@playwright/test';

test.describe('Campaign Dashboard', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

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

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });
  });

  test('should load campaigns page without console errors', async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Filter out expected warnings (favicon, icons)
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    console.log('Console Errors:', realErrors);
    console.log('Console Warnings:', consoleWarnings);

    // Should have no real errors
    expect(realErrors).toHaveLength(0);

    // Take screenshot
    await page.screenshot({ path: 'test-results/campaigns-page.png', fullPage: true });
  });

  test('should display campaign dashboard with test data', async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Should see Campaign Dashboard heading
    await expect(page.locator('text=Campaign Dashboard')).toBeVisible();

    // Should see campaign selector
    const campaignSelector = page.locator('button[role="combobox"]');
    await expect(campaignSelector).toBeVisible();

    // Should see a campaign name displayed (in heading)
    const campaignNameVisible = await page.getByRole('heading', { name: 'Curse of Strahd' }).isVisible() ||
                                  await page.getByRole('heading', { name: 'Dragon Heist' }).isVisible();
    expect(campaignNameVisible).toBeTruthy();

    // Should see stats (use exact text with first() to avoid matching action cards)
    await expect(page.getByText('SESSIONS', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('NPCs', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('PLAYERS', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('HOMEBREW', { exact: true }).first()).toBeVisible();

    // Should see quick action cards (use getByRole to target card headings specifically)
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'NPCs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Homebrew' })).toBeVisible();

    // Filter out expected warnings
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should navigate to sessions page when clicking Sessions card', async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Wait for campaign to be selected
    await page.waitForTimeout(1000);

    // Click Sessions card
    const sessionsCard = page.locator('text=Sessions').nth(1).locator('..');
    await sessionsCard.click();

    // Should navigate to sessions page
    await expect(page).toHaveURL(/\/campaigns\/.*\/sessions/);

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });

  test('should switch between campaigns', async ({ page }) => {
    await page.goto('/campaigns');
    await page.waitForLoadState('networkidle');

    // Open campaign selector
    const campaignSelector = page.locator('button[role="combobox"]');
    await campaignSelector.click();

    // Wait for dropdown to appear
    await page.waitForTimeout(500);

    // Select "Dragon Heist" if it's not already selected
    const dragonHeistOption = page.locator('[role="option"]:has-text("Dragon Heist")');
    if (await dragonHeistOption.isVisible()) {
      await dragonHeistOption.click();

      // Wait for data to load
      await page.waitForTimeout(1000);

      // Should see Dragon Heist in selector
      await expect(campaignSelector).toContainText('Dragon Heist');
    }

    // Filter errors
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('icon-192') &&
        !err.includes('icon-512') &&
        !err.includes('apple-icon')
    );

    expect(realErrors).toHaveLength(0);
  });
});
