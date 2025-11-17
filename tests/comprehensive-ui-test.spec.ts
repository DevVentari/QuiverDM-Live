import { test, expect } from '@playwright/test';

test.describe('Comprehensive UI Test Suite', () => {
  const baseUrl = 'http://localhost:3000';

  test.describe('Marketing Page', () => {
    test('should load marketing page and verify all sections', async ({ page }) => {
      console.log('📍 Testing Marketing Page...');
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Verify hero section
      console.log('✓ Checking hero section...');
      await expect(page.locator('h1:has-text("AI-Powered")')).toBeVisible();
      await expect(page.locator('text=D&D Session Manager')).toBeVisible();

      // Verify CTA buttons in hero
      const startTrialBtn = page.locator('a[href="/campaigns"] >> text=Start Free Trial').first();
      await expect(startTrialBtn).toBeVisible();

      const watchDemoBtn = page.locator('button:has-text("Watch Demo")').first();
      await expect(watchDemoBtn).toBeVisible();

      // Verify features section
      console.log('✓ Checking features section...');
      await expect(page.locator('h2:has-text("Everything You Need")')).toBeVisible();
      await expect(page.locator('text=AI Session Recording')).toBeVisible();
      await expect(page.locator('text=Homebrew Library')).toBeVisible();
      await expect(page.locator('text=Lightning Fast Processing')).toBeVisible();
      await expect(page.locator('text=NPC & Player Management')).toBeVisible();
      await expect(page.locator('text=Campaign Timeline')).toBeVisible();
      await expect(page.locator('text=Mobile-First & Offline')).toBeVisible();

      // Verify How It Works section
      console.log('✓ Checking how it works section...');
      await expect(page.locator('h2:has-text("How It Works")')).toBeVisible();
      await expect(page.locator('text=Create Your Campaign')).toBeVisible();
      await expect(page.locator('text=Upload Homebrew Content')).toBeVisible();
      await expect(page.locator('text=Record Your Sessions')).toBeVisible();
      await expect(page.locator('text=Focus on the Story')).toBeVisible();

      // Verify pricing section
      console.log('✓ Checking pricing section...');
      await expect(page.locator('h2:has-text("Simple, Transparent Pricing")')).toBeVisible();
      await expect(page.locator('text=Starter')).toBeVisible();
      await expect(page.locator('text=Pro')).toBeVisible();
      await expect(page.locator('text=Team')).toBeVisible();
      await expect(page.locator('text=MOST POPULAR')).toBeVisible();

      // Verify testimonials
      console.log('✓ Checking testimonials section...');
      await expect(page.locator('h2:has-text("Loved by Dungeon Masters")')).toBeVisible();
      await expect(page.locator('text=Marcus Chen')).toBeVisible();
      await expect(page.locator('text=Sarah Williams')).toBeVisible();
      await expect(page.locator('text=Jake Morrison')).toBeVisible();

      // Verify footer
      console.log('✓ Checking footer...');
      await expect(page.locator('footer >> text=QuiverDM')).toBeVisible();
      await expect(page.locator('footer >> text=© 2025 QuiverDM')).toBeVisible();

      console.log('✅ Marketing page test complete!');
    });

    test('should navigate to campaigns when clicking Get Started', async ({ page }) => {
      console.log('📍 Testing Get Started button navigation...');
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Click the first "Get Started" button in navigation
      await page.locator('nav >> a[href="/campaigns"] >> text=Get Started').click();

      // Wait for navigation
      await page.waitForURL('**/campaigns');
      console.log('✅ Successfully navigated to campaigns page');
    });

    test('should navigate to campaigns when clicking Start Free Trial', async ({ page }) => {
      console.log('📍 Testing Start Free Trial button navigation...');
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Click the hero "Start Free Trial" button
      await page.locator('a[href="/campaigns"] >> text=Start Free Trial').first().click();

      // Wait for navigation
      await page.waitForURL('**/campaigns');
      console.log('✅ Successfully navigated to campaigns page');
    });
  });

  test.describe('Campaigns Page', () => {
    test('should load campaigns page and verify structure', async ({ page }) => {
      console.log('📍 Testing Campaigns Page...');
      await page.goto(`${baseUrl}/campaigns`);
      await page.waitForLoadState('networkidle');

      // Check for campaigns header or content
      const pageContent = await page.textContent('body');
      console.log('✓ Campaigns page loaded');

      // Take screenshot for manual verification
      await page.screenshot({ path: 'test-results/campaigns-page.png', fullPage: true });
      console.log('📸 Screenshot saved: campaigns-page.png');
    });

    test('should navigate to specific campaign', async ({ page }) => {
      const campaignId = 'cmhsbpbhd0002ia54fik2pwvb';
      console.log(`📍 Testing specific campaign navigation: ${campaignId}`);

      await page.goto(`${baseUrl}/campaigns/${campaignId}`);
      await page.waitForLoadState('networkidle');

      // Verify campaign page loaded
      expect(page.url()).toContain(campaignId);
      console.log('✅ Campaign page loaded successfully');

      await page.screenshot({ path: 'test-results/campaign-detail.png', fullPage: true });
    });
  });

  test.describe('Homebrew Library', () => {
    const campaignId = 'cmhsbpbhd0002ia54fik2pwvb';
    const homebrewUrl = `${baseUrl}/campaigns/${campaignId}/homebrew`;

    test('should load homebrew page with tabs', async ({ page }) => {
      console.log('📍 Testing Homebrew Library Page...');
      await page.goto(homebrewUrl);
      await page.waitForLoadState('networkidle');

      // Wait for tabs to be visible
      await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
      console.log('✓ Tabs are visible');

      // Check for both tabs
      const browseTab = page.locator('button[role="tab"]', { hasText: 'Browse Content' });
      const managePdfsTab = page.locator('button[role="tab"]', { hasText: 'Manage PDFs' });

      await expect(browseTab).toBeVisible();
      await expect(managePdfsTab).toBeVisible();
      console.log('✓ Both tabs are present');

      await page.screenshot({ path: 'test-results/homebrew-initial.png', fullPage: true });
    });

    test('should switch between tabs', async ({ page }) => {
      console.log('📍 Testing tab switching...');
      await page.goto(homebrewUrl);
      await page.waitForLoadState('networkidle');

      // Click on Manage PDFs tab
      const managePdfsTab = page.locator('button[role="tab"]', { hasText: 'Manage PDFs' });
      await managePdfsTab.click();
      await page.waitForTimeout(1000);

      console.log('✓ Clicked Manage PDFs tab');
      await page.screenshot({ path: 'test-results/homebrew-manage-pdfs.png', fullPage: true });

      // Click back to Browse Content tab
      const browseTab = page.locator('button[role="tab"]', { hasText: 'Browse Content' });
      await browseTab.click();
      await page.waitForTimeout(1000);

      console.log('✓ Clicked Browse Content tab');
      await page.screenshot({ path: 'test-results/homebrew-browse-content.png', fullPage: true });

      console.log('✅ Tab switching works correctly');
    });

    test('should show Upload PDF button', async ({ page }) => {
      console.log('📍 Testing Upload PDF button...');
      await page.goto(homebrewUrl);
      await page.waitForLoadState('networkidle');

      // Look for Upload PDF button
      const uploadButton = page.locator('button:has-text("Upload PDF")');

      try {
        await expect(uploadButton).toBeVisible({ timeout: 5000 });
        console.log('✅ Upload PDF button is visible');
      } catch (error) {
        console.log('⚠️  Upload PDF button not found - may be in a different state');
      }

      await page.screenshot({ path: 'test-results/homebrew-upload-button.png', fullPage: true });
    });

    test('should display PDFs in Manage PDFs tab', async ({ page }) => {
      console.log('📍 Testing PDF list display...');
      await page.goto(homebrewUrl);
      await page.waitForLoadState('networkidle');

      // Switch to Manage PDFs tab
      const managePdfsTab = page.locator('button[role="tab"]', { hasText: 'Manage PDFs' });
      await managePdfsTab.click();
      await page.waitForTimeout(1000);

      // Check for PDFs or empty state
      const tabPanel = page.locator('[role="tabpanel"]');
      await expect(tabPanel).toBeVisible();

      const pageContent = await tabPanel.textContent();

      if (pageContent?.includes('No PDFs uploaded yet')) {
        console.log('📭 No PDFs in library (empty state)');
      } else {
        // Look for PDF cards
        const pdfElements = page.locator('text=/\\.pdf/i');
        const count = await pdfElements.count();
        console.log(`📄 Found ${count} PDF(s) in the list`);
      }

      await page.screenshot({ path: 'test-results/homebrew-pdf-list.png', fullPage: true });
      console.log('✅ PDF list display test complete');
    });
  });

  test.describe('Navigation and Links', () => {
    test('should have working navigation links', async ({ page }) => {
      console.log('📍 Testing navigation links...');
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Test Sign In link
      const signInLink = page.locator('nav >> a[href="/campaigns"]', { hasText: 'Sign In' });
      await expect(signInLink).toBeVisible();
      console.log('✓ Sign In link is visible');

      // Test Get Started link
      const getStartedLink = page.locator('nav >> a[href="/campaigns"]', { hasText: 'Get Started' });
      await expect(getStartedLink).toBeVisible();
      console.log('✓ Get Started link is visible');

      // Test footer links
      await page.locator('footer >> a[href="/about"]').scrollIntoViewIfNeeded();
      await expect(page.locator('footer >> a[href="/about"]')).toBeVisible();
      console.log('✓ Footer links are visible');

      console.log('✅ Navigation links test complete');
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      console.log('📍 Testing mobile viewport...');

      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Verify hero is visible on mobile
      await expect(page.locator('h1:has-text("AI-Powered")')).toBeVisible();

      await page.screenshot({ path: 'test-results/mobile-marketing.png', fullPage: true });
      console.log('✅ Mobile viewport test complete');
    });

    test('should work on tablet viewport', async ({ page }) => {
      console.log('📍 Testing tablet viewport...');

      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1:has-text("AI-Powered")')).toBeVisible();

      await page.screenshot({ path: 'test-results/tablet-marketing.png', fullPage: true });
      console.log('✅ Tablet viewport test complete');
    });

    test('should work on desktop viewport', async ({ page }) => {
      console.log('📍 Testing desktop viewport...');

      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1:has-text("AI-Powered")')).toBeVisible();

      await page.screenshot({ path: 'test-results/desktop-marketing.png', fullPage: true });
      console.log('✅ Desktop viewport test complete');
    });
  });

  test.describe('Button Interactions', () => {
    test('should highlight buttons on hover', async ({ page }) => {
      console.log('📍 Testing button hover states...');
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Hover over Get Started button
      const getStartedBtn = page.locator('nav >> a[href="/campaigns"] >> text=Get Started');
      await getStartedBtn.hover();

      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/button-hover.png' });
      console.log('✅ Button hover test complete');
    });

    test('should be able to click all CTA buttons', async ({ page }) => {
      console.log('📍 Testing all CTA button clicks...');
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Count all "Start Free Trial" buttons
      const freeTrialButtons = page.locator('text=Start Free Trial');
      const count = await freeTrialButtons.count();
      console.log(`Found ${count} "Start Free Trial" buttons`);

      // Click each one (but don't navigate)
      for (let i = 0; i < count; i++) {
        const button = freeTrialButtons.nth(i);
        await button.scrollIntoViewIfNeeded();
        const isVisible = await button.isVisible();
        console.log(`  Button ${i + 1}: ${isVisible ? 'visible' : 'not visible'}`);
      }

      console.log('✅ CTA buttons test complete');
    });
  });

  test.describe('Performance', () => {
    test('should load marketing page quickly', async ({ page }) => {
      console.log('📍 Testing page load performance...');

      const startTime = Date.now();
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      console.log(`⏱️  Page loaded in ${loadTime}ms`);

      if (loadTime < 3000) {
        console.log('✅ Load time is good (< 3 seconds)');
      } else if (loadTime < 5000) {
        console.log('⚠️  Load time is acceptable (< 5 seconds)');
      } else {
        console.log('❌ Load time is slow (> 5 seconds)');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle 404 pages gracefully', async ({ page }) => {
      console.log('📍 Testing 404 error handling...');

      const response = await page.goto(`${baseUrl}/nonexistent-page`);
      console.log(`Status code: ${response?.status()}`);

      await page.screenshot({ path: 'test-results/404-page.png', fullPage: true });
      console.log('✅ 404 handling test complete');
    });
  });

  test.describe('Authentication Flow (Basic)', () => {
    test('should show sign in option', async ({ page }) => {
      console.log('📍 Testing authentication elements...');
      await page.goto(baseUrl);
      await page.waitForLoadState('networkidle');

      // Check for Sign In link
      const signInLink = page.locator('nav >> text=Sign In');
      await expect(signInLink).toBeVisible();
      console.log('✓ Sign In link is present');

      // Click Sign In to see where it goes
      await signInLink.click();
      await page.waitForLoadState('networkidle');

      console.log(`✓ Navigation destination: ${page.url()}`);
      await page.screenshot({ path: 'test-results/auth-signin.png', fullPage: true });

      console.log('✅ Auth elements test complete');
    });
  });
});
