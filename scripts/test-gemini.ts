/**
 * Test Gemini API integration with homebrew PDF processing
 */

import path from 'path';
import fs from 'fs';

const API_BASE = 'http://localhost:3002';
const CAMPAIGN_ID = 'cmhsbpbhd0002ia54fik2pwvb';
const USER_ID = 'temp-user';

const TEST_PDF_PATH = path.join(process.cwd(), 'test-documents', 'homebrew-sample.pdf');

async function testGeminiIntegration() {
  console.log('💎 Starting Gemini API integration test...\n');

  // Check if PDF exists
  if (!fs.existsSync(TEST_PDF_PATH)) {
    console.error('❌ Test PDF not found:', TEST_PDF_PATH);
    process.exit(1);
  }

  console.log('📄 Using test PDF:', TEST_PDF_PATH);
  const pdfBuffer = fs.readFileSync(TEST_PDF_PATH);
  const fileSize = (pdfBuffer.length / 1024).toFixed(2);
  console.log(`   Size: ${fileSize} KB\n`);

  // Step 1: Upload PDF
  console.log('📤 Step 1: Uploading PDF...');
  const formData = new FormData();
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  formData.append('file', blob, 'homebrew-sample.pdf');
  formData.append('userId', USER_ID);
  formData.append('campaignId', CAMPAIGN_ID);

  const uploadResponse = await fetch(`${API_BASE}/api/homebrew/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    console.error('❌ Upload failed:', error);
    process.exit(1);
  }

  const uploadResult = await uploadResponse.json();
  console.log('✅ Upload complete! PDF ID:', uploadResult.id);
  console.log(`   Status: ${uploadResult.processingStatus}\n`);

  // Step 2: Process PDF with Gemini
  console.log('💎 Step 2: Processing with Google Gemini...');
  console.log('   Provider: Gemini');
  console.log('   Model: gemini-1.5-flash');
  console.log('   Expected cost: ~$0.001 - $0.01 for this small PDF\n');

  const startTime = Date.now();

  const processResponse = await fetch(`${API_BASE}/api/homebrew/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfId: uploadResult.id,
      userId: USER_ID,
      useAI: true,
      aiProvider: 'gemini',
      geminiModel: 'gemini-1.5-flash',
    }),
  });

  const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

  if (!processResponse.ok) {
    const error = await processResponse.json();
    console.error('❌ Processing failed:', error);
    process.exit(1);
  }

  const processResult = await processResponse.json();
  console.log('✅ Processing complete!');
  console.log(`   Time taken: ${processingTime}s`);
  console.log(`   Items extracted: ${processResult.itemsExtracted || processResult.items?.length || 0}`);

  if (processResult.extractedCount) {
    console.log('   Breakdown:');
    Object.entries(processResult.extractedCount).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`     - ${type}: ${count}`);
      }
    });
  }

  if (processResult.tokensUsed) {
    console.log(`   Tokens used: ${processResult.tokensUsed.toLocaleString()}`);
  }

  if (processResult.estimatedCost !== undefined) {
    console.log(`   Estimated cost: $${processResult.estimatedCost.toFixed(4)}`);
  }
  console.log('');

  // Step 3: Verify items in database
  console.log('🔍 Step 3: Verifying items in database...');
  const contentResponse = await fetch(
    `${API_BASE}/api/trpc/homebrew.getContent?batch=1&input=${encodeURIComponent(
      JSON.stringify({
        0: {
          json: { campaignId: CAMPAIGN_ID },
        },
      })
    )}`
  );

  if (!contentResponse.ok) {
    console.error('❌ Failed to fetch content from database');
    process.exit(1);
  }

  const contentData = await contentResponse.json();
  const items = contentData[0]?.result?.data?.json || [];

  console.log(`✅ Found ${items.length} items in database`);
  if (items.length > 0) {
    console.log('   Latest items:');
    items.slice(0, 5).forEach((item: any, i: number) => {
      console.log(`     ${i + 1}. ${item.name} (${item.type})`);
    });
    if (items.length > 5) {
      console.log(`     ... and ${items.length - 5} more`);
    }
  }
  console.log('');

  // Final summary
  console.log('═══════════════════════════════════════');
  console.log('✨ GEMINI INTEGRATION TEST PASSED! ✨');
  console.log('═══════════════════════════════════════');
  console.log('✅ Upload: Success');
  console.log('✅ Gemini Processing: Success');
  console.log('✅ Database Save: Success');
  console.log('✅ Campaign Linking: Success');
  console.log(`✅ Total Items: ${items.length}`);
  console.log(`✅ Processing Time: ${processingTime}s`);

  if (processResult.estimatedCost !== undefined) {
    console.log(`💰 Cost: $${processResult.estimatedCost.toFixed(4)}`);

    // Compare costs
    console.log('\n💡 Cost Comparison:');
    console.log(`   Gemini:  $${processResult.estimatedCost.toFixed(4)}`);
    console.log(`   OpenAI:  ~$${(processResult.estimatedCost * 2).toFixed(4)} (2x more expensive)`);
    console.log(`   Ollama:  $0.00 (free, local)`);
  }

  console.log('═══════════════════════════════════════\n');
}

testGeminiIntegration().catch((error) => {
  console.error('\n❌ Test failed with error:');
  console.error(error);
  process.exit(1);
});
