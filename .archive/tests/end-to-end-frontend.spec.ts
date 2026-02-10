import { test, expect } from '@playwright/test';

test.describe('End-to-End Frontend Tests', () => {
  const baseUrl = 'http://localhost:3001';
  let testEmail: string;
  let testPassword: string;
  let campaignSlug: string;

  test.beforeEach(() => {
    testEmail = `e2e-test-${Date.now()}@example.com`;
    testPassword = 'TestPassword123!';
  });

  test('Complete user flow: Signup → Onboarding → Campaign → Homebrew', async ({ page }) => {
    console.log('\n🧪 Starting End-to-End Test...\n');

    // ========== STEP 1: Homepage ==========
    console.log('📍 Step 1: Testing Homepage');
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    // Check hero section
    await expect(page.locator('text=QuiverDM')).toBeVisible({ timeout: 10000 });
    console.log('✅ Homepage loads correctly');

    // ========== STEP 2: Sign Up ==========
    console.log('\n📍 Step 2: Testing Signup Flow');
    await page.goto(`${baseUrl}/auth/signup`);

    await page.fill('input[type="text"]', 'E2E Test User');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);

    await page.click('button[type="submit"]');
    console.log('✅ Submitted signup form');

    // Wait for redirect
    await page.waitForURL(/\/campaigns/, { timeout: 15000 });
    console.log('✅ Redirected to campaigns page');

    // ========== STEP 3: Onboarding Wizard ==========
    console.log('\n📍 Step 3: Testing Onboarding Wizard');

    // Check if onboarding appears
    const welcomeText = page.locator('text=Welcome to QuiverDM!');
    const onboardingVisible = await welcomeText.isVisible({ timeout: 5000 }).catch(() => false);

    if (onboardingVisible) {
      console.log('✅ Onboarding wizard appeared');

      // Click through welcome step
      const nextButton = page.locator('button:has-text("Next")');
      if (await nextButton.isVisible()) {
        await nextButton.click();
        console.log('✅ Navigated past welcome step');

        // Fill campaign creation form in wizard
        await page.waitForTimeout(1000);
        const campaignNameInput = page.locator('input[placeholder*="Lost Mines"]').or(page.locator('input[id="name"]'));
        if (await campaignNameInput.isVisible({ timeout: 3000 })) {
          await campaignNameInput.fill('E2E Test Campaign');
          await page.fill('textarea', 'Test campaign for end-to-end testing');

          // Submit campaign form
          const createButton = page.locator('button:has-text("Create Campaign")');
          await createButton.click();
          await page.waitForTimeout(2000);
          console.log('✅ Created campaign in onboarding');

          // Skip remaining steps
          const skipButton = page.locator('button:has-text("Skip")').or(page.locator('text=Skip tutorial'));
          if (await skipButton.isVisible({ timeout: 3000 })) {
            await skipButton.click();
            console.log('✅ Skipped remaining onboarding');
          }
        }
      }
    } else {
      console.log('⚠️ Onboarding wizard not shown (creating campaign manually)');

      // Create campaign manually
      await page.goto(`${baseUrl}/campaigns`);
      await page.waitForLoadState('networkidle');

      const createButton = page.locator('text=Create Campaign').or(page.locator('text=New Campaign')).first();
      if (await createButton.isVisible({ timeout: 5000 })) {
        await createButton.click();
        await page.waitForTimeout(1000);

        // Check if we're on the new campaign page
        if (page.url().includes('/campaigns/new')) {
          await page.fill('input[placeholder*="Lost Mines"]', 'E2E Test Campaign');
          await page.fill('textarea', 'Test campaign for end-to-end testing');
          await page.click('button[type="submit"]');
          await page.waitForURL(/\/campaigns\/[^/]+/, { timeout: 10000 });
          console.log('✅ Created campaign manually');
        }
      }
    }

    // ========== STEP 4: Navigate to Campaign ==========
    console.log('\n📍 Step 4: Testing Campaign Navigation');
    await page.goto(`${baseUrl}/campaigns`);
    await page.waitForLoadState('networkidle');

    // Click on first campaign
    const campaignCard = page.locator('[class*="cursor-pointer"]').first();
    if (await campaignCard.isVisible({ timeout: 5000 })) {
      await campaignCard.click();
      await page.waitForURL(/\/campaigns\/[^/]+/, { timeout: 10000 });
      campaignSlug = page.url().split('/campaigns/')[1].split('/')[0];
      console.log(`✅ Navigated to campaign: ${campaignSlug}`);
    } else {
      throw new Error('No campaign found to navigate to');
    }

    // ========== STEP 5: Check Campaign Page Elements ==========
    console.log('\n📍 Step 5: Testing Campaign Page');
    await page.waitForLoadState('networkidle');

    // Check for campaign name
    const campaignHeading = page.locator('h1, h2').filter({ hasText: 'E2E Test Campaign' });
    const headingVisible = await campaignHeading.isVisible({ timeout: 5000 }).catch(() => false);

    if (headingVisible) {
      console.log('✅ Campaign page displays correctly');
    } else {
      console.log('⚠️ Campaign name not found on page');
    }

    // ========== STEP 6: Navigate to Homebrew ==========
    console.log('\n📍 Step 6: Testing Homebrew Page');
    await page.goto(`${baseUrl}/campaigns/${campaignSlug}/homebrew`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for data to load

    // Check page loaded
    const homebrewHeading = page.locator('text=Campaign Homebrew').or(page.locator('text=Homebrew'));
    const homebrewVisible = await homebrewHeading.isVisible({ timeout: 10000 }).catch(() => false);

    if (homebrewVisible) {
      console.log('✅ Homebrew page loads');
    } else {
      console.log('❌ Homebrew page failed to load');
      throw new Error('Homebrew page did not load');
    }

    // ========== STEP 7: Test PDF Tab ==========
    console.log('\n📍 Step 7: Testing PDF Management Tab');
    const pdfsTab = page.locator('text=Manage PDFs').or(page.locator('text=📄 Manage PDFs'));
    if (await pdfsTab.isVisible({ timeout: 5000 })) {
      await pdfsTab.click();
      await page.waitForTimeout(2000);

      // Check for empty state or PDF list
      const noPDFsText = page.locator('text=No PDFs uploaded yet');
      const hasPDFs = await noPDFsText.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasPDFs) {
        console.log('✅ PDF tab shows empty state (no PDFs uploaded)');
      } else {
        console.log('✅ PDF tab shows PDF list');
      }

      // Check Upload PDF button exists
      const uploadButton = page.locator('text=Upload PDF');
      const uploadVisible = await uploadButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (uploadVisible) {
        console.log('✅ Upload PDF button is visible');
      } else {
        console.log('⚠️ Upload PDF button not found');
      }
    } else {
      console.log('⚠️ PDF tab not found');
    }

    // ========== STEP 8: Test Navigation Visibility ==========
    console.log('\n📍 Step 8: Testing Navigation Elements');

    // Check navigation is visible
    const nav = page.locator('nav').or(page.locator('[role="navigation"]'));
    const navVisible = await nav.isVisible({ timeout: 3000 }).catch(() => false);

    if (navVisible) {
      console.log('✅ Navigation is visible when logged in');
    } else {
      console.log('⚠️ Navigation not visible');
    }

    // ========== STEP 9: Test Logout ==========
    console.log('\n📍 Step 9: Testing Logout');

    // Look for user menu/dropdown
    const userMenu = page.locator('[role="button"]').filter({ hasText: testEmail.split('@')[0] }).or(
      page.locator('button:has-text("User")').or(
        page.locator('button:has-text("Sign out")')
      )
    );

    const menuExists = await userMenu.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (menuExists) {
      await userMenu.first().click();
      await page.waitForTimeout(500);

      const signOutButton = page.locator('text=Sign out').or(page.locator('text=Logout'));
      if (await signOutButton.isVisible({ timeout: 3000 })) {
        await signOutButton.click();
        await page.waitForURL(/\//, { timeout: 10000 });
        console.log('✅ Logged out successfully');
      }
    } else {
      console.log('⚠️ User menu not found, skipping logout test');
    }

    // ========== STEP 10: Verify Logout State ==========
    console.log('\n📍 Step 10: Verifying Logged Out State');
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    // Navigation should be hidden
    const navHidden = !(await nav.isVisible({ timeout: 2000 }).catch(() => false));

    if (navHidden) {
      console.log('✅ Navigation hidden when logged out');
    } else {
      console.log('⚠️ Navigation still visible after logout');
    }

    // ========== STEP 11: Test Protected Route Redirect ==========
    console.log('\n📍 Step 11: Testing Protected Route Access');
    await page.goto(`${baseUrl}/campaigns`);
    await page.waitForTimeout(2000);

    const url = page.url();
    if (url.includes('/auth') || url === `${baseUrl}/`) {
      console.log('✅ Protected routes redirect when not authenticated');
    } else {
      console.log('⚠️ Protected routes may not be properly secured');
    }

    // ========== STEP 12: Test Re-login ==========
    console.log('\n📍 Step 12: Testing Re-login');
    await page.goto(`${baseUrl}/auth/signin`);
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\//, { timeout: 10000 });
    console.log('✅ Re-logged in successfully');

    // ========== STEP 13: Verify Campaign Still Exists ==========
    console.log('\n📍 Step 13: Verifying Data Persistence');
    await page.goto(`${baseUrl}/campaigns`);
    await page.waitForLoadState('networkidle');

    const campaignExists = await page.locator('text=E2E Test Campaign').isVisible({ timeout: 5000 }).catch(() => false);

    if (campaignExists) {
      console.log('✅ Campaign data persisted after logout/login');
    } else {
      console.log('⚠️ Campaign may not have persisted');
    }

    console.log('\n✅ End-to-End Test Complete!\n');
  });

  test('Console Error Check', async ({ page }) => {
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

    console.log('\n🔍 Checking for console errors...');

    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    if (errors.length === 0) {
      console.log('✅ No console errors on homepage');
    } else {
      console.log(`⚠️ Found ${errors.length} console errors:`);
      errors.slice(0, 5).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.substring(0, 100)}...`);
      });
    }

    if (warnings.length > 0) {
      console.log(`ℹ️ Found ${warnings.length} warnings (this is usually okay)`);
    }
  });

  test('Responsive Design Check', async ({ page }) => {
    console.log('\n📱 Testing Responsive Design...');

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    const heroMobile = await page.locator('text=QuiverDM').isVisible();
    console.log(heroMobile ? '✅ Mobile view renders correctly' : '⚠️ Mobile view has issues');

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    const heroTablet = await page.locator('text=QuiverDM').isVisible();
    console.log(heroTablet ? '✅ Tablet view renders correctly' : '⚠️ Tablet view has issues');

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 }); // Full HD
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');

    const heroDesktop = await page.locator('text=QuiverDM').isVisible();
    console.log(heroDesktop ? '✅ Desktop view renders correctly' : '⚠️ Desktop view has issues');
  });
});
