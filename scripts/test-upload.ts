/**
 * Test PDF upload with authentication
 * Usage: npx tsx scripts/test-upload.ts
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3847';
const TEST_PDF = path.join(process.cwd(), 'tests', 'test-magic-items.pdf');

async function getAuthSession() {
  // For testing, we need to manually create a session or use an API token
  // This is a simplified version - in reality you'd need to authenticate
  console.log('⚠️  Note: This script requires manual authentication');
  console.log('Please sign in at http://localhost:3847 and use the browser to test uploads');
  console.log('\nAlternatively, you can:');
  console.log('1. Sign in to the app');
  console.log('2. Go to /homebrew/pdfs');
  console.log('3. Upload the test PDF at: tests/test-magic-items.pdf');
  console.log('\nTest PDF location:', TEST_PDF);

  if (!fs.existsSync(TEST_PDF)) {
    console.log('\n❌ Test PDF not found!');
    return false;
  }

  const stats = fs.statSync(TEST_PDF);
  console.log(`\n✓ Test PDF exists: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  return true;
}

async function testUpload() {
  console.log('🧪 PDF Upload Test\n');

  const exists = await getAuthSession();
  if (!exists) {
    process.exit(1);
  }

  console.log('\n📝 Testing Instructions:');
  console.log('1. Open http://localhost:3847/homebrew/pdfs in your browser');
  console.log('2. Sign in as dev@blakewales.au');
  console.log('3. Click "Upload PDF"');
  console.log('4. Select: tests/test-magic-items.pdf');
  console.log('5. Verify:');
  console.log('   ✓ Success toast appears');
  console.log('   ✓ PDF appears in list');
  console.log('   ✓ Processing starts');
  console.log('\n6. Upload the SAME file again and verify:');
  console.log('   ✓ Old job is cancelled');
  console.log('   ✓ Old PDF is replaced');
  console.log('   ✓ New processing starts');
}

testUpload().catch(console.error);
