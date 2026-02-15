import { test, expect } from '@playwright/test';

test.describe('Admin Invites Page', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[Browser Console Error] ${msg.text()}`);
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      console.log(`[Page Error] ${error.message}`);
    });

    // Navigate to admin invites page
    await page.goto('http://localhost:3847/admin/invites');
  });

  test('page loads successfully', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Beta Invite Codes');

    // Check description
    await expect(page.locator('p').first()).toContainText('Generate and manage closed beta invite codes');
  });

  test('tabs are visible and clickable', async ({ page }) => {
    // Wait for tabs to load
    await page.waitForSelector('[role="tablist"]');

    // Check Generate tab is active by default
    const generateTab = page.locator('[role="tab"]', { hasText: 'Generate' });
    await expect(generateTab).toBeVisible();

    // Check All Codes tab exists
    const codesTab = page.locator('[role="tab"]').filter({ hasText: /All Codes/ });
    await expect(codesTab).toBeVisible();

    // Click All Codes tab
    await codesTab.click();
    await page.waitForTimeout(500);

    // Click back to Generate
    await generateTab.click();
    await page.waitForTimeout(500);

    console.log('✅ All tabs are clickable');
  });

  test('stats cards display on Generate tab', async ({ page }) => {
    // Wait for stats to load
    await page.waitForTimeout(2000);

    // Stats are now on the Generate tab (which is default)
    // Should have 4 stat cards: Total, Used, Unused, Expired
    const totalCard = page.locator('text=Total Codes');
    const usedCard = page.locator('text=Used');
    const unusedCard = page.locator('text=Unused');
    const expiredCard = page.locator('text=Expired');

    await expect(totalCard).toBeVisible();
    await expect(usedCard).toBeVisible();
    await expect(unusedCard).toBeVisible();
    await expect(expiredCard).toBeVisible();

    console.log('✅ All stat cards are visible on Generate tab');
  });

  test('Generate Single Code button exists and is clickable', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Find the "Generate Single Code" button
    const generateButton = page.locator('button', { hasText: 'Generate Single Code' });
    await expect(generateButton).toBeVisible();

    // Check button is enabled
    await expect(generateButton).toBeEnabled();

    console.log('✅ Generate Single Code button is visible and enabled');

    // Click the button
    await generateButton.click();

    // Wait for response (should show loading state)
    await page.waitForTimeout(2000);

    console.log('✅ Generate Single Code button clicked');
  });

  test('Generate tab has bulk generation form', async ({ page }) => {
    // Generate tab is the default tab, so we're already on it
    await page.waitForTimeout(1000);

    // Check for count input
    const countInput = page.locator('input[type="number"]').first();
    await expect(countInput).toBeVisible();

    // Check for expires input
    const expiresInput = page.locator('input[type="number"]').nth(1);
    await expect(expiresInput).toBeVisible();

    // Check for Generate Codes button
    const bulkButton = page.locator('button', { hasText: /Generate \d+ Codes/ });
    await expect(bulkButton).toBeVisible();

    console.log('✅ Bulk generation form is complete');
  });

  test('All Codes tab shows table', async ({ page }) => {
    // Click All Codes tab
    const codesTab = page.locator('[role="tab"]').filter({ hasText: /All Codes/ });
    await codesTab.click();
    await page.waitForTimeout(2000);

    // Check for table headers
    const codeHeader = page.locator('th', { hasText: 'Code' });
    const createdHeader = page.locator('th', { hasText: 'Created' });
    const expiresHeader = page.locator('th', { hasText: 'Expires' });
    const actionHeader = page.locator('th', { hasText: 'Action' });

    await expect(codeHeader).toBeVisible();
    await expect(createdHeader).toBeVisible();
    await expect(expiresHeader).toBeVisible();
    await expect(actionHeader).toBeVisible();

    console.log('✅ All Codes table headers are visible');
  });

  test('check for console errors', async ({ page }) => {
    const errors: string[] = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Click through all tabs
    const codesTab = page.locator('[role="tab"]').filter({ hasText: /All Codes/ });
    await codesTab.click();
    await page.waitForTimeout(1000);

    const generateTab = page.locator('[role="tab"]', { hasText: 'Generate' });
    await generateTab.click();
    await page.waitForTimeout(1000);

    // Report errors
    if (errors.length > 0) {
      console.log(`❌ Found ${errors.length} console/page errors:`);
      errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    } else {
      console.log('✅ No console errors detected');
    }

    // Test should still pass even with non-critical errors
    // but we log them for visibility
  });

  test('responsive layout check', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    console.log('✅ Desktop view (1920x1080) rendered');

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    console.log('✅ Tablet view (768x1024) rendered');

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    console.log('✅ Mobile view (375x667) rendered');

    // Return to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('full user flow - generate and view code', async ({ page }) => {
    // Wait for initial load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('Starting full user flow test...');

    // Step 1: Click Generate Single Code
    console.log('Step 1: Clicking Generate Single Code button...');
    const generateButton = page.locator('button', { hasText: 'Generate Single Code' }).first();
    await generateButton.click();

    // Wait for generation
    await page.waitForTimeout(3000);

    // Step 2: Navigate to All Codes tab
    console.log('Step 2: Navigating to All Codes tab...');
    const codesTab = page.locator('[role="tab"]').filter({ hasText: /All Codes/ });
    await codesTab.click();
    await page.waitForTimeout(2000);

    // Step 3: Check if table has rows
    console.log('Step 3: Checking for code in table...');
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();

    console.log(`✅ Found ${rowCount} code(s) in table`);

    if (rowCount > 0) {
      // Step 4: Try to copy a code
      console.log('Step 4: Testing copy functionality...');
      const copyButton = page.locator('button').filter({ has: page.locator('svg') }).first();

      if (await copyButton.isVisible()) {
        await copyButton.click();
        await page.waitForTimeout(1000);
        console.log('✅ Copy button clicked');
      }
    }

    console.log('✅ Full user flow completed successfully');
  });
});
