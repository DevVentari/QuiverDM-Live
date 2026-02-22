/**
 * Quick test script: transcribe a local video file via AssemblyAI.
 *
 * Usage: npx tsx scripts/test-transcription.ts "<path-to-file>"
 */
import 'dotenv/config';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { extractAudioFromVideo } from '../src/lib/ffmpeg';
import {
  submitAsyncTranscription,
  pollTranscriptionStatus,
  getAsyncResult,
} from '../src/lib/transcription/assemblyai';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/test-transcription.ts "<path-to-video>"');
    process.exit(1);
  }

  // Verify file exists
  const stat = await fs.stat(filePath);
  console.log(`File: ${filePath}`);
  console.log(`Size: ${(stat.size / 1024 / 1024 / 1024).toFixed(2)} GB`);

  // Check API key
  if (!process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_API_KEY === 'your_assemblyai_api_key_here') {
    console.error('ASSEMBLYAI_API_KEY is not set in .env (or is still the placeholder)');
    process.exit(1);
  }
  console.log('AssemblyAI API key: configured');

  const isVideo = /\.(mp4|mkv|avi|mov|webm|flv|wmv)$/i.test(filePath);
  let audioPath = filePath;
  let tempDir: string | null = null;

  // Step 1: Extract audio if video
  if (isVideo) {
    console.log('\n--- Step 1: Extracting audio from video ---');
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quiverdm-test-'));
    audioPath = path.join(tempDir, 'audio.mp3');
    console.log(`Output: ${audioPath}`);
    const start = Date.now();
    await extractAudioFromVideo(filePath, audioPath);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const audioStat = await fs.stat(audioPath);
    console.log(`Audio extracted in ${elapsed}s (${(audioStat.size / 1024 / 1024).toFixed(1)} MB)`);
  }

  // Step 2: Submit to AssemblyAI
  console.log('\n--- Step 2: Submitting to AssemblyAI ---');
  const submitStart = Date.now();
  const transcriptId = await submitAsyncTranscription({
    audioUrl: audioPath,
    speakerLabels: true,
    language: 'en',
  });
  const submitElapsed = ((Date.now() - submitStart) / 1000).toFixed(1);
  console.log(`Submitted in ${submitElapsed}s — Transcript ID: ${transcriptId}`);

  // Step 3: Poll for completion
  console.log('\n--- Step 3: Polling for completion ---');
  let status = await pollTranscriptionStatus(transcriptId);
  let pollCount = 0;

  while (status.status !== 'completed' && status.status !== 'error') {
    process.stdout.write(`\r  [${++pollCount}] Status: ${status.status} (${status.percentComplete}%)    `);
    await new Promise((r) => setTimeout(r, 5000));
    status = await pollTranscriptionStatus(transcriptId);
  }
  console.log(`\n  Final status: ${status.status}`);

  if (status.status === 'error') {
    console.error(`AssemblyAI error: ${status.error}`);
    process.exit(1);
  }

  // Step 4: Get result
  console.log('\n--- Step 4: Getting result ---');
  const result = await getAsyncResult(transcriptId);

  console.log(`Success: ${result.success}`);
  console.log(`Language: ${result.language}`);
  console.log(`Duration: ${result.duration}s`);
  console.log(`Segments: ${result.segments.length}`);
  console.log(`Has speakers: ${result.hasSpeakers}`);
  if (result.speakers) {
    console.log(`Speakers: ${result.speakers.map((s) => `${s.name} (${s.segmentCount} segments)`).join(', ')}`);
  }

  // Print first 10 segments
  console.log('\n--- First 10 segments ---');
  for (const seg of result.segments.slice(0, 10)) {
    const speaker = seg.speaker ? `[${seg.speaker}]` : '';
    const time = `${seg.start.toFixed(1)}s-${seg.end.toFixed(1)}s`;
    console.log(`  ${time} ${speaker} ${seg.text}`);
  }

  // Save full result to a JSON file
  const outPath = path.join(
    path.dirname(filePath),
    `${path.basename(filePath, path.extname(filePath))}_transcript.json`
  );
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));
  console.log(`\nFull result saved to: ${outPath}`);

  // Cleanup temp audio
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
