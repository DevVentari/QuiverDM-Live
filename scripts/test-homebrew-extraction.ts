/**
 * End-to-End Test: Homebrew PDF Extraction Pipeline
 *
 * Tests the complete flow:
 * 1. Upload PDF to local storage
 * 2. Create database record
 * 3. Queue job for processing
 * 4. Worker processes with Marker
 * 5. Gemini extracts structured content
 * 6. Content saved to database
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { addPDFProcessingJob, getPDFProcessingJobStatus, redis, pdfProcessingQueue } from '../src/lib/queue';

const prisma = new PrismaClient();

// Test configuration
const TEST_PDF_PATH = path.join(__dirname, '../test-documents/homebrew-sample.pdf');
const LOCAL_STORAGE_DIR = './local-storage';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testHomebrewExtraction() {
  console.log('🧪 End-to-End Homebrew Extraction Pipeline Test\n');
  console.log('=' .repeat(60));

  let pdfId: string | null = null;
  let jobId: string | null = null;
  let testUserId: string | null = null;

  try {
    // Step 0: Create test user
    console.log('\n0️⃣ Creating test user...');
    const testUser = await prisma.user.create({
      data: {
        id: 'test-user-' + Date.now(),
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
      },
    });
    testUserId = testUser.id;
    console.log(`   ✅ Created test user: ${testUserId}`);

    // Step 1: Verify PDF exists
    console.log('\n1️⃣ Verifying test PDF...');
    if (!fs.existsSync(TEST_PDF_PATH)) {
      throw new Error(`Test PDF not found: ${TEST_PDF_PATH}`);
    }
    const pdfStats = fs.statSync(TEST_PDF_PATH);
    console.log(`   ✅ Found: ${path.basename(TEST_PDF_PATH)} (${(pdfStats.size / 1024).toFixed(2)} KB)`);

    // Step 2: Copy PDF to local storage
    console.log('\n2️⃣ Uploading PDF to local storage...');
    const timestamp = Date.now();
    // Use forward slashes for the key (cross-platform compatibility)
    const storageKey = `homebrew-pdfs/${testUserId}/${timestamp}-homebrew-sample.pdf`;
    const storagePath = path.join(LOCAL_STORAGE_DIR, storageKey);
    const storageDir = path.dirname(storagePath);

    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    fs.copyFileSync(TEST_PDF_PATH, storagePath);
    console.log(`   ✅ Uploaded to: ${storagePath}`);

    // Step 3: Create database record
    console.log('\n3️⃣ Creating database record...');
    const pdfRecord = await prisma.homebrewPDF.create({
      data: {
        userId: testUserId,
        filename: 'homebrew-sample.pdf',
        fileSize: pdfStats.size,
        mimeType: 'application/pdf',
        r2Url: `/api/storage/${storageKey}`, // Local storage URL pattern (forward slashes)
        useLLM: true, // Enable AI extraction
        processingStatus: 'pending',
      },
    });
    pdfId = pdfRecord.id;
    console.log(`   ✅ Created PDF record: ${pdfId}`);

    // Step 4: Queue processing job
    console.log('\n4️⃣ Queueing processing job...');
    const job = await addPDFProcessingJob({
      pdfId: pdfId,
      userId: testUserId,
      campaignId: undefined,
      r2Key: storageKey, // Use the key, not the full path
      filename: 'homebrew-sample.pdf',
      options: {
        useLLM: true, // Enable Gemini extraction
      },
    });
    jobId = job.id as string;
    console.log(`   ✅ Job queued: ${jobId}`);

    // Step 5: Monitor job progress
    console.log('\n5️⃣ Monitoring job progress...');
    console.log('   ⏳ Waiting for worker to process (this may take a minute)...\n');

    let lastProgress = -1;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max

    while (attempts < maxAttempts) {
      const status = await getPDFProcessingJobStatus(jobId);

      if (!status) {
        console.log('   ⚠️  Job not found');
        break;
      }

      const progress = typeof status.progress === 'number' ? status.progress : 0;

      if (progress !== lastProgress) {
        const progressBar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
        console.log(`   [${progressBar}] ${progress}% - State: ${status.state}`);
        lastProgress = progress;
      }

      if (status.state === 'completed') {
        console.log('\n   🎉 Job completed successfully!');
        break;
      }

      if (status.state === 'failed') {
        console.log('\n   ❌ Job failed:', status.failedReason);
        break;
      }

      await sleep(1000);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.log('\n   ⏰ Timeout waiting for job completion');
    }

    // Step 6: Check database results
    console.log('\n6️⃣ Checking database results...');

    const updatedPdf = await prisma.homebrewPDF.findUnique({
      where: { id: pdfId },
    });

    if (updatedPdf) {
      console.log(`   📄 PDF Processing Status: ${updatedPdf.processingStatus}`);
      console.log(`   📝 Markdown Generated: ${updatedPdf.markdownContent ? 'Yes' : 'No'}`);
      if (updatedPdf.markdownContent) {
        console.log(`   📏 Markdown Length: ${updatedPdf.markdownContent.length} characters`);
      }
      if (updatedPdf.markerMetadata) {
        console.log(`   🔧 Marker Metadata:`, updatedPdf.markerMetadata);
      }
      if (updatedPdf.errorMessage) {
        console.log(`   ❌ Error: ${updatedPdf.errorMessage}`);
      }
    }

    // Step 7: Check extracted content
    console.log('\n7️⃣ Checking extracted homebrew content...');
    const extractedContent = await prisma.homebrewContent.findMany({
      where: { userId: testUserId! },
      select: {
        id: true,
        name: true,
        type: true,
        tags: true,
        sourceType: true,
        createdAt: true,
      },
    });

    if (extractedContent.length > 0) {
      console.log(`   🎯 Extracted ${extractedContent.length} homebrew items:`);
      extractedContent.forEach((item, i) => {
        console.log(`      ${i + 1}. [${item.type}] ${item.name}`);
        if (item.tags.length > 0) {
          console.log(`         Tags: ${item.tags.join(', ')}`);
        }
      });
    } else {
      console.log('   ⚠️  No content extracted (check worker logs for details)');
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`   PDF ID: ${pdfId}`);
    console.log(`   Job ID: ${jobId}`);
    console.log(`   Status: ${updatedPdf?.processingStatus || 'unknown'}`);
    console.log(`   Markdown: ${updatedPdf?.markdownContent ? 'Generated' : 'Not generated'}`);
    console.log(`   Extracted Items: ${extractedContent.length}`);

    if (updatedPdf?.processingStatus === 'completed' && extractedContent.length > 0) {
      console.log('\n✅ PIPELINE TEST PASSED!');
    } else if (updatedPdf?.processingStatus === 'completed') {
      console.log('\n⚠️  Pipeline completed but no content extracted');
      console.log('   This may be normal if the PDF has no extractable D&D content');
    } else {
      console.log('\n❌ PIPELINE TEST INCOMPLETE');
    }

  } catch (error) {
    console.error('\n❌ Test error:', error);
    throw error;
  } finally {
    // Cleanup (optional - comment out to keep data for inspection)
    console.log('\n🧹 Cleaning up test data...');

    if (pdfId && testUserId) {
      // Delete extracted content
      await prisma.homebrewContent.deleteMany({
        where: { userId: testUserId },
      });
      console.log('   ✅ Deleted test homebrew content');

      // Delete PDF record
      await prisma.homebrewPDF.delete({
        where: { id: pdfId },
      });
      console.log('   ✅ Deleted test PDF record');

      // Delete test user
      await prisma.user.delete({
        where: { id: testUserId },
      });
      console.log('   ✅ Deleted test user');
    }

    // Clean up Redis job if still exists
    if (jobId) {
      const job = await pdfProcessingQueue.getJob(jobId);
      if (job) {
        await job.remove();
        console.log('   ✅ Removed job from queue');
      }
    }

    await redis.quit();
    await pdfProcessingQueue.close();
    await prisma.$disconnect();

    console.log('\n🏁 Test complete!\n');
  }
}

// Run test
testHomebrewExtraction().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
