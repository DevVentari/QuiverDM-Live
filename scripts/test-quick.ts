/**
 * Quick test - extract and transcribe first 60 seconds only
 * Run with: npx tsx scripts/test-quick.ts
 */
import path from 'path';
import { extractAudioFromVideo } from '../src/lib/ffmpeg';
import {
  transcribeWithWhisperX,
  checkWhisperXAvailability,
} from '../src/lib/whisperx';
import { promises as fs } from 'fs';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function main() {
  const videoPath = path.join(
    process.cwd(),
    'test-documents',
    '2025-11-08 18-30-31.mp4'
  );

  console.log('🎬 QuiverDM Quick Transcription Test (60 seconds)');
  console.log('================================================\n');

  // Check if WhisperX is available
  console.log('Checking WhisperX availability...');
  const availability = await checkWhisperXAvailability();

  if (!availability.available) {
    console.error('❌ WhisperX is not available:');
    console.error(availability.error);
    console.log('\n📝 To install, run: pip install -r requirements.txt');
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
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quiverdm-quick-'));
  console.log(`📁 Work directory: ${workDir}\n`);

  try {
    // Extract just first 60 seconds of audio
    console.log('🎵 Extracting first 60 seconds of audio...');
    const startTime = Date.now();
    const audioPath = path.join(workDir, 'sample.mp3');

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .setStartTime(0)
        .setDuration(60) // First 60 seconds
        .outputOptions([
          '-vn',
          '-acodec libmp3lame',
          '-b:a 128k',
        ])
        .output(audioPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    const extractTime = Date.now() - startTime;
    console.log(`✅ Audio extracted in ${(extractTime / 1000).toFixed(1)}s\n`);

    // Transcribe with WhisperX
    const useGPU = process.env.USE_GPU !== 'false';
    console.log(`🤖 Transcribing with WhisperX (small model, batch_size=16, ${useGPU ? 'GPU' : 'CPU'})...`);
    const transcribeStartTime = Date.now();

    const result = await transcribeWithWhisperX(audioPath, {
      modelSize: 'small', // Use small model for faster processing
      device: useGPU ? 'cuda' : 'cpu',
      computeType: useGPU ? 'float16' : 'int8',
      batchSize: 16,
    });

    const transcribeTime = Date.now() - transcribeStartTime;

    if (!result.success) {
      console.error('❌ Transcription failed:', result.error);
      process.exit(1);
    }

    console.log(`✅ Transcription complete in ${(transcribeTime / 1000).toFixed(1)}s`);
    console.log(`   Language: ${result.language} (${(result.language_probability * 100).toFixed(1)}% confidence)`);
    console.log(`   Duration: ${result.duration.toFixed(1)} seconds`);
    console.log(`   Segments: ${result.segments.length}`);
    console.log(`   Words: ${result.text.split(' ').length}\n`);

    // Show full transcription
    console.log('📝 Transcription:');
    console.log('---');
    console.log(result.text);
    console.log('---\n');

    // Save transcription
    const outputPath = path.join(
      process.cwd(),
      'test-documents',
      'quick_test_transcription.txt'
    );
    await fs.writeFile(outputPath, result.text);
    console.log(`💾 Saved to: ${outputPath}\n`);

    // Cleanup
    console.log('🧹 Cleaning up...');
    await fs.rm(workDir, { recursive: true, force: true });
    console.log('✅ Cleanup complete\n');

    console.log('🎉 Quick test completed successfully!');
    console.log('\nTo transcribe the full session, run: npm run test:transcribe');
  } catch (error) {
    console.error('\n❌ Error:', error);
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    process.exit(1);
  }
}

main();
