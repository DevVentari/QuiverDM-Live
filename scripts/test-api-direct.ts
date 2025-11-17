/**
 * Direct API Test: Upload and Transcription
 * Tests the APIs directly without browser automation
 */

import { readFileSync } from 'fs';
import { basename } from 'path';

const SERVER_URL = 'http://localhost:3006';
const TEST_VIDEO = 'E:\\Users\\Office\\Videos\\2025-11-08 18-30-31(1).mp4';

interface UploadResponse {
  success: boolean;
  url: string;
  key: string;
  filename: string;
  fileSize: number;
  type: string;
  contentType: string;
}

async function testUpload() {
  console.log('\n📤 Testing Upload API...');
  console.log(`   File: ${TEST_VIDEO}`);

  // Read file
  const fileBuffer = readFileSync(TEST_VIDEO);
  console.log(`   Size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  // Create form data
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const chunks: Buffer[] = [];

  // Add file field
  chunks.push(Buffer.from(`--${boundary}\r\n`));
  chunks.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${basename(TEST_VIDEO)}"\r\n`));
  chunks.push(Buffer.from(`Content-Type: video/mp4\r\n\r\n`));
  chunks.push(fileBuffer);
  chunks.push(Buffer.from(`\r\n`));

  // Add userId field
  chunks.push(Buffer.from(`--${boundary}\r\n`));
  chunks.push(Buffer.from(`Content-Disposition: form-data; name="userId"\r\n\r\n`));
  chunks.push(Buffer.from('test-user\r\n'));

  // Add sessionId field
  chunks.push(Buffer.from(`--${boundary}\r\n`));
  chunks.push(Buffer.from(`Content-Disposition: form-data; name="sessionId"\r\n\r\n`));
  chunks.push(Buffer.from('test-session\r\n'));

  // Close boundary
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(chunks);

  console.log('   Uploading...');
  const response = await fetch(`${SERVER_URL}/api/recordings/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    },
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${response.status} ${error}`);
  }

  const result = (await response.json()) as UploadResponse;
  console.log('   ✅ Upload successful!');
  console.log(`   URL: ${result.url}`);
  console.log(`   Key: ${result.key}`);
  console.log(`   Type: ${result.type}`);

  return result;
}

async function testTranscription(fileKey: string, fileUrl: string) {
  console.log('\n🎙️  Testing Transcription API...');
  console.log(`   Using WhisperX (base model for quick test)`);

  // tRPC batch request format
  const response = await fetch(
    `${SERVER_URL}/api/trpc/sessionTranscription.transcribeSession?batch=1`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        '0': {
          sessionId: 'test-session',
          filePath: fileKey,
          fileUrl: fileUrl,
          modelSize: 'base', // Use base model for faster testing
          useGPU: false,
          useSpeakers: false, // Disable for faster testing
          deleteOriginalFile: false,
        }
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('   ❌ Response:', errorText);
    throw new Error(`Transcription failed: ${response.status}`);
  }

  const result = await response.json();
  console.log('   ✅ Transcription started!');
  console.log(`   Response:`, JSON.stringify(result, null, 2));

  return result;
}

async function main() {
  console.log('='.repeat(70));
  console.log('🧪 QuiverDM Direct API Test');
  console.log('='.repeat(70));

  const startTime = Date.now();

  try {
    // Test 1: Upload
    const uploadResult = await testUpload();

    // Test 2: Transcription
    const transcriptionResult = await testTranscription(
      uploadResult.key,
      uploadResult.url
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(70));
    console.log(`✅ All API tests passed! Total time: ${duration}s`);
    console.log('='.repeat(70));

    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ Test failed:', error);
    console.error('='.repeat(70));
    process.exit(1);
  }
}

main();
