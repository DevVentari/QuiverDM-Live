import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * PDF Processing Workflow UI Tests
 * Tests the complete homebrew PDF upload and processing workflow
 */

// Helper function to login
async function login(page: any) {
  await page.goto('http://localhost:3002/auth/signin');
  await page.waitForLoadState('domcontentloaded');

  // Wait for form to be ready
  await page.waitForSelector('input#email', { timeout: 10000 });

  await page.locator('input#email').fill('dev@blakewales.au');
  await page.locator('input#password').fill('xaub6NaM7468');
  await page.getByRole('button', { name: 'Sign in with Email' }).click();

  // Wait for redirect
  await page.waitForTimeout(2000);
}

test.describe('PDF Processing Workflow', () => {

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
  });

  test('Navigate to homebrew library', async ({ page }) => {
    console.log('🧪 TEST: Navigate to Homebrew Library');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    console.log(`✓ Current URL: ${url}`);
    expect(url).toContain('/homebrew');

    await page.screenshot({
      path: 'tests/screenshots/pdf-01-homebrew-library.png',
      fullPage: true
    });

    // Check for page heading
    const heading = page.locator('h1, h2').filter({ hasText: /homebrew/i });
    const hasHeading = await heading.count() > 0;
    console.log(`✓ Homebrew heading found: ${hasHeading}`);

    // Look for upload button
    const uploadButton = page.getByRole('button', { name: /upload|add|new/i });
    const hasUploadButton = await uploadButton.count() > 0;
    console.log(`✓ Upload button present: ${hasUploadButton}`);
  });

  test('Check for upload button and click it', async ({ page }) => {
    console.log('🧪 TEST: Click Upload Button');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    // Try multiple possible upload button selectors
    const uploadSelectors = [
      'button:has-text("Upload")',
      'button:has-text("Add")',
      'button:has-text("New")',
      '[data-testid="upload-pdf"]',
      'input[type="file"]',
    ];

    let uploadButton;
    for (const selector of uploadSelectors) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible().catch(() => false)) {
        uploadButton = btn;
        console.log(`✓ Found upload element: ${selector}`);
        break;
      }
    }

    if (uploadButton) {
      await page.screenshot({
        path: 'tests/screenshots/pdf-02-before-upload-click.png',
        fullPage: true
      });

      await uploadButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'tests/screenshots/pdf-03-after-upload-click.png',
        fullPage: true
      });

      console.log('✓ Upload button clicked');
    } else {
      console.log('⚠️ No upload button found - checking for file input');
    }
  });

  test('Check for file upload input', async ({ page }) => {
    console.log('🧪 TEST: Locate File Upload Input');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    // Look for file input (might be hidden)
    const fileInputs = await page.locator('input[type="file"]').count();
    console.log(`✓ File inputs found: ${fileInputs}`);

    if (fileInputs > 0) {
      const fileInput = page.locator('input[type="file"]').first();
      const isVisible = await fileInput.isVisible();
      const isHidden = await fileInput.isHidden();

      console.log(`  - Visible: ${isVisible}`);
      console.log(`  - Hidden: ${isHidden}`);

      // Check attributes
      const accept = await fileInput.getAttribute('accept');
      console.log(`  - Accept attribute: ${accept}`);
    }

    await page.screenshot({
      path: 'tests/screenshots/pdf-04-file-input-check.png',
      fullPage: true
    });
  });

  test('Upload PDF file', async ({ page }) => {
    console.log('🧪 TEST: Upload PDF File');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const testPdfPath = path.resolve('test-documents/homebrew-sample.pdf');
    console.log(`✓ Test PDF path: ${testPdfPath}`);

    await page.screenshot({
      path: 'tests/screenshots/pdf-05-before-upload.png',
      fullPage: true
    });

    // Try to find and use file input
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count() > 0) {
      // Set the file
      await fileInput.setInputFiles(testPdfPath);
      console.log('✓ PDF file selected');

      // Wait for any upload progress or processing to start
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: 'tests/screenshots/pdf-06-after-file-selected.png',
        fullPage: true
      });

      // Look for upload confirmation or processing indicators
      const processingIndicators = [
        'text=/processing|uploading|analyzing/i',
        '[data-testid="upload-progress"]',
        'progress',
        '.progress-bar',
      ];

      for (const selector of processingIndicators) {
        const element = page.locator(selector).first();
        if (await element.isVisible().catch(() => false)) {
          const text = await element.textContent();
          console.log(`✓ Processing indicator: ${text}`);
        }
      }

      // Wait for processing
      await page.waitForTimeout(5000);

      await page.screenshot({
        path: 'tests/screenshots/pdf-07-processing.png',
        fullPage: true
      });
    } else {
      console.log('⚠️ No file input found');
    }
  });

  test('Check for uploaded PDFs in library', async ({ page }) => {
    console.log('🧪 TEST: Check for PDFs in Library');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for PDF items in the library
    const pdfItems = page.locator('[data-testid*="pdf"], [data-testid*="homebrew"], article, .card');
    const itemCount = await pdfItems.count();

    console.log(`✓ Items in library: ${itemCount}`);

    if (itemCount > 0) {
      // Try to get details of first item
      const firstItem = pdfItems.first();
      const text = await firstItem.textContent();
      console.log(`✓ First item text: ${text?.substring(0, 100)}`);
    }

    await page.screenshot({
      path: 'tests/screenshots/pdf-08-library-items.png',
      fullPage: true
    });
  });

  test('Check PDF processing status', async ({ page }) => {
    console.log('🧪 TEST: PDF Processing Status');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    // Look for status indicators
    const statusElements = page.locator('text=/pending|processing|completed|failed|error/i');
    const statusCount = await statusElements.count();

    console.log(`✓ Status indicators found: ${statusCount}`);

    if (statusCount > 0) {
      for (let i = 0; i < Math.min(statusCount, 5); i++) {
        const status = await statusElements.nth(i).textContent();
        console.log(`  - Status ${i + 1}: ${status}`);
      }
    }

    await page.screenshot({
      path: 'tests/screenshots/pdf-09-processing-status.png',
      fullPage: true
    });
  });

  test('Check for progress indicators', async ({ page }) => {
    console.log('🧪 TEST: Progress Indicators');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    // Check for various progress UI elements
    const progressElements = {
      'Progress bars': 'progress, [role="progressbar"]',
      'Percentage text': 'text=/%|percent/i',
      'Loading spinners': '[data-testid="loading"], .spinner, .loading',
      'Status badges': '.badge, .status, [data-status]',
    };

    for (const [name, selector] of Object.entries(progressElements)) {
      const count = await page.locator(selector).count();
      console.log(`✓ ${name}: ${count} found`);
    }

    await page.screenshot({
      path: 'tests/screenshots/pdf-10-progress-indicators.png',
      fullPage: true
    });
  });

  test('Click on a PDF item to view details', async ({ page }) => {
    console.log('🧪 TEST: View PDF Details');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Try to click on first PDF item
    const pdfItem = page.locator('article, .card, [data-testid*="pdf"]').first();

    if (await pdfItem.isVisible().catch(() => false)) {
      console.log('✓ Found PDF item, clicking...');

      await pdfItem.click();
      await page.waitForTimeout(2000);

      const url = page.url();
      console.log(`✓ Navigated to: ${url}`);

      await page.screenshot({
        path: 'tests/screenshots/pdf-11-pdf-details.png',
        fullPage: true
      });

      // Check for PDF viewer or details
      const detailsPresent = await page.locator('h1, h2, h3').count() > 0;
      console.log(`✓ Details page loaded: ${detailsPresent}`);
    } else {
      console.log('⚠️ No PDF items to click');
    }
  });

  test('Check for extraction results', async ({ page }) => {
    console.log('🧪 TEST: Extraction Results');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    // Look for extracted content indicators
    const extractionElements = {
      'Spells': 'text=/spell/i',
      'Monsters': 'text=/monster|creature/i',
      'Items': 'text=/item|equipment/i',
      'Classes': 'text=/class/i',
      'Races': 'text=/race/i',
    };

    console.log('Looking for extracted content types:');
    for (const [type, selector] of Object.entries(extractionElements)) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`  ✓ ${type}: ${count} mentions`);
      }
    }

    await page.screenshot({
      path: 'tests/screenshots/pdf-12-extraction-results.png',
      fullPage: true
    });
  });

  test('Test filter/search functionality', async ({ page }) => {
    console.log('🧪 TEST: Filter/Search');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    // Look for search/filter inputs
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();

    if (await searchInput.isVisible().catch(() => false)) {
      console.log('✓ Search input found');

      await searchInput.fill('homebrew');
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'tests/screenshots/pdf-13-search-results.png',
        fullPage: true
      });

      console.log('✓ Search performed');
    } else {
      console.log('⚠️ No search input found');
    }

    // Look for filter buttons/dropdowns
    const filterButton = page.locator('button:has-text("Filter"), select, [data-testid="filter"]').first();

    if (await filterButton.isVisible().catch(() => false)) {
      console.log('✓ Filter controls found');
      await filterButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: 'tests/screenshots/pdf-14-filters.png',
        fullPage: true
      });
    }
  });

  test('Check for error handling', async ({ page }) => {
    console.log('🧪 TEST: Error Handling');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    // Look for error messages
    const errorElements = page.locator('text=/error|failed|invalid/i');
    const errorCount = await errorElements.count();

    console.log(`✓ Error messages found: ${errorCount}`);

    if (errorCount > 0) {
      for (let i = 0; i < Math.min(errorCount, 3); i++) {
        const errorText = await errorElements.nth(i).textContent();
        console.log(`  - Error: ${errorText?.substring(0, 100)}`);
      }
    }

    await page.screenshot({
      path: 'tests/screenshots/pdf-15-error-handling.png',
      fullPage: true
    });
  });

  test('Test responsive design for PDF workflow', async ({ page }) => {
    console.log('🧪 TEST: Responsive Design');

    await page.goto('http://localhost:3002/homebrew');

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'tests/screenshots/pdf-16-mobile.png',
      fullPage: true
    });
    console.log('✓ Mobile view captured');

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'tests/screenshots/pdf-17-tablet.png',
      fullPage: true
    });
    console.log('✓ Tablet view captured');

    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'tests/screenshots/pdf-18-desktop.png',
      fullPage: true
    });
    console.log('✓ Desktop view captured');
  });

  test('Complete PDF upload workflow', async ({ page }) => {
    console.log('\n🧪 TEST: Complete PDF Upload Workflow\n');

    // Step 1: Navigate to homebrew
    console.log('Step 1: Navigate to homebrew library');
    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');
    console.log('✓ Homebrew page loaded');

    await page.screenshot({
      path: 'tests/screenshots/workflow-01-homebrew-page.png',
      fullPage: true
    });

    // Step 2: Find upload mechanism
    console.log('\nStep 2: Locate upload button');
    const fileInput = page.locator('input[type="file"]').first();
    const inputCount = await fileInput.count();
    console.log(`✓ File inputs found: ${inputCount}`);

    if (inputCount > 0) {
      // Step 3: Upload PDF
      console.log('\nStep 3: Upload PDF file');
      const testPdfPath = path.resolve('test-documents/homebrew-sample.pdf');
      await fileInput.setInputFiles(testPdfPath);
      console.log('✓ File selected');

      await page.waitForTimeout(2000);

      await page.screenshot({
        path: 'tests/screenshots/workflow-02-file-selected.png',
        fullPage: true
      });

      // Step 4: Wait for processing
      console.log('\nStep 4: Wait for processing');
      await page.waitForTimeout(5000);

      await page.screenshot({
        path: 'tests/screenshots/workflow-03-processing.png',
        fullPage: true
      });

      // Step 5: Check results
      console.log('\nStep 5: Check for upload results');
      const items = await page.locator('article, .card').count();
      console.log(`✓ Items in library: ${items}`);

      await page.screenshot({
        path: 'tests/screenshots/workflow-04-results.png',
        fullPage: true
      });

      console.log('\n✅ Workflow test complete');
    } else {
      console.log('⚠️ No file input available');
    }
  });
});
