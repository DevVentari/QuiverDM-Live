import { test, expect } from '@playwright/test';

test.describe('Session Detail Page', () => {
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

  test('should load session detail page without console errors', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions/test-session-1');
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

    expect(realErrors).toHaveLength(0);

    // Take screenshot
    await page.screenshot({ path: 'test-results/session-detail.png', fullPage: true });
  });

  test('should display session metadata correctly', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions/test-session-1');
    await page.waitForLoadState('networkidle');

    // Should see session number
    await expect(page.getByText('SESSION 1', { exact: true })).toBeVisible();

    // Should see session title
    await expect(page.getByRole('heading', { name: 'Arrival in Barovia' })).toBeVisible();

    // Should see status badge
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();

    // Should see date
    await expect(page.locator('[class*="lucide-calendar"]')).toBeVisible();

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

  test('should display back button and navigate to sessions list', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions/test-session-1');
    await page.waitForLoadState('networkidle');

    // Should see back button
    const backButton = page.locator('button').filter({ has: page.locator('[class*="lucide-arrow-left"]') });
    await expect(backButton).toBeVisible();

    // Click back button
    await backButton.click();
    await page.waitForLoadState('networkidle');

    // Should navigate to sessions list
    await expect(page).toHaveURL('/campaigns/test-campaign-1/sessions');

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

  test('should display quick notes section', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions/test-session-1');
    await page.waitForLoadState('networkidle');

    // Should see Quick Notes heading
    await expect(page.getByRole('heading', { name: 'Quick Notes' })).toBeVisible();

    // Should see quick notes textarea
    const quickNotesTextarea = page.getByPlaceholder(/What's happening in the session/);
    await expect(quickNotesTextarea).toBeVisible();

    // Should show existing notes from test data
    await expect(quickNotesTextarea).toContainText('The party entered through the mists');

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

  test('should display session recap section', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions/test-session-1');
    await page.waitForLoadState('networkidle');

    // Should see Session Recap heading
    await expect(page.getByRole('heading', { name: 'Session Recap' })).toBeVisible();

    // Should see recap textarea
    const recapTextarea = page.getByPlaceholder(/Write a detailed recap/);
    await expect(recapTextarea).toBeVisible();

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

  test('should display recordings section', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions/test-session-1');
    await page.waitForLoadState('networkidle');

    // Should see Recordings heading
    await expect(page.getByRole('heading', { name: 'Recordings' })).toBeVisible();

    // Should see recordings icon
    await expect(page.locator('[class*="lucide-file-audio"]').first()).toBeVisible();

    // Should see count badge
    await expect(page.getByText('Recordings').locator('..').getByText('0')).toBeVisible();

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

  test('should display transcripts section', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions/test-session-1');
    await page.waitForLoadState('networkidle');

    // Should see Transcripts heading
    await expect(page.getByRole('heading', { name: 'Transcripts' })).toBeVisible();

    // Should see transcripts icon
    await expect(page.locator('[class*="lucide-file-text"]').first()).toBeVisible();

    // Should see count badge
    await expect(page.getByText('Transcripts').locator('..').getByText('0')).toBeVisible();

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

  test('should display empty state for recordings', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions/test-session-1');
    await page.waitForLoadState('networkidle');

    // Should see empty state message
    await expect(page.getByText('No recordings yet')).toBeVisible();
    await expect(page.getByText('Upload audio or video files')).toBeVisible();

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

  test('should display empty state for transcripts', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions/test-session-1');
    await page.waitForLoadState('networkidle');

    // Should see empty state message
    await expect(page.getByText('No transcripts yet')).toBeVisible();
    await expect(page.getByText('Transcripts will appear here')).toBeVisible();

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

  test('should allow editing and status changes for completed sessions', async ({ page }) => {
    await page.goto('/campaigns/test-campaign-1/sessions/test-session-1');
    await page.waitForLoadState('networkidle');

    // Quick notes should be editable even for completed sessions
    const quickNotesTextarea = page.getByPlaceholder(/What's happening in the session/);
    await expect(quickNotesTextarea).not.toBeDisabled();

    // Recap should be editable even for completed sessions
    const recapTextarea = page.getByPlaceholder(/Write a detailed recap/);
    await expect(recapTextarea).not.toBeDisabled();

    // Should see status controls with Completed button highlighted
    await expect(page.getByText('Session Status')).toBeVisible();
    const completedButton = page.getByRole('button', { name: /Completed/ });
    await expect(completedButton).toBeVisible();

    // Should be able to change status from completed to in_progress
    const inProgressButton = page.getByRole('button', { name: /In Progress/ });
    await expect(inProgressButton).toBeVisible();
    await expect(inProgressButton).not.toBeDisabled();

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

  test('should show status controls for in-progress session', async ({ page }) => {
    // Use session 3 which is in progress
    await page.goto('/campaigns/test-campaign-1/sessions/test-session-3');
    await page.waitForLoadState('networkidle');

    // Should see Session Status section
    await expect(page.getByText('Session Status')).toBeVisible();

    // Should see status buttons
    await expect(page.getByRole('button', { name: /Planning/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /In Progress/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mark Complete/ })).toBeVisible();

    // Quick notes should be editable
    const quickNotesTextarea = page.getByPlaceholder(/What's happening in the session/);
    await expect(quickNotesTextarea).not.toBeDisabled();

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
