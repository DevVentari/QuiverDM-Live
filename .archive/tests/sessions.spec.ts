import { test, expect } from '@playwright/test';

test.describe('Sessions Management', () => {
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

  test('should load sessions page without console errors', async ({ page }) => {
    // Use the test campaign ID
    await page.goto('/campaigns/test-campaign-1/sessions');
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
    await page.screenshot({ path: 'test-results/sessions-page.png', fullPage: true });
  });

  test('should display sessions list with test data', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions');
    await page.waitForLoadState('networkidle');

    // Should see Sessions heading
    await expect(page.locator('h1:has-text("Sessions"), h2:has-text("Sessions")').first()).toBeVisible();

    // Should see Start New Session button
    await expect(page.locator('button:has-text("Start New Session"), button:has-text("Session In Progress")').first()).toBeVisible();

    // Should see session cards (use heading role to avoid active banner duplicate)
    await expect(page.locator('text=Arrival in Barovia')).toBeVisible();
    await expect(page.locator('text=Village of Barovia')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Castle Ravenloft' })).toBeVisible();

    // Should see session numbers
    await expect(page.locator('text=SESSION 1')).toBeVisible();
    await expect(page.locator('text=SESSION 2')).toBeVisible();
    await expect(page.locator('text=SESSION 3')).toBeVisible();

    // Should see status badges (use nth to handle multiple instances)
    await expect(page.locator('text=Completed').first()).toBeVisible();
    await expect(page.getByText('In Progress', { exact: true }).first()).toBeVisible();

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

  test('should show active session banner', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions');
    await page.waitForLoadState('networkidle');

    // Should see active session banner for session in progress
    await expect(page.locator('text=Active Session')).toBeVisible();
    await expect(page.locator('text=Castle Ravenloft').first()).toBeVisible();
    await expect(page.locator('button:has-text("Continue Session")')).toBeVisible();

    // Start New Session button should be disabled
    const startButton = page.locator('button:has-text("Session In Progress")');
    await expect(startButton).toBeDisabled();

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

  test('should display session details correctly', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions');
    await page.waitForLoadState('networkidle');

    // Check first session card
    const firstSession = page.locator('text=Arrival in Barovia').locator('..');

    // Should show quick notes
    await expect(firstSession.locator('text=The party entered through the mists')).toBeVisible();

    // Should show date
    await expect(firstSession.locator('[class*="lucide-calendar"]')).toBeVisible();

    // Should show Completed badge
    await expect(firstSession.locator('text=Completed')).toBeVisible();

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

  test('should handle campaign with no sessions', async ({ page }) => {
    // Use Dragon Heist campaign which has no sessions
    await page.goto('/campaigns/test-campaign-2/sessions');
    await page.waitForLoadState('networkidle');

    // Should see empty state
    await expect(page.locator('text=No Sessions Yet')).toBeVisible();
    await expect(page.locator('text=Start your first session')).toBeVisible();
    await expect(page.locator('button:has-text("Start First Session")')).toBeVisible();

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
