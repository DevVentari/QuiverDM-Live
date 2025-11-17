/**
 * Full D&D session transcription with WhisperX and speaker diarization
 * Run with: npx tsx scripts/transcribe-session-full.ts
 */
import path from 'path';
import { processVideoForTranscription, cleanupFiles } from '../src/lib/ffmpeg';
import {
  transcribeChunksWithWhisperX,
  checkWhisperXAvailability,
} from '../src/lib/whisperx';
import { promises as fs } from 'fs';
import os from 'os';

// Speaker names for the D&D session
const SPEAKER_NAMES = [
  'DM',
  'Blam Bam Bigglesworth',
  'Gwark',
  'Abdull',
  'Adam Sandleberg',
  'Player 6', // Unknown player
  'Player 7', // Unknown player
];

async function main() {
  const videoPath = path.join(
    process.cwd(),
    'test-documents',
    '2025-11-08 18-30-31.mp4'
  );

  console.log('🎬 QuiverDM Full Session Transcription (WhisperX)');
  console.log('==================================================');
  console.log('Features:');
  console.log('  ✓ GPU-accelerated WhisperX with batching (2-3x faster)');
  console.log('  ✓ Word-level timestamp alignment');
  console.log('  ✓ Speaker diarization (if HF token available)');
  console.log(`  ✓ ${SPEAKER_NAMES.length} expected speakers\n`);

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
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quiverdm-full-'));
  console.log(`📁 Work directory: ${workDir}\n`);

  const overallStartTime = Date.now();

  try {
    // Process video
    console.log('🎵 Extracting and chunking audio...');
    const startTime = Date.now();

    const { audioPath, chunks } = await processVideoForTranscription(
      videoPath,
      workDir
    );

    const extractTime = Date.now() - startTime;
    console.log(`✅ Created ${chunks.length} chunks in ${(extractTime / 1000 / 60).toFixed(1)} minutes`);
    console.log(`   Audio file: ${(await fs.stat(audioPath)).size / 1024 / 1024} MB\n`);

    // Transcribe all chunks with WhisperX
    const useGPU = process.env.USE_GPU !== 'false';
    console.log(`🤖 Transcribing with WhisperX (medium model, batch_size=16, ${useGPU ? 'GPU' : 'CPU'})...`);
    console.log(`   Features: Batching, Word-level alignment, VAD, Speaker diarization`);
    console.log(`   This will take approximately ${useGPU ? '20-30' : '1.5-2 hours'} minutes\n`);

    const transcribeStartTime = Date.now();

    const result = await transcribeChunksWithWhisperX(
      chunks.map((c) => c.path),
      {
        modelSize: 'medium',
        device: useGPU ? 'cuda' : 'cpu',
        computeType: useGPU ? 'float16' : 'int8',
        batchSize: 16, // Balanced batch size for 8-12GB VRAM
        speakerNames: SPEAKER_NAMES,
        maxSpeakers: 7,
      }
    );

    const transcribeTime = Date.now() - transcribeStartTime;

    if (!result.success) {
      console.error('❌ Transcription failed:', result.error);
      throw new Error(result.error || 'Transcription failed');
    }

    console.log(`✅ Transcription complete in ${(transcribeTime / 1000 / 60).toFixed(1)} minutes`);
    console.log(`   Language: ${result.language} (${(result.language_probability * 100).toFixed(1)}% confidence)`);
    console.log(`   Duration: ${(result.duration / 60).toFixed(1)} minutes`);
    console.log(`   Segments: ${result.segments.length}`);
    if (result.hasSpeakers && result.speakers) {
      console.log(`   Speakers detected: ${result.speakers.length}`);
      console.log(`   Speakers: ${result.speakers.map(s => s.name).join(', ')}`);
    }
    console.log();

    // Format transcriptions
    console.log('📝 Formatting transcriptions...');

    const fullText = result.text;
    const textWithSpeakers = result.segments
      .map(s => {
        const speaker = s.speaker ? `[${s.speaker}]` : '';
        const timestamp = `[${formatTime(s.start)}]`;
        return `${timestamp} ${speaker} ${s.text}`;
      })
      .join('\n');

    // Save results
    const outputDir = path.join(process.cwd(), 'test-documents');
    const baseFilename = '2025-11-08_session_transcription';

    const plainTextPath = path.join(outputDir, `${baseFilename}.txt`);
    const speakerTextPath = path.join(outputDir, `${baseFilename}_with_speakers.txt`);
    const jsonPath = path.join(outputDir, `${baseFilename}.json`);

    await fs.writeFile(plainTextPath, fullText);
    await fs.writeFile(speakerTextPath, textWithSpeakers);
    await fs.writeFile(jsonPath, JSON.stringify({
      filename: path.basename(videoPath),
      duration: result.duration,
      segments: result.segments,
      language: result.language,
      hasSpeakers: result.hasSpeakers,
      speakers: result.speakers,
      model: 'medium',
      device: useGPU ? 'cuda' : 'cpu',
      engine: 'WhisperX',
    }, null, 2));

    console.log(`✅ Saved transcriptions:`);
    console.log(`   📄 Plain text: ${plainTextPath}`);
    console.log(`   🎭 With speakers: ${speakerTextPath}`);
    console.log(`   📊 JSON: ${jsonPath}\n`);

    // Statistics
    const totalTime = Date.now() - overallStartTime;
    const wordCount = fullText.split(/\s+/).length;

    console.log('📊 Statistics:');
    console.log(`   Duration: ${(result.duration / 60).toFixed(1)} minutes`);
    console.log(`   Processing time: ${(totalTime / 1000 / 60).toFixed(1)} minutes`);
    console.log(`   Speedup: ${(result.duration / (totalTime / 1000)).toFixed(2)}x realtime`);
    console.log(`   Segments: ${result.segments.length}`);
    console.log(`   Words: ${wordCount.toLocaleString()}`);
    if (result.hasSpeakers && result.speakers) {
      console.log(`   Speakers detected: ${result.speakers.length}`);
      result.speakers.forEach(s => {
        console.log(`     - ${s.name}: ${s.segmentCount} segments`);
      });
    }
    console.log();

    // Preview
    console.log('📝 Preview (first 500 characters):');
    console.log('---');
    console.log(textWithSpeakers.substring(0, 500) + '...');
    console.log('---\n');

    // Cleanup
    console.log('🧹 Cleaning up temporary files...');
    await cleanupFiles([audioPath, ...chunks.map(c => c.path)]);
    await fs.rm(workDir, { recursive: true, force: true });
    console.log('✅ Cleanup complete\n');

    console.log('🎉 Full session transcription completed successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error);
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    process.exit(1);
  }
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

main();
