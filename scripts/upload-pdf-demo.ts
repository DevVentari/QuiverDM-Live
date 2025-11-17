/**
 * Interactive PDF Upload Demo
 * This script demonstrates the complete PDF upload and processing workflow
 */

import { chromium } from 'playwright';
import path from 'path';

async function main() {
  console.log('🚀 Starting PDF Upload Demo...\n');

  // Launch browser in headed mode so you can see it
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Navigate to signin page
    console.log('Step 1: Navigating to signin page...');
    await page.goto('http://localhost:3002/auth/signin');
    await page.waitForLoadState('networkidle');

    // Step 2: Login
    console.log('Step 2: Logging in...');
    await page.locator('input#email').fill('dev@blakewales.au');
    await page.locator('input#password').fill('xaub6NaM7468');

    // Click and wait for navigation
    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }),
      page.getByRole('button', { name: 'Sign in with Email' }).click(),
    ]);

    // Verify we're not still on signin page
    const currentUrl = page.url();
    console.log(`Current URL after login: ${currentUrl}`);

    if (currentUrl.includes('/auth/signin')) {
      console.log('❌ Login failed - still on signin page');
      await page.screenshot({ path: 'login-failed.png', fullPage: true });
      throw new Error('Login failed');
    }

    console.log('✅ Logged in successfully\n');

    // Step 3: Navigate to homebrew page
    console.log('Step 3: Navigating to Homebrew Library...');
    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('✅ Homebrew page loaded\n');

    // Step 4: Take screenshot of the page first
    console.log('Step 4: Taking screenshot of homebrew page...');
    await page.screenshot({ path: 'homebrew-page-before-tab.png', fullPage: true });
    console.log('📸 Screenshot saved: homebrew-page-before-tab.png\n');

    // Step 4b: Check what's on the page
    console.log('Step 4b: Checking page content...');
    const pageText = await page.textContent('body');
    console.log(`Page contains "PDF Library": ${pageText?.includes('PDF Library')}`);
    console.log(`Page contains "Homebrew Content": ${pageText?.includes('Homebrew Content')}`);

    // Look for all tabs
    const allTabs = await page.locator('[role="tab"]').count();
    console.log(`Total tabs found: ${allTabs}`);

    for (let i = 0; i < allTabs; i++) {
      const tabText = await page.locator('[role="tab"]').nth(i).textContent();
      console.log(`  Tab ${i}: "${tabText}"`);
    }

    // Step 4c: Click on "PDF Library" tab
    console.log('\nStep 4c: Attempting to click "PDF Library" tab...');
    const pdfLibraryTab = page.getByRole('tab', { name: /PDF Library/i });
    const isVisible = await pdfLibraryTab.isVisible().catch(() => false);

    console.log(`PDF Library tab visible: ${isVisible}`);

    if (isVisible) {
      await pdfLibraryTab.click();
      await page.waitForTimeout(1000);
      console.log('✅ PDF Library tab clicked\n');

      // Take a screenshot
      await page.screenshot({ path: 'pdf-library-tab.png', fullPage: true });
      console.log('📸 Screenshot saved: pdf-library-tab.png\n');
    } else {
      console.log('⚠️ PDF Library tab not found or not visible\n');
    }

    // Step 5: Look for file upload input
    console.log('Step 5: Looking for file upload input...');
    const fileInput = page.locator('input[type="file"]').first();
    const fileInputCount = await fileInput.count();
    console.log(`Found ${fileInputCount} file input(s)\n`);

    if (fileInputCount > 0) {
      // Step 6: Upload PDF
      console.log('Step 6: Uploading PDF...');
      const testPdfPath = path.resolve('test-documents/homebrew-sample.pdf');
      console.log(`PDF path: ${testPdfPath}`);

      await fileInput.setInputFiles(testPdfPath);
      console.log('✅ PDF file selected\n');

      // Wait for upload to start
      await page.waitForTimeout(3000);

      // Take screenshot after upload
      await page.screenshot({ path: 'pdf-after-upload.png', fullPage: true });
      console.log('📸 Screenshot saved: pdf-after-upload.png\n');

      // Step 7: Monitor processing
      console.log('Step 7: Monitoring processing status...');
      await page.waitForTimeout(5000);

      // Look for processing indicators
      const processingText = await page.locator('text=/processing|uploaded|completed/i').count();
      console.log(`Processing indicators found: ${processingText}\n`);

      // Take screenshot of processing
      await page.screenshot({ path: 'pdf-processing.png', fullPage: true });
      console.log('📸 Screenshot saved: pdf-processing.png\n');

      // Step 8: Wait a bit more and check for completion
      console.log('Step 8: Waiting for processing to complete...');
      await page.waitForTimeout(10000);

      await page.screenshot({ path: 'pdf-final-state.png', fullPage: true });
      console.log('📸 Screenshot saved: pdf-final-state.png\n');

      // Check if PDF appears in list
      const pdfItems = await page.locator('article, .card, [data-testid*="pdf"]').count();
      console.log(`PDF items in library: ${pdfItems}\n`);

      if (pdfItems > 0) {
        console.log('Step 9: Clicking on PDF to view details...');
        const firstPdf = page.locator('article, .card').first();
        await firstPdf.click();
        await page.waitForTimeout(2000);

        await page.screenshot({ path: 'pdf-details.png', fullPage: true });
        console.log('📸 Screenshot saved: pdf-details.png\n');

        console.log('✅ PDF details page loaded\n');
      }

    } else {
      console.log('❌ No file upload input found on PDF Library tab\n');
      console.log('This means the PDF upload component may not be implemented yet.\n');
    }

    console.log('\n🎉 Demo complete! Keeping browser open for 30 seconds so you can inspect...\n');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ Error during demo:', error);
    await page.screenshot({ path: 'pdf-error.png', fullPage: true });
    console.log('📸 Error screenshot saved: pdf-error.png\n');
  } finally {
    await browser.close();
    console.log('👋 Browser closed\n');
  }
}

main();
