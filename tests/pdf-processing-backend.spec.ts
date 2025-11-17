/**
 * Backend PDF Processing Test
 *
 * Tests the PDF processing workflow without frontend authentication:
 * 1. Direct file upload to local storage
 * 2. Create database record
 * 3. Queue job
 * 4. Monitor worker processing
 * 5. Verify Marker output
 */

import { test, expect } from '@playwright/test';
import { prisma } from '../src/server/db';
import { addPDFProcessingJob, getPDFProcessingJobStatus } from '../src/lib/queue';
import { uploadFile } from '../src/lib/storage';
import path from 'path';
import fs from 'fs';

const TEST_PDF_PATH = path.join(process.cwd(), 'test-documents', 'homebrew-sample.pdf');
const TEST_USER_ID = 'cmhxbppzn0001puswl1umi509'; // Replace with actual user ID
const TEST_CAMPAIGN_ID = 'cmhysdquo0001o0z09db9jury';

test.describe('PDF Processing Backend', () => {
  test.setTimeout(300000); // 5 minutes

  test('should process PDF through complete pipeline', async () => {
    console.log('\n=== Backend PDF Processing Test ===\n');

    // Step 1: Read the test PDF
    console.log('Step 1: Reading test PDF...');
    const pdfBuffer = fs.readFileSync(TEST_PDF_PATH);
    const pdfSize = pdfBuffer.length;
    console.log(`✓ PDF loaded: ${(pdfSize / 1024).toFixed(2)} KB`);

    // Step 2: Upload to storage
    console.log('\nStep 2: Uploading to local storage...');
    const timestamp = Date.now();
    const r2Key = `homebrew-pdfs/${TEST_USER_ID}/${timestamp}-homebrew-sample.pdf`;

    const storageUrl = await uploadFile({
      key: r2Key,
      body: pdfBuffer,
      contentType: 'application/pdf',
    });

    console.log(`✓ Uploaded to storage: ${storageUrl}`);

    // Step 3: Create database record
    console.log('\nStep 3: Creating database record...');
    const pdf = await prisma.homebrewPDF.create({
      data: {
        userId: TEST_USER_ID,
        campaignId: TEST_CAMPAIGN_ID,
        filename: 'homebrew-sample.pdf',
        fileSize: pdfSize,
        mimeType: 'application/pdf',
        r2Url: storageUrl,
        useLLM: false,
        processingStatus: 'pending',
      },
    });

    console.log(`✓ Database record created (ID: ${pdf.id})`);

    // Step 4: Queue the job
    console.log('\nStep 4: Queuing PDF processing job...');
    const job = await addPDFProcessingJob({
      pdfId: pdf.id,
      userId: TEST_USER_ID,
      campaignId: TEST_CAMPAIGN_ID,
      r2Key,
      filename: 'homebrew-sample.pdf',
      options: {
        useLLM: false,
      },
    });

    console.log(`✓ Job queued (Job ID: ${job.id})`);

    // Step 5: Monitor processing
    console.log('\nStep 5: Monitoring worker processing...');
    console.log('Waiting for worker to pick up job...');

    let attempts = 0;
    const maxAttempts = 60; // 5 minutes
    let currentPdf = pdf;
    let lastStatus = 'pending';

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      // Check database status
      const dbPdf = await prisma.homebrewPDF.findUnique({
        where: { id: pdf.id },
      });

      if (!dbPdf) {
        throw new Error('PDF record disappeared');
      }

      currentPdf = dbPdf;
      const status = currentPdf.processingStatus;

      if (status !== lastStatus) {
        console.log(`  [${attempts * 5}s] Status changed: ${lastStatus} → ${status}`);
        lastStatus = status;
      } else {
        console.log(`  [${attempts * 5}s] Status: ${status}`);
      }

      // Check job status in queue
      const jobStatus = await getPDFProcessingJobStatus(pdf.id);
      if (jobStatus) {
        console.log(`    Queue state: ${jobStatus.state}, Progress: ${jobStatus.progress || 0}%`);
      }

      if (status === 'completed') {
        console.log('✓ Processing completed!');
        break;
      } else if (status === 'failed') {
        console.log(`✗ Processing failed:`);
        console.log(`  Error: ${currentPdf.errorMessage}`);
        throw new Error(`Processing failed: ${currentPdf.errorMessage}`);
      } else if (status === 'processing') {
        console.log('    Worker is processing PDF with Marker...');
      }

      attempts++;
    }

    if (currentPdf.processingStatus !== 'completed') {
      throw new Error(`Processing timed out after ${maxAttempts * 5} seconds`);
    }

    // Step 6: Verify results
    console.log('\nStep 6: Verifying processing results...');

    expect(currentPdf.markdownContent).toBeTruthy();
    const markdownLength = currentPdf.markdownContent!.length;
    console.log(`✓ Markdown content: ${markdownLength} characters`);

    if (currentPdf.markdownR2Url) {
      console.log(`✓ Markdown file path: ${currentPdf.markdownR2Url}`);
    } else {
      console.log('ℹ Markdown stored in database only (file not saved to storage)');
    }

    // Verify markdown file exists
    if (currentPdf.markdownR2Url && fs.existsSync(currentPdf.markdownR2Url)) {
      const fileStats = fs.statSync(currentPdf.markdownR2Url);
      console.log(`✓ Markdown file on disk: ${(fileStats.size / 1024).toFixed(2)} KB`);
    }

    // Preview markdown content
    console.log('\nMarkdown Preview (first 500 chars):');
    console.log('─'.repeat(80));
    console.log(currentPdf.markdownContent!.substring(0, 500));
    console.log('...');
    console.log('─'.repeat(80));

    // Step 7: Summary
    const processingTime = currentPdf.processingEndedAt && currentPdf.processingStartedAt
      ? (currentPdf.processingEndedAt.getTime() - currentPdf.processingStartedAt.getTime()) / 1000
      : attempts * 5;

    console.log('\n=== Test Summary ===');
    console.log(`✓ PDF: ${currentPdf.filename} (${(currentPdf.fileSize / 1024).toFixed(2)} KB)`);
    console.log(`✓ Status: ${currentPdf.processingStatus}`);
    console.log(`✓ Markdown: ${markdownLength} characters`);
    console.log(`✓ Processing time: ~${processingTime}s`);
    console.log(`✓ Storage: ${currentPdf.r2Url}`);
    console.log(`✓ Output: ${currentPdf.markdownR2Url}`);
    console.log('\n✅ Backend processing test PASSED!\n');

    // Assertions
    expect(currentPdf.processingStatus).toBe('completed');
    expect(currentPdf.markdownContent).not.toBeNull();
    expect(currentPdf.markdownContent!.length).toBeGreaterThan(100);
    expect(currentPdf.errorMessage).toBeNull();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });
});
