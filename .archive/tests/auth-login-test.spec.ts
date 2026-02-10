import { test, expect } from '@playwright/test';

/**
 * QuiverDM Email/Password Login Test
 * Tests the credentials-based authentication flow
 */

test.describe('Email/Password Authentication', () => {

  test('Login with email and password', async ({ page }) => {
    // Navigate directly to sign in page
    await page.goto('http://localhost:3000/auth/signin');
    await page.waitForLoadState('networkidle');

    console.log('📝 Sign in page loaded');

    await page.screenshot({
      path: 'tests/screenshots/login-01-signin-page.png',
      fullPage: true
    });

    // Fill in email
    const emailInput = page.locator('input#email');
    await emailInput.fill('dev@blakewales.au');
    console.log('✓ Email entered');

    // Fill in password
    const passwordInput = page.locator('input#password');
    await passwordInput.fill('xaub6NaM7468');
    console.log('✓ Password entered');

    await page.screenshot({
      path: 'tests/screenshots/login-02-credentials-filled.png',
      fullPage: true
    });

    // Click the "Sign in with Email" button
    const signInButton = page.getByRole('button', { name: 'Sign in with Email' });
    await expect(signInButton).toBeVisible();

    await signInButton.click();
    console.log('✓ Sign in button clicked');

    // Wait for navigation or error
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);

    await page.screenshot({
      path: 'tests/screenshots/login-03-after-submit.png',
      fullPage: true
    });

    // Check for error messages
    const errorText = page.locator('text=/invalid|error|failed/i');
    const hasError = await errorText.count() > 0;

    if (hasError) {
      const errorMessage = await errorText.first().textContent();
      console.log('❌ Error found:', errorMessage);
    } else {
      console.log('✓ No error message displayed');
    }

    // Check if we were redirected away from signin page
    if (currentUrl.includes('/auth/signin')) {
      console.log('⚠️  Still on sign in page - login may have failed');
    } else if (currentUrl.includes('/auth/error')) {
      console.log('❌ Redirected to error page');
    } else {
      console.log('✓ Redirected to:', currentUrl);
    }
  });

  test('Check authenticated state after login', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/auth/signin');
    await page.locator('input#email').fill('dev@blakewales.au');
    await page.locator('input#password').fill('xaub6NaM7468');
    await page.getByRole('button', { name: 'Sign in with Email' }).click();
    await page.waitForTimeout(3000);

    // Try to access a protected page
    await page.goto('http://localhost:3000/campaigns');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    console.log('📍 Campaigns page URL:', url);

    await page.screenshot({
      path: 'tests/screenshots/login-04-campaigns-page.png',
      fullPage: true
    });

    // Check if we can access the page
    if (url.includes('/campaigns') && !url.includes('/auth/')) {
      console.log('✅ Successfully accessed campaigns page');

      // Look for campaign content
      const pageContent = await page.textContent('body');
      console.log('Page contains "campaign":', pageContent?.toLowerCase().includes('campaign'));

    } else if (url.includes('/auth/error')) {
      console.log('❌ Blocked - redirected to auth error');
    } else if (url.includes('/auth/signin')) {
      console.log('❌ Blocked - redirected to sign in');
    }
  });

  test('Test complete user flow', async ({ page }) => {
    console.log('\n=== COMPLETE USER FLOW TEST ===\n');

    // Step 1: Visit homepage
    console.log('Step 1: Visit homepage');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    console.log('✓ Homepage loaded');

    // Step 2: Click "Get Started" or "Sign In"
    console.log('\nStep 2: Click sign in');
    const signInLink = page.getByRole('button', { name: /get started|sign in/i }).first();
    await signInLink.click();
    await page.waitForLoadState('networkidle');
    console.log('✓ Navigated to sign in page');

    await page.screenshot({
      path: 'tests/screenshots/flow-01-signin.png',
      fullPage: true
    });

    // Step 3: Login
    console.log('\nStep 3: Enter credentials');
    await page.locator('input#email').fill('dev@blakewales.au');
    await page.locator('input#password').fill('xaub6NaM7468');
    console.log('✓ Credentials entered');

    await page.screenshot({
      path: 'tests/screenshots/flow-02-filled.png',
      fullPage: true
    });

    console.log('\nStep 4: Submit login');
    await page.getByRole('button', { name: 'Sign in with Email' }).click();
    await page.waitForTimeout(3000);

    const afterLoginUrl = page.url();
    console.log('✓ After login URL:', afterLoginUrl);

    await page.screenshot({
      path: 'tests/screenshots/flow-03-after-login.png',
      fullPage: true
    });

    // Step 5: Navigate to campaigns
    console.log('\nStep 5: Navigate to campaigns');
    await page.goto('http://localhost:3000/campaigns');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const campaignsUrl = page.url();
    console.log('✓ Campaigns URL:', campaignsUrl);

    await page.screenshot({
      path: 'tests/screenshots/flow-04-campaigns.png',
      fullPage: true
    });

    // Step 6: Try to access other pages
    const pagesToTest = [
      { url: '/homebrew', name: 'Homebrew Library' },
      { url: '/settings', name: 'Settings' },
    ];

    for (const testPage of pagesToTest) {
      console.log(`\nStep 6.${pagesToTest.indexOf(testPage) + 1}: Navigate to ${testPage.name}`);
      await page.goto(`http://localhost:3000${testPage.url}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const pageUrl = page.url();
      console.log(`✓ ${testPage.name} URL:`, pageUrl);

      await page.screenshot({
        path: `tests/screenshots/flow-05-${testPage.url.replace('/', '')}.png`,
        fullPage: true
      });
    }

    console.log('\n=== FLOW TEST COMPLETE ===\n');
  });
});
