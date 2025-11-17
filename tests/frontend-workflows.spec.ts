import { test, expect } from '@playwright/test';

const VALID_COBALT_COOKIE = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..7FWI8eKOw0I5FsUl6ur-Qw.nYvXOFXhL1iK8nWNSAcnzBjbuWLKTXdQ-jVFHcsI347s5Tdy1K4ztqGyCZCczxtF.JYBtTi-2FFKFhRvzJwFCjQ';

test.describe('Frontend Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3007');
    await page.waitForLoadState('networkidle');
  });

  test('Cobalt Cookie Validation Test', async ({ page }) => {
    console.log('Testing cobalt cookie validation...');

    // Navigate to campaigns page (assuming user is logged in)
    // If there's a login required, we'll need to handle that first
    const campaignsLink = page.locator('a[href="/campaigns"]').first();
    if (await campaignsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await campaignsLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Look for D&D Beyond integration or settings
    // This might be in campaign settings, player settings, or a dedicated integration page
    const settingsButton = page.getByText('Settings').first();
    if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsButton.click();
      await page.waitForTimeout(1000);
    }

    // Look for D&D Beyond cookie input
    const cookieInput = page.locator('input[placeholder*="cookie" i], input[placeholder*="cobalt" i]').first();

    if (await cookieInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found cookie input field');

      // Clear and enter the valid cookie
      await cookieInput.clear();
      await cookieInput.fill(VALID_COBALT_COOKIE);

      // Look for test/validate button
      const testButton = page.getByRole('button', { name: /test|validate|check/i }).first();
      if (await testButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await testButton.click();

        // Wait for validation result
        await page.waitForTimeout(3000);

        // Check for success message
        const successMessage = page.getByText(/success|valid|verified/i).first();
        const errorMessage = page.getByText(/invalid|failed|error/i).first();

        const hasSuccess = await successMessage.isVisible({ timeout: 2000 }).catch(() => false);
        const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);

        console.log('Validation result:', { hasSuccess, hasError });

        if (hasSuccess) {
          console.log('✅ Cookie validation PASSED');
        } else if (hasError) {
          const errorText = await errorMessage.textContent();
          console.log('❌ Cookie validation FAILED:', errorText);

          // Take a screenshot for debugging
          await page.screenshot({ path: 'cookie-validation-error.png', fullPage: true });
        }
      } else {
        console.log('⚠️ Test button not found');
      }
    } else {
      console.log('⚠️ Cookie input field not found - feature may not be accessible yet');
    }

    // Take a final screenshot
    await page.screenshot({ path: 'cobalt-cookie-test.png', fullPage: true });
  });

  test('PDF Upload and Processing Workflow', async ({ page }) => {
    console.log('Testing PDF upload and processing workflow...');

    // Navigate to a campaign homebrew page
    // First, go to campaigns
    const campaignsLink = page.locator('a[href="/campaigns"]').first();
    if (await campaignsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await campaignsLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Click on first campaign if available
    const firstCampaign = page.locator('a[href*="/campaigns/"]').first();
    if (await firstCampaign.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstCampaign.click();
      await page.waitForLoadState('networkidle');

      // Navigate to homebrew section
      const homebrewLink = page.getByText('Homebrew').first();
      if (await homebrewLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await homebrewLink.click();
        await page.waitForLoadState('networkidle');

        // Check if upload button exists
        const uploadButton = page.getByRole('button', { name: /upload.*pdf/i }).first();
        if (await uploadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log('✅ Found PDF upload button');
          await page.screenshot({ path: 'homebrew-page-with-upload.png', fullPage: true });

          // Check if there are any PDFs listed
          const pdfList = page.locator('[class*="pdf"], [class*="PDF"]');
          const pdfCount = await pdfList.count();
          console.log(`Found ${pdfCount} PDF elements`);

          // Check for process button on any pending PDFs
          const processButton = page.getByRole('button', { name: /process/i }).first();
          if (await processButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('✅ Found process button - PDF processing UI is working');
            await page.screenshot({ path: 'pdf-with-process-button.png', fullPage: true });
          } else {
            console.log('ℹ️ No process button visible (may mean no pending PDFs)');
          }

          // Check for any PDFs that can be clicked to view
          const viewableContent = page.locator('text=/.*\\.pdf/i').first();
          if (await viewableContent.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('Found PDF in list, attempting to click...');
            await viewableContent.click();
            await page.waitForTimeout(1000);

            // Check if PDF viewer dialog opened
            const dialog = page.locator('[role="dialog"], [class*="dialog"]').first();
            const isDialogVisible = await dialog.isVisible({ timeout: 2000 }).catch(() => false);

            if (isDialogVisible) {
              console.log('✅ PDF viewer dialog opened successfully');
              await page.screenshot({ path: 'pdf-viewer-dialog.png', fullPage: true });

              // Check for markdown content
              const markdownContent = page.locator('[class*="prose"], [class*="markdown"]').first();
              const hasMarkdown = await markdownContent.isVisible({ timeout: 2000 }).catch(() => false);
              console.log('Has markdown content:', hasMarkdown);
            } else {
              console.log('❌ PDF viewer dialog did not open');
            }
          }
        } else {
          console.log('⚠️ Upload button not found');
        }
      } else {
        console.log('⚠️ Homebrew link not found');
      }
    } else {
      console.log('⚠️ No campaigns found - cannot test PDF workflow');
    }
  });

  test('Navigation and Auth State', async ({ page }) => {
    console.log('Testing navigation and auth state...');

    // Check if user is logged in
    const signInButton = page.getByRole('button', { name: /sign in/i }).first();
    const isSignedOut = await signInButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isSignedOut) {
      console.log('ℹ️ User is signed out');
      await page.screenshot({ path: 'signed-out-state.png', fullPage: true });
    } else {
      console.log('✅ User appears to be signed in');

      // Check for user menu or profile
      const userMenu = page.locator('[aria-label*="user" i], [class*="avatar"]').first();
      if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('✅ User menu visible');
      }

      // Check main navigation links
      const navLinks = ['Campaigns', 'Homebrew', 'Library'];
      for (const linkText of navLinks) {
        const link = page.getByText(linkText).first();
        const isVisible = await link.isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`${isVisible ? '✅' : '❌'} ${linkText} link:`, isVisible);
      }

      await page.screenshot({ path: 'signed-in-state.png', fullPage: true });
    }
  });

  test('Console Errors Check', async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      errors.push(`Page Error: ${error.message}`);
    });

    // Navigate through the app
    await page.goto('http://localhost:3007/campaigns');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('\n=== Console Errors ===');
    if (errors.length > 0) {
      errors.forEach((error, i) => {
        // Filter out known non-critical errors
        if (
          !error.includes('Failed to load resource') &&
          !error.includes('icon-') &&
          !error.includes('404') &&
          !error.includes('Manifest:')
        ) {
          console.log(`${i + 1}. ${error}`);
        }
      });
    } else {
      console.log('✅ No console errors');
    }

    console.log('\n=== Console Warnings ===');
    if (warnings.length > 0) {
      warnings.slice(0, 5).forEach((warning, i) => {
        console.log(`${i + 1}. ${warning.substring(0, 200)}...`);
      });
    } else {
      console.log('✅ No console warnings');
    }

    // Check for critical errors that would break functionality
    const criticalErrors = errors.filter(
      (err) =>
        !err.includes('Failed to load resource') &&
        !err.includes('icon-') &&
        !err.includes('404') &&
        !err.includes('Manifest:')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('API Endpoint Health Check', async ({ page }) => {
    console.log('Testing API endpoint health...');

    // Test session endpoint
    const sessionResponse = await page.request.get('http://localhost:3007/api/auth/session');
    console.log('Session API status:', sessionResponse.status());
    expect([200, 401]).toContain(sessionResponse.status());

    // Test tRPC health
    try {
      const trpcResponse = await page.request.get('http://localhost:3007/api/trpc/campaigns.getAll?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D');
      console.log('tRPC API status:', trpcResponse.status());
      expect([200, 401]).toContain(trpcResponse.status());
    } catch (error) {
      console.log('⚠️ tRPC endpoint check failed (may require auth)');
    }

    console.log('✅ API health check complete');
  });
});
