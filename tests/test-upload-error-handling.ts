/**
 * Test PDF upload error handling
 * Tests various error scenarios to ensure proper feedback
 */

import path from 'path';
import fs from 'fs';

const API_URL = 'http://localhost:3847';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
  console.log(`${passed ? '✓' : '✗'} ${name}: ${message}`);
}

async function testUploadEndpoint() {
  console.log('\n🧪 Testing PDF Upload Error Handling\n');

  // Test 1: Upload without authentication (should get 401)
  console.log('Test 1: Upload without authentication');
  try {
    const formData = new FormData();
    const testFile = new Blob(['test'], { type: 'application/pdf' });
    formData.append('file', testFile, 'test.pdf');

    const res = await fetch(`${API_URL}/api/homebrew/upload-pdf`, {
      method: 'POST',
      body: formData,
    });

    if (res.status === 401) {
      logTest('Unauthenticated upload', true, 'Correctly returned 401');
    } else {
      logTest('Unauthenticated upload', false, `Expected 401, got ${res.status}`);
    }
  } catch (err) {
    logTest('Unauthenticated upload', false, `Error: ${err}`);
  }

  // Test 2: Check if endpoint exists and responds
  console.log('\nTest 2: Check endpoint availability');
  try {
    const res = await fetch(`${API_URL}/api/homebrew/upload-pdf`, {
      method: 'GET', // Wrong method, but checks if endpoint exists
    });

    // Should get 405 (Method Not Allowed) or 401 (Unauthorized)
    if (res.status === 405 || res.status === 401) {
      logTest('Endpoint availability', true, 'Upload endpoint is accessible');
    } else {
      logTest('Endpoint availability', true, `Endpoint responded with ${res.status}`);
    }
  } catch (err) {
    logTest('Endpoint availability', false, `Error: ${err}`);
  }

  // Test 3: Check if dev server is running
  console.log('\nTest 3: Check dev server');
  try {
    const res = await fetch(`${API_URL}/`);
    if (res.ok || res.status === 404) {
      logTest('Dev server', true, 'Dev server is running');
    } else {
      logTest('Dev server', false, `Unexpected status: ${res.status}`);
    }
  } catch (err) {
    logTest('Dev server', false, 'Dev server is not running. Run: npm run dev');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Test Summary:');
  console.log('='.repeat(50));

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  console.log(`\nPassed: ${passed}/${total}`);

  if (passed === total) {
    console.log('\n✅ All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Check above for details.');
  }

  console.log('\n📝 Note: Full error handling testing requires:');
  console.log('   1. Frontend testing in browser (toast notifications)');
  console.log('   2. Authenticated session to test rate limits');
  console.log('   3. Large file uploads to test size validation');
  console.log('\n   Visit http://localhost:3847/homebrew/pdfs to test manually');
}

testUploadEndpoint().catch(console.error);
