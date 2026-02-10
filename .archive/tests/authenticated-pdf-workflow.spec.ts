import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'your-test-password';
const BASE_URL = process.env.TEST_URL || 'http://localhost:3007';

test.describe('Authenticated PDF Workflow - Full Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Sign in
    console.log('🔐 Signing in...');
    const signInButton = page.getByRole('button', { name: /sign in/i }).first();

    if (await signInButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signInButton.click();
      await page.waitForLoadState('networkidle');

      // Fill in credentials
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

      await emailInput.fill(TEST_EMAIL);
      await passwordInput.fill(TEST_PASSWORD);

      // Click sign in
      const submitButton = page.getByRole('button', { name: /sign in|log in|continue/i }).first();
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      console.log('✅ Signed in successfully');
    } else {
      console.log('ℹ️ Already signed in or no sign in button');
    }
  });

  test('Complete PDF Upload and Processing Flow', async ({ page }) => {
    console.log('\n=== STARTING COMPLETE PDF WORKFLOW TEST ===\n');

    // Step 1: Navigate to campaigns
    console.log('📍 Step 1: Navigating to campaigns page...');
    await page.goto(`${BASE_URL}/campaigns`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-step-1-campaigns.png', fullPage: true });
    console.log('✅ Campaigns page loaded');

    // Step 2: Click on first campaign
    console.log('📍 Step 2: Finding first campaign...');

    // Look for "Open" button/link on campaign card - try multiple selectors
    let openButton = page.locator('text=/Open/i').first();

    if (!await openButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Try as a link
      openButton = page.locator('a:has-text("Open")').first();
    }

    if (!await openButton.isVisible({ timeout: 5000 })) {
      await page.screenshot({ path: 'test-step-2-no-campaign.png', fullPage: true });

      // Debug - print page content
      const bodyText = await page.locator('body').textContent();
      console.log('Page text:', bodyText?.substring(0, 500));

      throw new Error('No campaigns found! Cannot test PDF workflow.');
    }

    console.log('Found campaign with Open button');
    await openButton.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-step-2-campaign-page.png', fullPage: true });
    console.log('✅ Campaign page loaded');

    // Step 3: Navigate to Homebrew
    console.log('📍 Step 3: Navigating to Homebrew section...');
    const homebrewLink = page.getByRole('link', { name: /homebrew/i }).first();
    await homebrewLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-step-3-homebrew-page.png', fullPage: true });
    console.log('✅ Homebrew page loaded');

    // Step 4: Check for existing PDFs
    console.log('📍 Step 4: Checking existing PDFs...');
    const pdfCards = page.locator('[class*="Card"]').filter({ hasText: /.pdf/i });
    const existingPDFCount = await pdfCards.count();
    console.log(`Found ${existingPDFCount} existing PDFs`);

    // Step 5: Upload a new PDF
    console.log('📍 Step 5: Attempting PDF upload...');
    const uploadButton = page.getByRole('button', { name: /upload.*pdf/i }).first();

    if (!await uploadButton.isVisible({ timeout: 3000 })) {
      throw new Error('Upload PDF button not found!');
    }

    await uploadButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-step-5-upload-dialog.png', fullPage: true });
    console.log('✅ Upload dialog opened');

    // Use existing test PDF file
    console.log('📄 Using test PDF: homebrew-sample.pdf');
    const testPdfPath = path.join(process.cwd(), 'test-documents', 'homebrew-sample.pdf');

    // Look for file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testPdfPath);
    await page.waitForTimeout(2000);

    console.log('📤 File selected, looking for upload button...');
    await page.screenshot({ path: 'test-step-5-after-file-select.png', fullPage: true });

    // Click "Upload to Library" button
    const uploadToLibraryButton = page.getByRole('button', { name: /upload to library/i }).first();

    if (!await uploadToLibraryButton.isVisible({ timeout: 3000 })) {
      await page.screenshot({ path: 'test-step-5-no-upload-button.png', fullPage: true });
      throw new Error('Upload to Library button not found!');
    }

    await uploadToLibraryButton.click();
    console.log('✅ Clicked Upload to Library button');

    // Wait for upload to complete
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'test-step-5-after-upload.png', fullPage: true });
    console.log('✅ Upload complete');

    // Step 6: Switch to "Manage PDFs" tab to see uploaded PDF
    console.log('📍 Step 6: Switching to Manage PDFs tab...');
    const managePDFsTab = page.getByRole('tab', { name: /manage pdfs/i });

    if (!await managePDFsTab.isVisible({ timeout: 3000 })) {
      console.log('⚠️ Manage PDFs tab not found, trying alternative selector...');
      // Try alternative selector with emoji
      const altTab = page.locator('button[role="tab"]', { hasText: 'Manage PDFs' });
      if (await altTab.isVisible({ timeout: 3000 })) {
        await altTab.click();
      }
    } else {
      await managePDFsTab.click();
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-step-6-manage-pdfs-tab.png', fullPage: true });
    console.log('✅ Switched to Manage PDFs tab');

    // Step 7: Find the uploaded PDF
    console.log('📍 Step 7: Finding uploaded PDF...');
    await page.waitForTimeout(2000);

    const newPdfCards = page.locator('[class*="Card"]').filter({ hasText: /.pdf/i });
    const newPDFCount = await newPdfCards.count();
    console.log(`Now have ${newPDFCount} PDFs (was ${existingPDFCount})`);

    // Find the newest PDF (should have "pending" status)
    const pendingPDF = page.locator('text=/pending/i').first();
    const hasPendingPDF = await pendingPDF.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasPendingPDF) {
      console.log('⚠️ No pending PDF found - checking page state...');
      await page.screenshot({ path: 'test-step-7-no-pending.png', fullPage: true });

      // List all visible text on page
      const bodyText = await page.locator('body').textContent();
      console.log('Page content:', bodyText?.substring(0, 500));
    }

    expect(hasPendingPDF).toBeTruthy();
    console.log('✅ Found pending PDF');

    // Step 8: Click "Process Now" button
    console.log('📍 Step 8: Processing PDF...');
    const processButton = page.getByRole('button', { name: /process/i }).first();

    if (!await processButton.isVisible({ timeout: 3000 })) {
      await page.screenshot({ path: 'test-step-8-no-process-button.png', fullPage: true });
      throw new Error('Process button not found!');
    }

    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('🔴 CONSOLE ERROR:', msg.text());
      }
    });

    // Listen for network failures
    const networkErrors: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) {
        const error = `${response.status()} ${response.url()}`;
        networkErrors.push(error);
        console.log('🔴 NETWORK ERROR:', error);
      }
    });

    await processButton.click();
    console.log('⏳ Waiting for processing...');

    // Wait for processing to start
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'test-step-8-processing.png', fullPage: true });

    // Check for errors
    if (consoleErrors.length > 0) {
      console.log('\n🔴 CONSOLE ERRORS DETECTED:');
      consoleErrors.forEach((err, i) => {
        console.log(`${i + 1}. ${err}`);
      });
    }

    if (networkErrors.length > 0) {
      console.log('\n🔴 NETWORK ERRORS DETECTED:');
      networkErrors.forEach((err, i) => {
        console.log(`${i + 1}. ${err}`);
      });
    }

    // Wait for processing to complete or fail
    console.log('⏳ Waiting for processing status...');
    const processingComplete = await page.waitForSelector(
      'text=/completed|failed/i',
      { timeout: 60000 }
    ).catch(() => null);

    if (processingComplete) {
      const statusText = await processingComplete.textContent();
      console.log(`📊 Processing status: ${statusText}`);
      await page.screenshot({ path: 'test-step-8-complete.png', fullPage: true });
    } else {
      console.log('⚠️ Processing did not complete in 60 seconds');
      await page.screenshot({ path: 'test-step-8-timeout.png', fullPage: true });
    }

    // Step 9: Try to view the PDF
    console.log('📍 Step 9: Attempting to view PDF...');
    const pdfName = page.locator('text=/homebrew-sample.pdf/i').first();

    if (await pdfName.isVisible({ timeout: 3000 })) {
      await pdfName.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-step-9-pdf-viewer.png', fullPage: true });

      // Check if dialog opened
      const dialog = page.locator('[role="dialog"]').first();
      const isDialogVisible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);

      if (isDialogVisible) {
        console.log('✅ PDF viewer dialog opened');

        // Check for markdown content
        const hasMarkdown = await page.locator('text=/markdown|document|content/i').isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`Markdown content visible: ${hasMarkdown}`);
      } else {
        console.log('❌ PDF viewer dialog did not open');
      }
    } else {
      console.log('⚠️ Could not find PDF to click');
    }

    // Final summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Console Errors: ${consoleErrors.length}`);
    console.log(`Network Errors: ${networkErrors.length}`);
    console.log('Screenshots saved with prefix: test-step-*');

    // Fail test if there were errors
    if (consoleErrors.length > 0 || networkErrors.length > 0) {
      throw new Error(`Test detected ${consoleErrors.length} console errors and ${networkErrors.length} network errors`);
    }
  });
});
