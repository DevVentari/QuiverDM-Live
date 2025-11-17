import { test, expect } from '@playwright/test';

/**
 * QuiverDM Authenticated User Tests
 * Tests workflows that require user authentication
 */

test.describe('QuiverDM Authenticated Features', () => {

  // Login before each test
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('http://localhost:3000');

    // Click Sign In button
    const signInButton = page.getByRole('button', { name: /sign in|get started/i }).first();
    await signInButton.click();

    // Wait for auth page to load
    await page.waitForLoadState('networkidle');

    // Look for email/password login form or provider buttons
    const emailInput = page.locator('input[type="email"], input[name="email"]');

    if (await emailInput.isVisible().catch(() => false)) {
      // Email/password login
      await emailInput.fill('dev@blakewales.au');

      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      await passwordInput.fill('xaub6NaM7468');

      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();

      await page.waitForLoadState('networkidle');
    } else {
      // Look for OAuth provider buttons
      console.log('Checking for OAuth providers...');

      // Try Google sign in
      const googleButton = page.getByRole('button', { name: /google/i });
      if (await googleButton.isVisible().catch(() => false)) {
        console.log('Google OAuth available');
      }

      // Try Discord sign in
      const discordButton = page.getByRole('button', { name: /discord/i });
      if (await discordButton.isVisible().catch(() => false)) {
        console.log('Discord OAuth available');
      }
    }

    // Take screenshot of auth state
    await page.screenshot({
      path: 'tests/screenshots/auth-login-page.png',
      fullPage: true
    });
  });

  test('Authentication flow', async ({ page }) => {
    // Check if we're logged in
    const url = page.url();
    console.log('Current URL after auth:', url);

    await page.screenshot({
      path: 'tests/screenshots/auth-01-logged-in.png',
      fullPage: true
    });

    // Look for user menu or profile indicator
    const userMenu = page.locator('[data-testid="user-menu"], button:has-text("Profile"), button:has-text("Account")');
    const hasUserMenu = await userMenu.count() > 0;

    console.log('User menu found:', hasUserMenu);
  });

  test('Dashboard access', async ({ page }) => {
    // Try to navigate to dashboard/campaigns
    const dashboardLink = page.locator('a[href*="dashboard"], a[href*="campaign"]').first();

    if (await dashboardLink.isVisible().catch(() => false)) {
      await dashboardLink.click();
      await page.waitForLoadState('networkidle');

      console.log('Dashboard URL:', page.url());

      await page.screenshot({
        path: 'tests/screenshots/auth-02-dashboard.png',
        fullPage: true
      });
    } else {
      console.log('Dashboard link not found, navigating directly...');
      await page.goto('http://localhost:3000/campaigns');
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: 'tests/screenshots/auth-02-campaigns.png',
        fullPage: true
      });
    }
  });

  test('Campaign creation workflow', async ({ page }) => {
    // Navigate to campaigns page
    await page.goto('http://localhost:3000/campaigns');
    await page.waitForLoadState('networkidle');

    // Look for "Create Campaign" or "New Campaign" button
    const createButton = page.getByRole('button', { name: /create|new|add.*campaign/i }).first();

    if (await createButton.isVisible().catch(() => false)) {
      console.log('✓ Create campaign button found');

      await createButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'tests/screenshots/auth-03-create-campaign-modal.png',
        fullPage: true
      });

      // Try to fill in campaign details
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('Test Campaign - Automated');

        const descInput = page.locator('textarea, input[name="description"]').first();
        if (await descInput.isVisible().catch(() => false)) {
          await descInput.fill('This is a test campaign created by automated UI tests');
        }

        await page.screenshot({
          path: 'tests/screenshots/auth-04-campaign-form-filled.png',
          fullPage: true
        });

        // Don't actually submit to avoid creating test data
        console.log('✓ Campaign form filled (not submitted)');
      }
    } else {
      console.log('⚠ Create campaign button not found');
      await page.screenshot({
        path: 'tests/screenshots/auth-03-campaigns-page.png',
        fullPage: true
      });
    }
  });

  test('Homebrew library access', async ({ page }) => {
    // Navigate to homebrew library
    await page.goto('http://localhost:3000/homebrew');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    console.log('Homebrew URL:', url);

    await page.screenshot({
      path: 'tests/screenshots/auth-05-homebrew-library.png',
      fullPage: true
    });

    // Look for upload button
    const uploadButton = page.getByRole('button', { name: /upload|add.*homebrew|new/i }).first();
    const hasUpload = await uploadButton.isVisible().catch(() => false);

    console.log('Upload button found:', hasUpload);

    // Check for existing homebrew items
    const homebrewCards = page.locator('article, .homebrew-card, [data-testid*="homebrew"]');
    const homebrewCount = await homebrewCards.count();

    console.log('Homebrew items found:', homebrewCount);
  });

  test('Settings page access', async ({ page }) => {
    // Try to access settings
    await page.goto('http://localhost:3000/settings');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'tests/screenshots/auth-06-settings.png',
      fullPage: true
    });

    // Check for settings sections
    const settingsSections = page.locator('h2, h3');
    const sectionCount = await settingsSections.count();

    console.log('Settings sections found:', sectionCount);
  });

  test('Navigation between authenticated pages', async ({ page }) => {
    const pages = [
      { url: '/campaigns', name: 'Campaigns' },
      { url: '/homebrew', name: 'Homebrew' },
      { url: '/settings', name: 'Settings' },
    ];

    for (const testPage of pages) {
      console.log(`Testing navigation to ${testPage.name}...`);

      await page.goto(`http://localhost:3000${testPage.url}`);
      await page.waitForLoadState('networkidle');

      // Check that we're on the right page
      const url = page.url();
      expect(url).toContain(testPage.url);

      console.log(`✓ ${testPage.name} page accessible`);
    }
  });

  test('Check for campaign list', async ({ page }) => {
    await page.goto('http://localhost:3000/campaigns');
    await page.waitForLoadState('networkidle');

    // Look for campaign cards or list items
    const campaigns = page.locator('article, .campaign-card, [data-testid*="campaign"]');
    const campaignCount = await campaigns.count();

    console.log(`Campaigns found: ${campaignCount}`);

    if (campaignCount > 0) {
      // Try to click on first campaign
      const firstCampaign = campaigns.first();
      await firstCampaign.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'tests/screenshots/auth-07-campaign-detail.png',
        fullPage: true
      });

      console.log('Campaign detail URL:', page.url());
    } else {
      console.log('⚠ No campaigns found (new user account)');
    }
  });

  test('User profile/account menu', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Look for user menu button (avatar, email, profile icon, etc.)
    const userMenuButton = page.locator(
      'button:has-text("dev@blakewales.au"), ' +
      '[data-testid="user-menu"], ' +
      'button[aria-label*="profile" i], ' +
      'button[aria-label*="account" i]'
    ).first();

    if (await userMenuButton.isVisible().catch(() => false)) {
      console.log('✓ User menu button found');

      await userMenuButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'tests/screenshots/auth-08-user-menu.png',
        fullPage: true
      });

      // Look for sign out option
      const signOutButton = page.getByRole('button', { name: /sign out|logout/i });
      const hasSignOut = await signOutButton.isVisible().catch(() => false);

      console.log('Sign out button found:', hasSignOut);
    } else {
      console.log('⚠ User menu button not found');
      await page.screenshot({
        path: 'tests/screenshots/auth-08-no-user-menu.png',
        fullPage: true
      });
    }
  });

  test('Responsive design - authenticated mobile view', async ({ page }) => {
    await page.goto('http://localhost:3000/campaigns');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'tests/screenshots/auth-09-mobile-campaigns.png',
      fullPage: true
    });

    // Check for mobile menu
    const mobileMenu = page.locator('button[aria-label*="menu" i], button:has-text("☰")');
    const hasMobileMenu = await mobileMenu.isVisible().catch(() => false);

    console.log('Mobile menu found:', hasMobileMenu);
  });

  test('Check for empty states', async ({ page }) => {
    await page.goto('http://localhost:3000/campaigns');
    await page.waitForLoadState('networkidle');

    // Look for empty state messages
    const emptyState = page.locator('text=/no campaigns|get started|create your first/i');
    const hasEmptyState = await emptyState.count() > 0;

    if (hasEmptyState) {
      console.log('✓ Empty state message found');
      const emptyText = await emptyState.first().textContent();
      console.log('Empty state text:', emptyText);
    } else {
      console.log('✓ Campaigns exist or no empty state shown');
    }
  });

});
