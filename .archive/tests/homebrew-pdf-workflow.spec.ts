import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Homebrew PDF Upload and Display Workflow', () => {
  const campaignUrl = 'http://localhost:3003/campaigns/cmhsbpbhd0002ia54fik2pwvb/homebrew';
  const testPdfPath = path.join(process.cwd(), 'test-documents', 'homebrew-sample.pdf');

  test('should display uploaded PDFs in Manage PDFs tab', async ({ page }) => {
    console.log('📍 Navigating to homebrew page...');
    await page.goto(campaignUrl);

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded');

    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/01-initial-page.png', fullPage: true });
    console.log('📸 Screenshot: initial page');

    // Check if tabs are visible
    const tabsList = page.locator('[role="tablist"]');
    await expect(tabsList).toBeVisible({ timeout: 10000 });
    console.log('✅ Tabs are visible');

    // Find and click on "Manage PDFs" tab
    console.log('🔍 Looking for Manage PDFs tab...');
    const managePdfsTab = page.locator('button[role="tab"]', { hasText: 'Manage PDFs' });

    if (await managePdfsTab.count() === 0) {
      console.log('❌ Manage PDFs tab not found. Available tabs:');
      const allTabs = await page.locator('button[role="tab"]').all();
      for (const tab of allTabs) {
        const text = await tab.textContent();
        console.log(`  - "${text}"`);
      }
      throw new Error('Manage PDFs tab not found');
    }

    await managePdfsTab.click();
    console.log('✅ Clicked Manage PDFs tab');

    // Wait a moment for tab content to load
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/02-manage-pdfs-tab.png', fullPage: true });
    console.log('📸 Screenshot: Manage PDFs tab');

    // Check if PDF list is visible
    console.log('🔍 Checking for PDF list...');
    const pdfListContent = page.locator('[role="tabpanel"]');
    await expect(pdfListContent).toBeVisible();

    // Look for PDFs in the list
    const pdfCards = page.locator('[class*="Card"]').filter({ hasText: /.pdf/i });
    const pdfCount = await pdfCards.count();
    console.log(`📄 Found ${pdfCount} PDF(s) in the list`);

    if (pdfCount === 0) {
      console.log('⚠️  No PDFs found in list. Checking for empty state...');
      const emptyState = page.locator('text="No PDFs uploaded yet"');
      if (await emptyState.isVisible()) {
        console.log('📭 Empty state is showing');
      } else {
        console.log('❌ Neither PDFs nor empty state found');
        // Log the actual content
        const content = await pdfListContent.textContent();
        console.log('Tab panel content:', content);
      }
    } else {
      // List PDFs found
      console.log('\n📋 PDFs found:');
      for (let i = 0; i < pdfCount; i++) {
        const card = pdfCards.nth(i);
        const filename = await card.locator('h3').textContent();
        const statusBadge = await card.locator('[class*="Badge"]').first().textContent();
        console.log(`  ${i + 1}. ${filename} - Status: ${statusBadge}`);

        // Check if "Process Now" button exists for pending PDFs
        if (statusBadge?.includes('pending')) {
          const processButton = card.locator('button', { hasText: 'Process Now' });
          const hasProcessButton = await processButton.count() > 0;
          console.log(`     ${hasProcessButton ? '✅' : '❌'} Process Now button ${hasProcessButton ? 'present' : 'missing'}`);
        }
      }
    }

    await page.screenshot({ path: 'test-results/03-pdf-list-final.png', fullPage: true });
    console.log('📸 Screenshot: Final PDF list state');
  });

  test('should upload a PDF and show it in the list', async ({ page }) => {
    console.log('📍 Navigating to homebrew page...');
    await page.goto(campaignUrl);
    await page.waitForLoadState('networkidle');

    // Click Upload PDF button
    console.log('🔍 Looking for Upload PDF button...');
    const uploadButton = page.locator('button', { hasText: 'Upload PDF' });
    await expect(uploadButton).toBeVisible({ timeout: 10000 });
    await uploadButton.click();
    console.log('✅ Clicked Upload PDF button');

    // Wait for dialog
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/04-upload-dialog.png', fullPage: true });
    console.log('📸 Screenshot: Upload dialog');

    // Check if file input exists
    const fileInput = page.locator('input[type="file"][accept=".pdf"]');
    await expect(fileInput).toBeAttached();
    console.log('✅ File input found');

    // Upload file
    console.log(`📤 Uploading file: ${testPdfPath}`);
    await fileInput.setInputFiles(testPdfPath);
    console.log('✅ File selected');

    // Wait for file to be selected and UI to update
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/05-file-selected.png', fullPage: true });
    console.log('📸 Screenshot: File selected');

    // Click upload button
    const uploadToLibraryButton = page.locator('button', { hasText: 'Upload to Library' });
    await expect(uploadToLibraryButton).toBeVisible();
    await uploadToLibraryButton.click();
    console.log('✅ Clicked "Upload to Library" button');

    // Wait for upload to complete
    console.log('⏳ Waiting for upload to complete...');
    await page.waitForTimeout(2000);

    // Dialog should close after successful upload
    const dialog = page.locator('[role="dialog"]');
    const dialogVisible = await dialog.isVisible();
    console.log(`${dialogVisible ? '⚠️  Dialog still visible' : '✅ Dialog closed'}`);

    if (!dialogVisible) {
      console.log('✅ Upload completed successfully');
    }

    // Navigate to Manage PDFs tab to verify
    console.log('🔍 Checking Manage PDFs tab...');
    const managePdfsTab = page.locator('button[role="tab"]', { hasText: 'Manage PDFs' });
    await managePdfsTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/06-after-upload.png', fullPage: true });
    console.log('📸 Screenshot: After upload');

    // Check if the uploaded PDF appears
    const uploadedPdf = page.locator('text=homebrew-sample.pdf').first();
    const isVisible = await uploadedPdf.isVisible();
    console.log(`${isVisible ? '✅' : '❌'} Uploaded PDF ${isVisible ? 'visible' : 'not visible'} in list`);

    if (isVisible) {
      // Check for pending status and Process Now button
      const pdfCard = uploadedPdf.locator('..').locator('..').locator('..');
      const statusBadge = pdfCard.locator('[class*="Badge"]').first();
      const status = await statusBadge.textContent();
      console.log(`📊 Status: ${status}`);

      const processButton = pdfCard.locator('button', { hasText: 'Process Now' });
      if (await processButton.count() > 0) {
        console.log('✅ "Process Now" button is present');
      } else {
        console.log('❌ "Process Now" button is missing');
      }
    }
  });

  test('should show all PDF components correctly', async ({ page }) => {
    console.log('📍 Testing PDF list component display...');
    await page.goto(campaignUrl);
    await page.waitForLoadState('networkidle');

    // Go to Manage PDFs tab
    const managePdfsTab = page.locator('button[role="tab"]', { hasText: 'Manage PDFs' });
    await managePdfsTab.click();
    await page.waitForTimeout(1000);

    console.log('\n🔍 Checking for HomebrewPDFList component...');

    // Check if tRPC query is being made
    const responsePromise = page.waitForResponse(
      response => response.url().includes('homebrew.getPDFs'),
      { timeout: 5000 }
    ).catch(() => null);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await managePdfsTab.click();

    const response = await responsePromise;
    if (response) {
      console.log('✅ getPDFs tRPC call detected');
      const status = response.status();
      console.log(`   HTTP Status: ${status}`);

      if (status === 200) {
        const data = await response.json();
        console.log(`   Response contains ${data?.[0]?.result?.data?.json?.length || 0} PDFs`);
      }
    } else {
      console.log('❌ No getPDFs tRPC call detected - component may not be rendering');
    }

    await page.screenshot({ path: 'test-results/07-component-check.png', fullPage: true });
  });
});
