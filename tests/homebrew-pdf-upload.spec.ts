import { test, expect } from '@playwright/test';
import path from 'path';

const SERVER_URL = 'http://localhost:3003';
const TEST_PDF = path.join(__dirname, '..', 'test-documents', 'homebrew-sample.pdf');

test.describe('Homebrew PDF Upload and Processing', () => {
  test.setTimeout(180000); // 3 minutes for the full workflow

  test('should upload PDF and process with AI extraction', async ({ page }) => {
    // Listen for console messages
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
      console.log(`Browser console:`, text);
    });

    // Listen for page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
      console.error('❌ Page error:', error);
    });

    // Listen for network responses
    page.on('response', async (response) => {
      if (response.url().includes('/api/homebrew')) {
        console.log(`📡 API Response: ${response.status()} - ${response.url()}`);
        if (response.status() >= 400) {
          const body = await response.text().catch(() => 'Could not read body');
          console.error(`❌ Error response body:`, body);
        }
      }
    });

    console.log('🌐 Step 1: Navigate to campaigns page');
    await page.goto(`${SERVER_URL}/campaigns`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/homebrew-01-campaigns.png', fullPage: true });

    console.log('🔍 Step 2: Find and click on a campaign');
    const campaignCard = page.locator('[class*="cursor-pointer"]').first();
    await expect(campaignCard).toBeVisible({ timeout: 10000 });
    await campaignCard.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/homebrew-02-campaign-detail.png', fullPage: true });

    console.log('📚 Step 3: Navigate to Homebrew tab');
    const homebrewTab = page.getByRole('link', { name: /^homebrew$/i });
    await expect(homebrewTab).toBeVisible();
    await homebrewTab.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/homebrew-03-homebrew-page.png', fullPage: true });

    console.log('📤 Step 4: Click Upload PDF button');
    const uploadButton = page.getByRole('button', { name: /upload pdf/i });
    await expect(uploadButton).toBeVisible();
    await uploadButton.click();

    // Wait for modal/dialog to appear
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/homebrew-04-upload-dialog.png', fullPage: true });

    console.log('📄 Step 5: Upload PDF file');
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached({ timeout: 5000 });

    // Check if test PDF exists
    console.log(`📁 Using test PDF: ${TEST_PDF}`);
    await fileInput.setInputFiles(TEST_PDF);

    // Wait for file to be selected
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/homebrew-05-file-selected.png', fullPage: true });

    console.log('🚀 Step 6: Click Upload & Process button');
    const processButton = page.getByRole('button', { name: /upload.*process/i });
    await expect(processButton).toBeVisible({ timeout: 5000 });
    await processButton.click();

    console.log('⏳ Step 7: Wait for upload to complete');
    // Wait for upload success (look for toast or success message)
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'test-results/homebrew-06-upload-complete.png', fullPage: true });

    console.log('🤖 Step 8: Wait for AI processing to start');
    // Wait for processing to start (modal should close and show progress)
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/homebrew-07-processing.png', fullPage: true });

    console.log('✅ Step 9: Verify no errors occurred');
    // Check for errors
    if (pageErrors.length > 0) {
      console.error('❌ Page errors detected:', pageErrors);
    }

    // Check console for upload/processing errors
    const hasUploadError = consoleMessages.some(msg =>
      msg.toLowerCase().includes('error') &&
      (msg.includes('upload') || msg.includes('process'))
    );

    if (hasUploadError) {
      console.error('❌ Upload/processing errors in console:', consoleMessages.filter(msg =>
        msg.toLowerCase().includes('error')
      ));
    }

    // Final screenshot
    await page.screenshot({ path: 'test-results/homebrew-08-final-state.png', fullPage: true });

    // Assertions
    expect(pageErrors.length).toBe(0);
    expect(hasUploadError).toBe(false);

    console.log('✅ Test completed successfully!');
    console.log('📸 Screenshots saved to test-results/');
  });

  test('should navigate to homebrew page and show Upload PDF button', async ({ page }) => {
    await page.goto(`${SERVER_URL}/campaigns`);
    await page.waitForLoadState('networkidle');

    const campaignCard = page.locator('[class*="cursor-pointer"]').first();
    const campaignExists = await campaignCard.isVisible().catch(() => false);

    if (campaignExists) {
      await campaignCard.click();
      await page.waitForLoadState('networkidle');

      // Navigate to homebrew
      await page.getByRole('link', { name: /^homebrew$/i }).click();

      // Check for Upload PDF button
      const uploadButton = page.getByRole('button', { name: /upload pdf/i });
      await expect(uploadButton).toBeVisible();

      console.log('✅ Upload PDF button is visible');
    }
  });
});
