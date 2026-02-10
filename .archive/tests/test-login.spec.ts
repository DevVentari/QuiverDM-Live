import { test, expect } from '@playwright/test';

const TEST_USER_EMAIL = 'dev@blakewales.au';
const TEST_USER_PASSWORD = 'xaub6Nam7648';

test.describe('Login and Navigate', () => {
  test('should login successfully and access campaigns', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log(`[CONSOLE] ${msg.text()}`));
    page.on('pageerror', error => console.log(`[ERROR] ${error.message}`));

    console.log('\n=== Step 1: Navigate to signin page ===');
    await page.goto('http://localhost:3003/auth/signin');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/login-01-signin-page.png', fullPage: true });

    console.log('\n=== Step 2: Fill in credentials ===');
    // Wait for the email input
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.waitFor({ state: 'visible' });

    await emailInput.fill(TEST_USER_EMAIL);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_USER_PASSWORD);
    await page.screenshot({ path: 'test-results/login-02-credentials-filled.png', fullPage: true });

    console.log('\n=== Step 3: Submit login ===');
    await page.locator('button[type="submit"]').first().click();

    // Wait for redirect after login
    await page.waitForURL(/campaigns|dashboard|home/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/login-03-after-login.png', fullPage: true });

    console.log(`Current URL after login: ${page.url()}`);

    console.log('\n=== Step 4: Navigate to campaigns ===');
    await page.goto('http://localhost:3003/campaigns');
    await page.waitForLoadState('networkidle');

    // Wait for campaigns to load (or empty state)
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/login-04-campaigns-page.png', fullPage: true });

    // Check for content
    const pageText = await page.locator('body').textContent();
    console.log(`\nPage contains "Loading": ${pageText?.includes('Loading')}`);
    console.log(`Page contains "campaign": ${pageText?.toLowerCase().includes('campaign')}`);

    // Look for create campaign button or empty state
    const createButton = page.locator('button', { hasText: /create|new campaign/i }).first();
    const hasCreateButton = await createButton.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Create campaign button visible: ${hasCreateButton}`);

    if (hasCreateButton) {
      console.log('\n=== Step 5: Click create campaign ===');
      await createButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/login-05-create-campaign.png', fullPage: true });
    }

    console.log('\n=== Login test complete ===');
  });
});
