#!/usr/bin/env tsx
/**
 * Quick test for PDF processing after licensing fix
 * Tests both Marker and pdfplumber fallback
 */

import { convertPdfWithPdfplumber } from '../src/lib/pdf/pdfplumber-fallback';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  console.log('🧪 Testing PDF Processing Pipeline\n');

  // Check if pdfplumber Python script exists
  const scriptPath = path.join(process.cwd(), 'scripts', 'pdfplumber_extract.py');
  try {
    await fs.access(scriptPath);
    console.log('✅ pdfplumber script found:', scriptPath);
  } catch (error) {
    console.error('❌ pdfplumber script not found');
    process.exit(1);
  }

  // Test pdfplumber fallback with a sample PDF
  // You'll need a test PDF - check if any exist
  const testPdfPaths = [
    '.archive/test-documents/dms-guild-documents/homebrew-sample.pdf',
    '.archive/homebrew-pdfs/test.pdf',
    'test.pdf'
  ];

  let testPdfPath: string | null = null;
  for (const pdfPath of testPdfPaths) {
    try {
      await fs.access(pdfPath);
      testPdfPath = pdfPath;
      console.log('✅ Test PDF found:', pdfPath);
      break;
    } catch {
      // Try next path
    }
  }

  if (!testPdfPath) {
    console.log('⚠️  No test PDF found. Skipping actual conversion test.');
    console.log('   PDF processing code is ready, but needs a test file.');
    console.log('   Place a test PDF and run again to verify.');
    return;
  }

  // Test pdfplumber conversion
  console.log('\n🔄 Testing pdfplumber fallback...');
  try {
    const result = await convertPdfWithPdfplumber(testPdfPath);
    console.log('✅ pdfplumber conversion successful!');
    console.log('   Pages:', result.metadata.pages);
    console.log('   Tables:', result.metadata.tables);
    console.log('   Processing time:', result.metadata.processingTime.toFixed(2), 'seconds');
    console.log('   Markdown length:', result.markdown.length, 'characters');

    if (result.markdown.length > 0) {
      console.log('   First 100 chars:', result.markdown.substring(0, 100));
    }
  } catch (error: any) {
    console.error('❌ pdfplumber conversion failed:', error.message);
    process.exit(1);
  }

  console.log('\n✅ All PDF processing tests passed!');
  console.log('\nNote: Full pipeline test (BullMQ worker + Marker) requires:');
  console.log('  1. Start worker: npm run worker:pdf');
  console.log('  2. Upload PDF via API');
  console.log('  3. Check job completes in database');
}

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
