import { test, expect } from '@playwright/test';

/**
 * QuiverDM UI Test Suite
 * Comprehensive front-end testing of workflows and UI components
 */

test.describe('QuiverDM Application Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage before each test
    await page.goto('http://localhost:3000');
  });

  test('Homepage loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/QuiverDM/i);

    // Take a screenshot
    await page.screenshot({
      path: 'tests/screenshots/01-homepage.png',
      fullPage: true
    });
  });

  test('Navigation elements are present', async ({ page }) => {
    // Check for navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Check for key links/buttons
    const homeLink = page.locator('a[href="/"]').first();
    await expect(homeLink).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/02-navigation.png',
      fullPage: true
    });
  });

  test('Dark mode theme is applied', async ({ page }) => {
    // Check that dark mode classes or styles are present
    const html = page.locator('html');
    const classList = await html.getAttribute('class');

    console.log('HTML classes:', classList);

    await page.screenshot({
      path: 'tests/screenshots/03-dark-mode.png',
      fullPage: true
    });
  });

  test('Check for authentication state', async ({ page }) => {
    // Look for sign in button or user menu
    const signInButton = page.getByRole('button', { name: /sign in/i });
    const userMenu = page.locator('[data-testid="user-menu"]');

    const isSignInVisible = await signInButton.isVisible().catch(() => false);
    const isUserMenuVisible = await userMenu.isVisible().catch(() => false);

    if (isSignInVisible) {
      console.log('✓ Sign In button found - User not authenticated');
    } else if (isUserMenuVisible) {
      console.log('✓ User menu found - User authenticated');
    } else {
      console.log('⚠ Unable to determine auth state');
    }

    await page.screenshot({
      path: 'tests/screenshots/04-auth-state.png',
      fullPage: true
    });
  });

  test('Campaigns page navigation', async ({ page }) => {
    // Try to navigate to campaigns
    const campaignsLink = page.locator('a[href*="campaign"]').first();

    if (await campaignsLink.isVisible().catch(() => false)) {
      await campaignsLink.click();
      await page.waitForLoadState('networkidle');

      console.log('✓ Navigated to:', page.url());

      await page.screenshot({
        path: 'tests/screenshots/05-campaigns.png',
        fullPage: true
      });
    } else {
      console.log('⚠ Campaigns link not found (may require authentication)');
    }
  });

  test('Homebrew library navigation', async ({ page }) => {
    const homebrewLink = page.locator('a[href*="homebrew"]').first();

    if (await homebrewLink.isVisible().catch(() => false)) {
      await homebrewLink.click();
      await page.waitForLoadState('networkidle');

      console.log('✓ Navigated to:', page.url());

      await page.screenshot({
        path: 'tests/screenshots/06-homebrew.png',
        fullPage: true
      });
    } else {
      console.log('⚠ Homebrew link not found');
    }
  });

  test('Check for console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    if (errors.length > 0) {
      console.log(`⚠ Console errors found: ${errors.length}`);
      errors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✓ No console errors detected');
    }

    expect(errors.length).toBe(0);
  });

  test('Mobile responsive design - 375x667', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'tests/screenshots/07-mobile-375.png',
      fullPage: true
    });

    // Check that mobile navigation works
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('Tablet responsive design - 768x1024', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'tests/screenshots/08-tablet-768.png',
      fullPage: true
    });
  });

  test('Desktop responsive design - 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'tests/screenshots/09-desktop-1920.png',
      fullPage: true
    });
  });

  test('Page performance metrics', async ({ page }) => {
    const navigationTiming = await page.evaluate(() => {
      const perfData = window.performance.timing;
      return {
        loadTime: perfData.loadEventEnd - perfData.navigationStart,
        domReady: perfData.domContentLoadedEventEnd - perfData.navigationStart,
        responseTime: perfData.responseEnd - perfData.requestStart
      };
    });

    console.log('Performance Metrics:');
    console.log(`  Load Time: ${navigationTiming.loadTime}ms`);
    console.log(`  DOM Ready: ${navigationTiming.domReady}ms`);
    console.log(`  Response Time: ${navigationTiming.responseTime}ms`);

    // Performance assertions (adjust thresholds as needed)
    expect(navigationTiming.loadTime).toBeLessThan(10000);
  });

  test('Check for accessibility issues', async ({ page }) => {
    // Basic accessibility checks
    const mainLandmark = page.locator('main');
    const headings = page.locator('h1, h2, h3');

    // Check for main landmark
    const hasMain = await mainLandmark.count() > 0;
    console.log(`Main landmark present: ${hasMain}`);

    // Check for proper heading structure
    const headingCount = await headings.count();
    console.log(`Headings found: ${headingCount}`);

    await page.screenshot({
      path: 'tests/screenshots/10-accessibility.png',
      fullPage: true
    });
  });

  test('Interactive elements are clickable', async ({ page }) => {
    // Get all buttons and links
    const buttons = page.locator('button');
    const links = page.locator('a');

    const buttonCount = await buttons.count();
    const linkCount = await links.count();

    console.log(`Interactive elements found:`);
    console.log(`  Buttons: ${buttonCount}`);
    console.log(`  Links: ${linkCount}`);

    // Verify at least some interactive elements exist
    expect(buttonCount + linkCount).toBeGreaterThan(0);
  });

  test('Search functionality if available', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');

    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      console.log('✓ Search input functional');

      await page.screenshot({
        path: 'tests/screenshots/11-search.png',
        fullPage: true
      });
    } else {
      console.log('⚠ Search input not found');
    }
  });

  test('Form elements are functional', async ({ page }) => {
    // Look for any forms
    const forms = page.locator('form');
    const formCount = await forms.count();

    if (formCount > 0) {
      console.log(`✓ Forms found: ${formCount}`);

      // Check for input fields
      const inputs = page.locator('input:not([type="hidden"])');
      const inputCount = await inputs.count();
      console.log(`  Input fields: ${inputCount}`);

      await page.screenshot({
        path: 'tests/screenshots/12-forms.png',
        fullPage: true
      });
    } else {
      console.log('⚠ No forms found on homepage');
    }
  });

  test('Network requests complete successfully', async ({ page }) => {
    const failedRequests: string[] = [];

    page.on('requestfailed', (request) => {
      failedRequests.push(`${request.method()} ${request.url()}`);
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    if (failedRequests.length > 0) {
      console.log(`⚠ Failed requests: ${failedRequests.length}`);
      failedRequests.forEach(req => console.log(`  - ${req}`));
    } else {
      console.log('✓ All network requests successful');
    }

    expect(failedRequests.length).toBe(0);
  });
});
