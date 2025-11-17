/**
 * Test script for transcribing a D&D session
 * Run with: npx tsx scripts/test-transcription.ts
 */
import path from 'path';
import { processVideoForTranscription, cleanupFiles } from '../src/lib/ffmpeg';
import {
  transcribeChunksWithWhisperX,
  checkWhisperXAvailability,
} from '../src/lib/whisperx';
import { promises as fs } from 'fs';
import os from 'os';

async function main() {
  const videoPath = path.join(
    process.cwd(),
    'test-documents',
    '2025-11-08 18-30-31.mp4'
  );

  console.log('🎬 QuiverDM Session Transcription Test (WhisperX)');
  console.log('=================================================\n');

  // Check if WhisperX is available
  console.log('Checking WhisperX availability...');
  const availability = await checkWhisperXAvailability();

  if (!availability.available) {
    console.error('❌ WhisperX is not available:');
    console.error(availability.error);
    console.log('\n📝 To install, run:');
    console.log('   pip install -r requirements.txt');
    process.exit(1);
  }

  console.log('✅ WhisperX is available');
  console.log(`   Python: ${availability.pythonVersion}\n`);

  // Check if video file exists
  try {
    await fs.access(videoPath);
  } catch {
    console.error(`❌ Video file not found: ${videoPath}`);
    process.exit(1);
  }

  const stats = await fs.stat(videoPath);
  console.log(`📹 Video file: ${path.basename(videoPath)}`);
  console.log(`   Size: ${(stats.size / 1024 / 1024 / 1024).toFixed(2)} GB\n`);

  // Create temporary work directory
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quiverdm-test-'));
  console.log(`📁 Work directory: ${workDir}\n`);

  try {
    // Process video
    console.log('🎵 Extracting and chunking audio...');
    const startTime = Date.now();

    const { audioPath, chunks } = await processVideoForTranscription(
      videoPath,
      workDir
    );

    const extractTime = Date.now() - startTime;
    console.log(`✅ Created ${chunks.length} chunks in ${(extractTime / 1000).toFixed(1)}s`);

    chunks.forEach((chunk, i) => {
      console.log(
        `   Chunk ${i + 1}: ${chunk.duration.toFixed(1)}s (${path.basename(chunk.path)})`
      );
    });

    // Auto-detect device
    const useGPU = process.env.USE_GPU !== 'false';
    console.log(`\n🤖 Transcribing with WhisperX (medium model, batch_size=16, ${useGPU ? 'GPU' : 'CPU'})...`);
    console.log('   Features: Batching, Word-level alignment, Voice Activity Detection');
    const transcribeStartTime = Date.now();

    const result = await transcribeChunksWithWhisperX(
      chunks.map((c) => c.path),
      {
        modelSize: 'medium',
        device: useGPU ? 'cuda' : 'cpu',
        computeType: useGPU ? 'float16' : 'int8',
        batchSize: 16, // Balanced batch size for 8-12GB VRAM
      }
    );

    const transcribeTime = Date.now() - transcribeStartTime;

    if (!result.success) {
      console.error('❌ Transcription failed:', result.error);
      process.exit(1);
    }

    console.log(`✅ Transcription complete in ${(transcribeTime / 1000 / 60).toFixed(1)} minutes`);
    console.log(`   Language: ${result.language} (${(result.language_probability * 100).toFixed(1)}% confidence)`);
    console.log(`   Duration: ${(result.duration / 60).toFixed(1)} minutes`);
    console.log(`   Segments: ${result.segments.length}`);
    console.log(`   Words: ${result.text.split(' ').length}\n`);

    // Save transcription
    const outputPath = path.join(
      process.cwd(),
      'test-documents',
      '2025-11-08_session_transcription.txt'
    );
    await fs.writeFile(outputPath, result.text);
    console.log(`💾 Transcription saved to: ${outputPath}\n`);

    // Show preview
    const preview = result.text.substring(0, 500);
    console.log('📝 Preview:');
    console.log('---');
    console.log(preview + (result.text.length > 500 ? '...' : ''));
    console.log('---\n');

    // Cleanup
    console.log('🧹 Cleaning up temporary files...');
    await cleanupFiles([audioPath, ...chunks.map((c) => c.path)]);
    await fs.rm(workDir, { recursive: true, force: true });
    console.log('✅ Cleanup complete\n');

    console.log('🎉 Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    process.exit(1);
  }
}

main();
