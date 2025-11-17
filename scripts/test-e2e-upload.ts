/**
 * End-to-End Test: Video Upload & Transcription
 *
 * Tests the complete workflow:
 * 1. Upload video file via API
 * 2. Trigger transcription via tRPC
 * 3. Monitor transcription progress
 * 4. Verify results and cleanup
 */

import { createReadStream, statSync } from 'fs';
import { basename } from 'path';
import FormData from 'form-data';

const SERVER_URL = 'http://localhost:3005';
const TEST_VIDEO = 'E:\\Users\\Office\\Videos\\2025-11-08 18-30-31(1).mp4';

interface UploadResponse {
  url: string;
  key: string;
  size: number;
  type: string;
}

interface TranscriptionResult {
  success: boolean;
  jobId: string;
  transcriptId?: string;
  transcription?: string;
  transcriptionWithSpeakers?: string;
  language?: string;
  duration?: number;
  hasSpeakers?: boolean;
  deletedOriginalFile?: boolean;
}

async function uploadVideo(): Promise<UploadResponse> {
  console.log('\n📤 Step 1: Uploading video file...');
  console.log(`   File: ${TEST_VIDEO}`);

  const stats = statSync(TEST_VIDEO);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  const formData = new FormData();
  formData.append('file', createReadStream(TEST_VIDEO), {
    filename: basename(TEST_VIDEO),
  });
  formData.append('userId', 'test-user');
  formData.append('sessionId', 'test-session-e2e');

  const response = await fetch(`${SERVER_URL}/api/recordings/upload`, {
    method: 'POST',
    body: formData as any,
    headers: formData.getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${response.status} ${error}`);
  }

  const result = await response.json() as UploadResponse;
  console.log('   ✅ Upload successful!');
  console.log(`   URL: ${result.url}`);
  console.log(`   Key: ${result.key}`);
  console.log(`   Type: ${result.type}`);

  return result;
}

async function transcribeVideo(
  fileKey: string,
  fileUrl: string
): Promise<TranscriptionResult> {
  console.log('\n🎙️  Step 2: Starting transcription...');
  console.log(`   Using WhisperX (medium model)`);
  console.log(`   Speaker diarization: enabled`);

  const response = await fetch(
    `${SERVER_URL}/api/trpc/sessionTranscription.transcribeSession`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'test-session-e2e',
        recordingId: undefined,
        filePath: fileKey,
        fileUrl: fileUrl,
        modelSize: 'medium',
        language: undefined,
        useGPU: false, // Use CPU for testing
        useSpeakers: true,
        deleteOriginalFile: false, // Keep original for testing
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Transcription failed: ${response.status} ${error}`);
  }

  const result = await response.json() as { result: { data: TranscriptionResult } };
  const data = result.result.data;

  console.log('   ✅ Transcription complete!');
  console.log(`   Job ID: ${data.jobId}`);
  console.log(`   Transcript ID: ${data.transcriptId}`);
  console.log(`   Duration: ${data.duration?.toFixed(2)}s`);
  console.log(`   Language: ${data.language}`);
  console.log(`   Has speakers: ${data.hasSpeakers}`);
  console.log(`   Original deleted: ${data.deletedOriginalFile}`);

  return data;
}

async function verifyTranscription(result: TranscriptionResult): Promise<void> {
  console.log('\n✅ Step 3: Verifying results...');

  if (!result.success) {
    throw new Error('Transcription was not successful');
  }

  if (!result.transcription) {
    throw new Error('No transcription text returned');
  }

  console.log(`   ✓ Transcription text length: ${result.transcription.length} chars`);

  if (result.hasSpeakers && result.transcriptionWithSpeakers) {
    console.log(
      `   ✓ Speaker diarization text length: ${result.transcriptionWithSpeakers.length} chars`
    );
  }

  console.log('\n📝 Transcription Preview:');
  console.log('   ' + '-'.repeat(60));
  const preview = result.transcription.substring(0, 500);
  console.log(`   ${preview}...`);
  console.log('   ' + '-'.repeat(60));

  if (result.transcriptionWithSpeakers) {
    console.log('\n👥 Speaker Diarization Preview:');
    console.log('   ' + '-'.repeat(60));
    const speakerPreview = result.transcriptionWithSpeakers.substring(0, 500);
    console.log(`   ${speakerPreview}...`);
    console.log('   ' + '-'.repeat(60));
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🧪 QuiverDM End-to-End Test: Video Upload & Transcription');
  console.log('='.repeat(70));

  const startTime = Date.now();

  try {
    // Step 1: Upload video
    const uploadResult = await uploadVideo();

    // Step 2: Transcribe video
    const transcriptionResult = await transcribeVideo(
      uploadResult.key,
      uploadResult.url
    );

    // Step 3: Verify results
    await verifyTranscription(transcriptionResult);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(70));
    console.log(`✅ All tests passed! Total time: ${duration}s`);
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
