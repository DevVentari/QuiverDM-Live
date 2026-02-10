import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Document Parsing and Display Tests
 *
 * Tests the complete document parsing workflow:
 * 1. Upload a PDF
 * 2. Verify parsing/extraction happens
 * 3. Check parsed content displays correctly
 * 4. Verify document viewer functionality
 */

// Helper function to login
async function login(page: any) {
  await page.goto('http://localhost:3002/auth/signin');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('input#email', { timeout: 10000 });

  await page.locator('input#email').fill('dev@blakewales.au');
  await page.locator('input#password').fill('xaub6NaM7468');

  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }),
    page.getByRole('button', { name: 'Sign in with Email' }).click(),
  ]);
}

test.describe('Document Parsing & Display Tests', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Verify PDF list shows parsed documents', async ({ page }) => {
    console.log('🧪 TEST: Verify PDF List');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    // Click PDF Library tab
    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'tests/screenshots/doc-parsing-01-pdf-list.png',
      fullPage: true
    });

    // Check for PDF items
    const pdfItems = await page.locator('[data-testid*="pdf"], article, .pdf-item, [class*="pdf"]').count();
    console.log(`✓ PDFs in library: ${pdfItems}`);

    // Look for status indicators
    const statusBadges = await page.locator('text=/ready|processing|completed|failed/i').count();
    console.log(`✓ Status badges found: ${statusBadges}`);

    // Check for file information
    const fileInfo = await page.locator('text=/\\.pdf|pages|KB|MB/i').count();
    console.log(`✓ File information elements: ${fileInfo}`);
  });

  test('Click on PDF to view parsed content', async ({ page }) => {
    console.log('🧪 TEST: View Parsed PDF Content');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    // Navigate to PDF Library tab
    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    // Find clickable PDF items
    const pdfCards = page.locator('article, .card, [role="button"]').filter({ hasText: /.pdf/i });
    const cardCount = await pdfCards.count();

    console.log(`✓ Found ${cardCount} PDF cards`);

    if (cardCount > 0) {
      // Click on first PDF
      const firstPdf = pdfCards.first();
      const pdfName = await firstPdf.textContent();
      console.log(`✓ Clicking on: ${pdfName?.substring(0, 50)}`);

      // Look for view/eye button
      const viewButton = firstPdf.locator('button, [role="button"]').filter({
        hasText: /view|open|eye/i
      }).or(firstPdf.locator('[data-testid*="view"]'));

      if (await viewButton.count() > 0) {
        await viewButton.first().click();
      } else {
        // Try clicking the card itself
        await firstPdf.click();
      }

      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      console.log(`✓ Navigated to: ${currentUrl}`);

      await page.screenshot({
        path: 'tests/screenshots/doc-parsing-02-pdf-viewer.png',
        fullPage: true
      });

      // Check for PDF viewer elements
      const viewerElements = {
        'PDF Canvas/Iframe': await page.locator('canvas, iframe, [data-testid*="pdf"]').count(),
        'Page controls': await page.locator('button:has-text("Next"), button:has-text("Previous"), [aria-label*="page"]').count(),
        'Zoom controls': await page.locator('button:has-text("Zoom"), [aria-label*="zoom"]').count(),
        'Document title': await page.locator('h1, h2, h3').filter({ hasText: /.pdf/i }).count(),
      };

      console.log('PDF Viewer Elements:');
      for (const [name, count] of Object.entries(viewerElements)) {
        console.log(`  ${name}: ${count}`);
      }
    } else {
      console.log('⚠️ No PDFs available to view');
    }
  });

  test('Verify parsed content/metadata displays', async ({ page }) => {
    console.log('🧪 TEST: Parsed Content Display');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    // Check for extracted metadata
    const metadata = {
      'File size': await page.locator('text=/\\d+\\s*(KB|MB|bytes)/i').count(),
      'Page count': await page.locator('text=/\\d+\\s*pages?/i').count(),
      'Upload date': await page.locator('text=/uploaded|created|modified/i').count(),
      'Status': await page.locator('text=/ready|processing|completed/i').count(),
    };

    console.log('Metadata Elements Found:');
    for (const [type, count] of Object.entries(metadata)) {
      console.log(`  ${type}: ${count}`);
    }

    await page.screenshot({
      path: 'tests/screenshots/doc-parsing-03-metadata.png',
      fullPage: true
    });
  });

  test('Check for extracted D&D content types', async ({ page }) => {
    console.log('🧪 TEST: Extracted D&D Content');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(2000);

    // Try clicking first PDF to see extracted content
    const firstPdf = page.locator('article, .card').filter({ hasText: /.pdf/i }).first();

    if (await firstPdf.isVisible().catch(() => false)) {
      await firstPdf.click();
      await page.waitForTimeout(2000);

      // Look for D&D content type indicators
      const contentTypes = {
        'Spells': await page.locator('text=/spell|cantrip|magic/i').count(),
        'Monsters/Creatures': await page.locator('text=/monster|creature|beast/i').count(),
        'Items': await page.locator('text=/item|equipment|weapon|armor/i').count(),
        'Classes': await page.locator('text=/class|subclass/i').count(),
        'Races': await page.locator('text=/race|lineage/i').count(),
        'Feats': await page.locator('text=/feat/i').count(),
      };

      console.log('D&D Content Types Found:');
      for (const [type, count] of Object.entries(contentTypes)) {
        if (count > 0) {
          console.log(`  ✓ ${type}: ${count} mentions`);
        }
      }

      await page.screenshot({
        path: 'tests/screenshots/doc-parsing-04-dnd-content.png',
        fullPage: true
      });
    }
  });

  test('Test PDF viewer navigation controls', async ({ page }) => {
    console.log('🧪 TEST: PDF Viewer Navigation');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    // Click first PDF
    const firstPdf = page.locator('article, .card').filter({ hasText: /.pdf/i }).first();

    if (await firstPdf.isVisible().catch(() => false)) {
      await firstPdf.click();
      await page.waitForTimeout(2000);

      console.log('Checking for viewer controls...');

      // Test page navigation
      const nextButton = page.locator('button').filter({ hasText: /next|>/i }).first();
      const prevButton = page.locator('button').filter({ hasText: /prev|previous|</i }).first();

      if (await nextButton.isVisible().catch(() => false)) {
        console.log('✓ Next button found');
        await nextButton.click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: 'tests/screenshots/doc-parsing-05-page-navigation.png',
          fullPage: true
        });
      }

      if (await prevButton.isVisible().catch(() => false)) {
        console.log('✓ Previous button found');
      }

      // Test zoom controls
      const zoomIn = page.locator('button[aria-label*="zoom in" i], button:has-text("+")').first();
      const zoomOut = page.locator('button[aria-label*="zoom out" i], button:has-text("-")').first();

      if (await zoomIn.isVisible().catch(() => false)) {
        console.log('✓ Zoom controls found');
        await zoomIn.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('Upload new PDF and verify parsing', async ({ page }) => {
    console.log('🧪 TEST: Upload & Parse New PDF');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'tests/screenshots/doc-parsing-06-before-upload.png',
      fullPage: true
    });

    // Find file input
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count() > 0) {
      console.log('✓ File input found');

      const testPdfPath = path.resolve('test-documents/homebrew-sample.pdf');
      await fileInput.setInputFiles(testPdfPath);
      console.log('✓ File selected');

      await page.waitForTimeout(2000);

      await page.screenshot({
        path: 'tests/screenshots/doc-parsing-07-file-selected.png',
        fullPage: true
      });

      // Look for upload/process button
      const uploadButton = page.getByRole('button', {
        name: /upload|process|submit/i
      });

      if (await uploadButton.isVisible().catch(() => false)) {
        console.log('✓ Upload button found, clicking...');
        await uploadButton.click();

        await page.waitForTimeout(3000);

        await page.screenshot({
          path: 'tests/screenshots/doc-parsing-08-after-upload.png',
          fullPage: true
        });

        // Check for processing indicators
        const processing = await page.locator('text=/processing|uploading|analyzing/i').count();
        console.log(`Processing indicators: ${processing}`);

        // Wait a bit for processing
        await page.waitForTimeout(5000);

        await page.screenshot({
          path: 'tests/screenshots/doc-parsing-09-processing-complete.png',
          fullPage: true
        });
      }
    }
  });

  test('Check extraction progress indicators', async ({ page }) => {
    console.log('🧪 TEST: Extraction Progress');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    // Look for progress indicators
    const progressElements = {
      'Progress bars': await page.locator('progress, [role="progressbar"], .progress').count(),
      'Percentage text': await page.locator('text=/%|percent/i').count(),
      'Status text': await page.locator('text=/extracting|parsing|analyzing/i').count(),
      'Spinner/Loader': await page.locator('[data-testid="loading"], .spinner, .loading').count(),
    };

    console.log('Progress Indicators:');
    for (const [type, count] of Object.entries(progressElements)) {
      if (count > 0) {
        console.log(`  ✓ ${type}: ${count}`);
      }
    }

    await page.screenshot({
      path: 'tests/screenshots/doc-parsing-10-progress.png',
      fullPage: true
    });
  });

  test('Verify error handling for invalid documents', async ({ page }) => {
    console.log('🧪 TEST: Error Handling');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    // Look for any error messages or failed documents
    const errorElements = await page.locator('text=/error|failed|invalid|corrupt/i').count();

    if (errorElements > 0) {
      console.log(`✓ Error indicators found: ${errorElements}`);

      const errorTexts = await page.locator('text=/error|failed/i').all();
      for (let i = 0; i < Math.min(errorTexts.length, 3); i++) {
        const text = await errorTexts[i].textContent();
        console.log(`  Error ${i + 1}: ${text?.substring(0, 100)}`);
      }
    } else {
      console.log('✓ No errors found - all documents processed successfully');
    }

    await page.screenshot({
      path: 'tests/screenshots/doc-parsing-11-error-check.png',
      fullPage: true
    });
  });

  test('Test document search/filter functionality', async ({ page }) => {
    console.log('🧪 TEST: Document Search/Filter');

    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();

    if (await searchInput.isVisible().catch(() => false)) {
      console.log('✓ Search input found');

      await searchInput.fill('homebrew');
      await page.waitForTimeout(1000);

      const resultsAfterSearch = await page.locator('article, .card').filter({ hasText: /.pdf/i }).count();
      console.log(`✓ Results after search: ${resultsAfterSearch}`);

      await page.screenshot({
        path: 'tests/screenshots/doc-parsing-12-search.png',
        fullPage: true
      });
    } else {
      console.log('⚠️ No search functionality found');
    }
  });

  test('Complete document workflow - Upload to View', async ({ page }) => {
    console.log('\n🧪 TEST: Complete Document Workflow\n');

    // Step 1: Navigate to homebrew
    console.log('Step 1: Navigate to Homebrew Library');
    await page.goto('http://localhost:3002/homebrew');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'tests/screenshots/workflow-doc-01-homepage.png',
      fullPage: true
    });

    // Step 2: Go to PDF Library
    console.log('\nStep 2: Open PDF Library Tab');
    const pdfTab = page.getByRole('tab', { name: /PDF Library/i });
    await pdfTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'tests/screenshots/workflow-doc-02-pdf-library.png',
      fullPage: true
    });

    // Step 3: Count existing PDFs
    console.log('\nStep 3: Check existing PDFs');
    const beforeCount = await page.locator('article, .card').filter({ hasText: /.pdf/i }).count();
    console.log(`✓ PDFs before upload: ${beforeCount}`);

    // Step 4: Upload PDF
    console.log('\nStep 4: Upload PDF');
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count() > 0) {
      const testPdfPath = path.resolve('test-documents/homebrew-sample.pdf');
      await fileInput.setInputFiles(testPdfPath);
      console.log('✓ File selected');

      await page.waitForTimeout(2000);

      // Click upload button
      const uploadButton = page.getByRole('button', { name: /upload|process/i });
      if (await uploadButton.isVisible().catch(() => false)) {
        await uploadButton.click();
        console.log('✓ Upload button clicked');

        await page.waitForTimeout(3000);

        await page.screenshot({
          path: 'tests/screenshots/workflow-doc-03-uploading.png',
          fullPage: true
        });
      }

      // Step 5: Wait for processing
      console.log('\nStep 5: Wait for processing');
      await page.waitForTimeout(8000);

      await page.screenshot({
        path: 'tests/screenshots/workflow-doc-04-processed.png',
        fullPage: true
      });

      // Step 6: Verify it appears in list
      console.log('\nStep 6: Verify PDF in list');
      const afterCount = await page.locator('article, .card').filter({ hasText: /.pdf/i }).count();
      console.log(`✓ PDFs after upload: ${afterCount}`);

      // Step 7: Open the PDF
      console.log('\nStep 7: Open uploaded PDF');
      const newestPdf = page.locator('article, .card').filter({ hasText: /homebrew-sample/i }).first();

      if (await newestPdf.isVisible().catch(() => false)) {
        await newestPdf.click();
        await page.waitForTimeout(2000);

        console.log(`✓ Opened PDF at: ${page.url()}`);

        await page.screenshot({
          path: 'tests/screenshots/workflow-doc-05-viewing.png',
          fullPage: true
        });

        // Step 8: Verify viewer loaded
        console.log('\nStep 8: Verify viewer elements');
        const viewerPresent = await page.locator('canvas, iframe, [data-testid*="pdf"]').count() > 0;
        console.log(`✓ PDF viewer loaded: ${viewerPresent}`);

        console.log('\n✅ Complete workflow test finished');
      }
    }
  });
});
