/**
 * End-to-End Test: PDF Upload and Marker Extraction
 *
 * Tests the complete workflow:
 * 1. Navigate to campaign homebrew page
 * 2. Upload a PDF file
 * 3. Verify job is queued
 * 4. Monitor worker processing
 * 5. Verify Marker conversion completes
 * 6. Check markdown output is generated
 */

import { test, expect } from '@playwright/test';
import { prisma } from '../src/server/db';
import path from 'path';
import fs from 'fs';

const TEST_PDF_PATH = path.join(process.cwd(), 'test-documents', 'homebrew-sample.pdf');
const CAMPAIGN_ID = 'cmhysdquo0001o0z09db9jury'; // Replace with your actual campaign ID

test.describe('PDF Upload and Extraction E2E', () => {
  test.setTimeout(300000); // 5 minutes for full processing

  test('should upload PDF, process with Marker, and generate markdown', async ({ page }) => {
    console.log('\n=== Starting E2E Test ===\n');

    // Step 1: Navigate to the app
    console.log('Step 1: Navigating to application...');
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    // Check if we need to log in
    const isLoginPage = await page.getByText('Sign in').isVisible().catch(() => false);

    if (isLoginPage) {
      console.log('Login required - please ensure you are logged in before running this test');
      // In a real test, you'd handle authentication here
      throw new Error('Authentication required');
    }

    // Step 2: Navigate to campaign homebrew page
    console.log('Step 2: Navigating to campaign homebrew page...');
    await page.goto(`http://localhost:3001/campaigns/${CAMPAIGN_ID}/homebrew`);
    await page.waitForLoadState('networkidle');

    // Verify we're on the homebrew page
    await expect(page.getByText(/Homebrew Library/i)).toBeVisible({ timeout: 10000 });
    console.log('✓ On homebrew page');

    // Step 3: Click "Add PDF" button
    console.log('\nStep 3: Opening PDF upload dialog...');
    const addPdfButton = page.getByRole('button', { name: /Add PDF|Upload PDF/i });
    await addPdfButton.click();
    await page.waitForTimeout(1000);
    console.log('✓ Upload dialog opened');

    // Step 4: Upload the PDF file
    console.log('\nStep 4: Uploading PDF file...');

    // Verify test PDF exists
    if (!fs.existsSync(TEST_PDF_PATH)) {
      throw new Error(`Test PDF not found at: ${TEST_PDF_PATH}`);
    }
    console.log(`Using test PDF: ${TEST_PDF_PATH}`);

    // Find and interact with file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_PDF_PATH);
    await page.waitForTimeout(500);
    console.log('✓ PDF file selected');

    // Click upload/submit button
    const uploadButton = page.getByRole('button', { name: /Upload|Submit|Process/i });
    await uploadButton.click();
    console.log('✓ Upload initiated');

    // Step 5: Wait for upload to complete and get PDF ID
    console.log('\nStep 5: Waiting for upload confirmation...');
    await page.waitForTimeout(2000);

    // Get the most recent PDF from database
    const uploadedPdf = await prisma.homebrewPDF.findFirst({
      where: {
        filename: 'homebrew-sample.pdf',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!uploadedPdf) {
      throw new Error('PDF not found in database after upload');
    }

    const pdfId = uploadedPdf.id;
    console.log(`✓ PDF uploaded successfully (ID: ${pdfId})`);
    console.log(`  Status: ${uploadedPdf.processingStatus}`);
    console.log(`  File size: ${(uploadedPdf.fileSize / 1024).toFixed(2)} KB`);

    // Step 6: Monitor processing status
    console.log('\nStep 6: Monitoring processing status...');
    console.log('Waiting for worker to pick up job...');

    let attempts = 0;
    const maxAttempts = 60; // 60 attempts = 5 minutes
    let currentPdf = uploadedPdf;

    while (attempts < maxAttempts) {
      await page.waitForTimeout(5000); // Check every 5 seconds

      currentPdf = await prisma.homebrewPDF.findUnique({
        where: { id: pdfId },
      });

      if (!currentPdf) {
        throw new Error('PDF record disappeared from database');
      }

      const status = currentPdf.processingStatus;
      console.log(`  [${attempts * 5}s] Status: ${status}`);

      if (status === 'completed') {
        console.log('✓ Processing completed!');
        break;
      } else if (status === 'failed') {
        console.log(`✗ Processing failed: ${currentPdf.errorMessage}`);
        throw new Error(`PDF processing failed: ${currentPdf.errorMessage}`);
      } else if (status === 'processing') {
        console.log('  Worker is processing...');
      }

      attempts++;
    }

    if (currentPdf.processingStatus !== 'completed') {
      throw new Error('Processing timed out after 5 minutes');
    }

    // Step 7: Verify markdown content was generated
    console.log('\nStep 7: Verifying markdown generation...');

    if (!currentPdf.markdownContent) {
      throw new Error('No markdown content generated');
    }

    const markdownLength = currentPdf.markdownContent.length;
    console.log(`✓ Markdown content generated (${markdownLength} characters)`);

    // Preview first 500 characters
    const preview = currentPdf.markdownContent.substring(0, 500);
    console.log('\nMarkdown preview:');
    console.log('---');
    console.log(preview);
    console.log('...');
    console.log('---');

    // Step 8: Verify markdown file was saved
    if (currentPdf.markdownR2Url) {
      console.log('\nStep 8: Verifying markdown file storage...');
      console.log(`Markdown file path: ${currentPdf.markdownR2Url}`);

      if (fs.existsSync(currentPdf.markdownR2Url)) {
        const fileStats = fs.statSync(currentPdf.markdownR2Url);
        console.log(`✓ Markdown file saved (${(fileStats.size / 1024).toFixed(2)} KB)`);
      } else {
        console.log('⚠ Markdown file path not found on disk');
      }
    }

    // Step 9: Navigate to PDF detail page
    console.log('\nStep 9: Navigating to PDF detail page...');
    await page.goto(`http://localhost:3001/homebrew/pdf/${pdfId}`);
    await page.waitForLoadState('networkidle');

    // Verify content is displayed
    await expect(page.getByText('homebrew-sample.pdf')).toBeVisible();
    console.log('✓ PDF detail page loaded');

    // Check for markdown content display
    const hasMarkdown = await page.getByText(/#{1,6}|##/i).isVisible().catch(() => false);
    if (hasMarkdown) {
      console.log('✓ Markdown content visible on page');
    }

    // Step 10: Final verification
    console.log('\n=== Test Summary ===');
    console.log(`✓ PDF uploaded: ${uploadedPdf.filename}`);
    console.log(`✓ Processing status: ${currentPdf.processingStatus}`);
    console.log(`✓ Markdown generated: ${markdownLength} characters`);
    console.log(`✓ Processing time: ${attempts * 5} seconds`);
    console.log(`✓ Storage location: ${currentPdf.r2Url}`);
    console.log('\n✅ End-to-End test PASSED!\n');

    // Take a screenshot of the final result
    await page.screenshot({
      path: 'tests/screenshots/pdf-upload-success.png',
      fullPage: true
    });
    console.log('Screenshot saved: tests/screenshots/pdf-upload-success.png');
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });
});
