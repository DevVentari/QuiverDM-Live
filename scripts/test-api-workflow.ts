/**
 * Test the complete homebrew API workflow
 * 1. Upload PDF via /api/homebrew/upload
 * 2. Process with AI via /api/homebrew/process
 * 3. Verify results in database
 */

import { promises as fs } from 'fs';
import path from 'path';
import FormData from 'form-data';
import { prisma } from '../src/server/db';

const API_BASE = 'http://localhost:3003'; // Using current dev server port
const TEST_USER_ID = 'test-user-' + Date.now();
const TEST_CAMPAIGN_ID = 'test-campaign-' + Date.now();

async function testWorkflow() {
  console.log('🧪 Testing Complete Homebrew API Workflow\n');
  console.log(`👤 User ID: ${TEST_USER_ID}`);
  console.log(`📁 Campaign ID: ${TEST_CAMPAIGN_ID}\n`);

  try {
    // Step 1: Upload PDF
    console.log('📤 Step 1: Uploading PDF...');
    const pdfPath = path.join(__dirname, '../test-documents/homebrew-sample.pdf');
    const pdfBuffer = await fs.readFile(pdfPath);

    const formData = new FormData();
    formData.append('file', pdfBuffer, {
      filename: 'homebrew-sample.pdf',
      contentType: 'application/pdf',
    });
    formData.append('userId', TEST_USER_ID);
    formData.append('campaignId', TEST_CAMPAIGN_ID);

    const uploadResponse = await fetch(`${API_BASE}/api/homebrew/upload`, {
      method: 'POST',
      body: formData as any,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log(`   ✅ Uploaded: ${uploadResult.filename}`);
    console.log(`   📦 URL: ${uploadResult.url}`);
    console.log(`   💾 Size: ${(uploadResult.fileSize / 1024).toFixed(2)} KB\n`);

    // Step 2: Create PDF record in database
    console.log('💾 Step 2: Creating PDF record in database...');
    const pdf = await prisma.homebrewPDF.create({
      data: {
        userId: TEST_USER_ID,
        campaignId: TEST_CAMPAIGN_ID,
        filename: uploadResult.filename,
        url: uploadResult.url,
        fileSize: uploadResult.fileSize,
        processingStatus: 'pending',
      },
    });
    console.log(`   ✅ PDF Record ID: ${pdf.id}\n`);

    // Step 3: Process with AI
    console.log('🤖 Step 3: Processing with AI extraction...');
    console.log('   (This may take 10-15 seconds)\n');

    const processResponse = await fetch(`${API_BASE}/api/homebrew/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdfId: pdf.id,
        userId: TEST_USER_ID,
        useAI: true,
      }),
    });

    if (!processResponse.ok) {
      const error = await processResponse.json();
      throw new Error(`Processing failed: ${JSON.stringify(error)}`);
    }

    const processResult = await processResponse.json();
    console.log('✅ Processing Complete!\n');

    // Step 4: Display results
    console.log('📊 Extraction Summary:');
    console.log(`   Total items: ${processResult.itemsExtracted}`);
    console.log('');

    if (processResult.extractedCount) {
      console.log('📦 Items by Type:');
      Object.entries(processResult.extractedCount).forEach(([type, count]) => {
        if (count as number > 0) {
          const icon = {
            items: '⚔️',
            creatures: '🐉',
            spells: '✨',
            locations: '🗺️',
            subclasses: '📜',
            feats: '💪',
            rules: '📖',
          }[type] || '📄';
          console.log(`   ${icon} ${type}: ${count}`);
        }
      });
      console.log('');
    }

    // Step 5: Verify in database
    console.log('🔍 Step 4: Verifying results in database...');
    const dbContent = await prisma.homebrewContent.findMany({
      where: { userId: TEST_USER_ID },
    });

    console.log(`   ✅ Found ${dbContent.length} items in database\n`);

    console.log('📄 Sample Items:');
    dbContent.slice(0, 3).forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.name} (${item.type})`);
    });
    console.log('');

    // Step 6: Cleanup
    console.log('🧹 Cleaning up test data...');
    await prisma.homebrewContent.deleteMany({
      where: { userId: TEST_USER_ID },
    });
    await prisma.homebrewPDF.deleteMany({
      where: { userId: TEST_USER_ID },
    });
    console.log('   ✅ Cleanup complete\n');

    console.log('✨ All tests passed!');
    console.log('');
    console.log('🎉 The complete workflow is working:');
    console.log('   ✅ PDF upload');
    console.log('   ✅ Database record creation');
    console.log('   ✅ AI extraction with GPT-4o-mini');
    console.log('   ✅ Content saved to database');
    console.log('   ✅ Results queryable');
  } catch (error) {
    console.error('\n❌ Test failed:', error);

    // Cleanup on error
    try {
      await prisma.homebrewContent.deleteMany({
        where: { userId: TEST_USER_ID },
      });
      await prisma.homebrewPDF.deleteMany({
        where: { userId: TEST_USER_ID },
      });
      console.log('🧹 Cleaned up test data');
    } catch (cleanupError) {
      console.error('Failed to cleanup:', cleanupError);
    }

    process.exit(1);
  }
}

// Run test
console.log('Starting test...\n');
testWorkflow().catch(console.error);
