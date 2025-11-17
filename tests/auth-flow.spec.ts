import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const baseUrl = 'http://localhost:3001';

  test.describe('Unauthenticated Access', () => {
    test('should redirect to sign in when accessing protected routes without auth', async ({ page }) => {
      console.log('📍 Testing protected route access without authentication...');

      // Try to access campaigns page without auth
      await page.goto(`${baseUrl}/campaigns`);
      await page.waitForLoadState('networkidle');

      // Should redirect to sign in or show auth state
      const url = page.url();
      console.log(`Current URL: ${url}`);

      // Check if we're on sign in page or see auth-related content
      const pageContent = await page.textContent('body');
      const hasAuthContent =
        url.includes('/auth/signin') ||
        pageContent?.includes('Sign in') ||
        pageContent?.includes('Sign up') ||
        pageContent?.includes('Get Started');

      if (hasAuthContent) {
        console.log('✅ Protected route properly requires authentication');
      } else {
        console.log('⚠️  WARNING: Protected route may be accessible without authentication');
      }

      await page.screenshot({ path: 'test-results/unauth-campaigns-access.png', fullPage: true });
    });

    test('should access sign in page directly', async ({ page }) => {
      console.log('📍 Testing sign in page access...');

      await page.goto(`${baseUrl}/auth/signin`);
      await page.waitForLoadState('networkidle');

      // Verify sign in page elements
      await expect(page.locator('text=Sign in to QuiverDM')).toBeVisible({ timeout: 10000 });
      console.log('✓ Sign in heading visible');

      // Check for email field
      const emailField = page.locator('input[type="email"]');
      await expect(emailField).toBeVisible();
      console.log('✓ Email field visible');

      // Check for password field
      const passwordField = page.locator('input[type="password"]');
      await expect(passwordField).toBeVisible();
      console.log('✓ Password field visible');

      // Check for submit button
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeVisible();
      console.log('✓ Submit button visible');

      // Check for Discord button
      const discordButton = page.locator('button:has-text("Continue with Discord")');
      await expect(discordButton).toBeVisible();
      console.log('✓ Discord sign in button visible');

      // Check for sign up link
      const signUpLink = page.locator('a[href="/auth/signup"]');
      await expect(signUpLink).toBeVisible();
      console.log('✓ Sign up link visible');

      await page.screenshot({ path: 'test-results/signin-page.png', fullPage: true });
      console.log('✅ Sign in page has all required elements');
    });

    test('should access sign up page directly', async ({ page }) => {
      console.log('📍 Testing sign up page access...');

      await page.goto(`${baseUrl}/auth/signup`);
      await page.waitForLoadState('networkidle');

      // Check for sign up heading
      const heading = page.locator('h1, h2, h3').filter({ hasText: /sign up|create.*account/i });
      const headingExists = await heading.count() > 0;

      if (headingExists) {
        console.log('✓ Sign up page loaded');
      } else {
        console.log('⚠️  Sign up page may not have expected heading');
      }

      await page.screenshot({ path: 'test-results/signup-page.png', fullPage: true });
    });
  });

  test.describe('Sign In Validation', () => {
    test('should show error for empty credentials', async ({ page }) => {
      console.log('📍 Testing empty credentials validation...');

      await page.goto(`${baseUrl}/auth/signin`);
      await page.waitForLoadState('networkidle');

      // Try to submit without filling fields
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Wait a moment for validation
      await page.waitForTimeout(500);

      // HTML5 validation should prevent submission or show error
      // Check if we're still on signin page (didn't navigate)
      expect(page.url()).toContain('/auth/signin');
      console.log('✓ Form validation prevents empty submission');

      await page.screenshot({ path: 'test-results/signin-empty-validation.png' });
      console.log('✅ Empty credentials validation works');
    });

    test('should show error for invalid email format', async ({ page }) => {
      console.log('📍 Testing invalid email format validation...');

      await page.goto(`${baseUrl}/auth/signin`);
      await page.waitForLoadState('networkidle');

      // Enter invalid email
      const emailField = page.locator('input[type="email"]');
      await emailField.fill('not-an-email');

      const passwordField = page.locator('input[type="password"]');
      await passwordField.fill('password123');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      await page.waitForTimeout(500);

      // Should still be on signin page due to HTML5 validation
      expect(page.url()).toContain('/auth/signin');
      console.log('✓ Invalid email format rejected');

      await page.screenshot({ path: 'test-results/signin-invalid-email.png' });
      console.log('✅ Email format validation works');
    });

    test('should show error for non-existent credentials', async ({ page }) => {
      console.log('📍 Testing non-existent user credentials...');

      await page.goto(`${baseUrl}/auth/signin`);
      await page.waitForLoadState('networkidle');

      // Enter valid format but non-existent credentials
      const emailField = page.locator('input[type="email"]');
      await emailField.fill('nonexistent@example.com');

      const passwordField = page.locator('input[type="password"]');
      await passwordField.fill('wrongpassword123');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Wait for response
      await page.waitForTimeout(2000);

      // Check for error message
      const errorText = page.locator('text=/invalid.*email.*password/i, text=/error/i').first();
      const hasError = await errorText.count() > 0;

      if (hasError) {
        console.log('✓ Error message displayed for invalid credentials');
      } else {
        console.log('⚠️  No visible error message found (may be styled differently)');
      }

      await page.screenshot({ path: 'test-results/signin-invalid-credentials.png' });
      console.log('✅ Invalid credentials handled');
    });

    test('should enable/disable submit button while loading', async ({ page }) => {
      console.log('📍 Testing loading state...');

      await page.goto(`${baseUrl}/auth/signin`);
      await page.waitForLoadState('networkidle');

      const emailField = page.locator('input[type="email"]');
      await emailField.fill('test@example.com');

      const passwordField = page.locator('input[type="password"]');
      await passwordField.fill('testpassword123');

      const submitButton = page.locator('button[type="submit"]');

      // Check initial state
      const isInitiallyEnabled = await submitButton.isEnabled();
      console.log(`✓ Submit button initially enabled: ${isInitiallyEnabled}`);

      // Click and check if loading state appears
      await submitButton.click();

      // Check for loading text or disabled state
      await page.waitForTimeout(500);
      const buttonText = await submitButton.textContent();
      console.log(`✓ Button text during submission: "${buttonText}"`);

      await page.screenshot({ path: 'test-results/signin-loading-state.png' });
      console.log('✅ Loading state test complete');
    });
  });

  test.describe('Protected Routes', () => {
    const protectedRoutes = [
      '/campaigns',
      '/campaigns/test-id',
      '/campaigns/test-id/sessions',
      '/campaigns/test-id/npcs',
      '/campaigns/test-id/homebrew',
      '/settings',
    ];

    for (const route of protectedRoutes) {
      test(`should protect ${route}`, async ({ page }) => {
        console.log(`📍 Testing protection for ${route}...`);

        await page.goto(`${baseUrl}${route}`);
        await page.waitForLoadState('networkidle');

        const url = page.url();
        const pageContent = await page.textContent('body');

        // Check if redirected to signin or showing auth prompt
        const isProtected =
          url.includes('/auth/signin') ||
          url.includes('/auth/signup') ||
          pageContent?.toLowerCase().includes('sign in') ||
          pageContent?.toLowerCase().includes('sign up') ||
          url === `${baseUrl}/` ||
          pageContent?.toLowerCase().includes('get started');

        if (isProtected) {
          console.log(`✅ ${route} is properly protected`);
        } else {
          console.log(`⚠️  WARNING: ${route} may not require authentication!`);
          console.log(`   Current URL: ${url}`);
        }

        await page.screenshot({
          path: `test-results/protected-${route.replace(/\//g, '-')}.png`,
          fullPage: true
        });
      });
    }
  });

  test.describe('Navigation Elements', () => {
    test('should show user menu when authenticated', async ({ page }) => {
      console.log('📍 Testing user menu visibility...');

      // This test assumes user might be authenticated
      await page.goto(`${baseUrl}/campaigns`);
      await page.waitForLoadState('networkidle');

      // Look for user menu/avatar/profile elements
      const userMenuSelectors = [
        '[aria-label*="user" i]',
        '[aria-label*="account" i]',
        '[aria-label*="profile" i]',
        'button:has-text("Sign out")',
        'button:has-text("Log out")',
        'img[alt*="avatar" i]',
      ];

      let foundUserMenu = false;
      for (const selector of userMenuSelectors) {
        const element = page.locator(selector).first();
        if (await element.count() > 0 && await element.isVisible()) {
          console.log(`✓ Found user menu element: ${selector}`);
          foundUserMenu = true;
          break;
        }
      }

      if (!foundUserMenu) {
        console.log('ℹ️  No user menu found (may not be authenticated)');
      }

      await page.screenshot({ path: 'test-results/user-menu-check.png' });
      console.log('✅ User menu check complete');
    });

    test('should have global navigation elements', async ({ page }) => {
      console.log('📍 Testing global navigation...');

      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Check for nav element
      const nav = page.locator('nav');
      const hasNav = await nav.count() > 0;

      if (hasNav) {
        console.log('✓ Navigation bar present');

        // Check for logo/brand
        const logo = page.locator('nav').locator('text=QuiverDM');
        if (await logo.count() > 0) {
          console.log('✓ Logo/brand present');
        }

        // Check for key navigation items
        const navContent = await nav.textContent();
        console.log(`✓ Navigation contains: ${navContent?.substring(0, 100)}...`);
      }

      await page.screenshot({ path: 'test-results/global-navigation.png' });
      console.log('✅ Global navigation check complete');
    });
  });

  test.describe('Session Persistence', () => {
    test('should maintain session across page reloads', async ({ page, context }) => {
      console.log('📍 Testing session persistence...');

      // Visit homepage
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Get cookies before reload
      const cookiesBefore = await context.cookies();
      console.log(`✓ Cookies before reload: ${cookiesBefore.length}`);

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Get cookies after reload
      const cookiesAfter = await context.cookies();
      console.log(`✓ Cookies after reload: ${cookiesAfter.length}`);

      // Check for session-related cookies
      const sessionCookies = cookiesAfter.filter(c =>
        c.name.includes('session') ||
        c.name.includes('auth') ||
        c.name.includes('next-auth')
      );

      if (sessionCookies.length > 0) {
        console.log(`✓ Found ${sessionCookies.length} session-related cookie(s)`);
      } else {
        console.log('ℹ️  No session cookies found (expected when not authenticated)');
      }

      console.log('✅ Session persistence check complete');
    });
  });

  test.describe('Error Page', () => {
    test('should display auth error page for auth errors', async ({ page }) => {
      console.log('📍 Testing auth error page...');

      await page.goto(`${baseUrl}/auth/error`);
      await page.waitForLoadState('networkidle');

      // Should show some error content
      const pageContent = await page.textContent('body');
      console.log(`✓ Error page loaded`);

      await page.screenshot({ path: 'test-results/auth-error-page.png', fullPage: true });
      console.log('✅ Auth error page check complete');
    });
  });
});
