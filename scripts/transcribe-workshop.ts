#!/usr/bin/env npx tsx
/**
 * Workshop Audio Transcription Tool
 *
 * Batch transcription of difficult audio recordings from workshops/trade events
 * with enhanced noise reduction and speaker diarization.
 *
 * Usage:
 *   npx tsx scripts/transcribe-workshop.ts --input ./recordings/ --output ./transcriptions/
 *
 * Example for Makita Masters:
 *   npx tsx scripts/transcribe-workshop.ts \
 *     --input ./test-documents/makita-masters/ \
 *     --output ./test-documents/makita-masters/transcriptions/
 */
import { parseArgs } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

import {
  preprocessWorkshopAudio,
  splitWorkshopAudioIntoChunks,
  getMediaDuration,
  cleanupWorkshopFiles,
  getPresetInfo,
  AUDIO_PRESETS,
  type AudioPreset,
} from '../src/lib/ffmpeg-workshop';

import {
  transcribeChunksWithWhisperX,
  checkWhisperXAvailability,
  type WhisperXTranscriptionResult,
  type ProgressEvent,
} from '../src/lib/whisperx';

// Supported audio file extensions
const AUDIO_EXTENSIONS = ['.m4a', '.mp3', '.wav', '.flac', '.ogg', '.aac', '.wma'];

interface TranscriptionOptions {
  input: string;
  output: string;
  preset: AudioPreset;
  model: string;
  minSpeakers: number;
  maxSpeakers: number;
  speakerNames: string[];
  format: 'txt' | 'speakers' | 'json' | 'srt' | 'all';
  gpu: boolean;
  language: string;
  dryRun: boolean;
}

interface ProcessedFile {
  inputPath: string;
  outputBasename: string;
  duration: number;
  result?: WhisperXTranscriptionResult;
  error?: string;
}

/**
 * Parse command line arguments
 */
function parseCliArgs(): TranscriptionOptions {
  const { values } = parseArgs({
    options: {
      input: { type: 'string', short: 'i' },
      output: { type: 'string', short: 'o', default: './output/' },
      preset: { type: 'string', short: 'p', default: 'workshop' },
      model: { type: 'string', short: 'm', default: 'medium' },
      'min-speakers': { type: 'string', default: '4' },
      'max-speakers': { type: 'string', default: '8' },
      'speaker-names': { type: 'string', multiple: true },
      format: { type: 'string', short: 'f', default: 'all' },
      gpu: { type: 'boolean', default: true },
      'cpu-only': { type: 'boolean', default: false },
      language: { type: 'string', short: 'l', default: 'en' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
      'list-presets': { type: 'boolean' },
    },
    strict: true,
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (values['list-presets']) {
    console.log('\nAvailable audio presets:\n');
    console.log(getPresetInfo());
    process.exit(0);
  }

  if (!values.input) {
    console.error('Error: --input is required\n');
    printHelp();
    process.exit(1);
  }

  return {
    input: values.input,
    output: values.output || './output/',
    preset: (values.preset || 'workshop') as AudioPreset,
    model: values.model || 'medium',
    minSpeakers: parseInt(values['min-speakers'] || '4', 10),
    maxSpeakers: parseInt(values['max-speakers'] || '8', 10),
    speakerNames: values['speaker-names'] || [],
    format: (values.format || 'all') as TranscriptionOptions['format'],
    gpu: values.gpu !== false && !values['cpu-only'],
    language: values.language || 'en',
    dryRun: values['dry-run'] || false,
  };
}

function printHelp(): void {
  console.log(`
Workshop Audio Transcription Tool
=================================

Batch transcription of difficult audio recordings with enhanced noise reduction.

Usage:
  npx tsx scripts/transcribe-workshop.ts --input <folder> [options]

Required:
  -i, --input <folder>      Input folder containing audio files

Options:
  -o, --output <folder>     Output folder for transcriptions (default: ./output/)
  -p, --preset <name>       Audio preset: workshop, pocket, outdoor, conference, standard
                            (default: workshop)
  -m, --model <size>        Whisper model: tiny, base, small, medium, large-v2, large-v3
                            (default: medium)
  --min-speakers <n>        Minimum speakers to detect (default: 4)
  --max-speakers <n>        Maximum speakers to detect (default: 8)
  --speaker-names <names>   Space-separated list of speaker names
  -f, --format <type>       Output format: txt, speakers, json, srt, all (default: all)
  --gpu                     Use GPU acceleration (default: true)
  --cpu-only                Disable GPU, use CPU only
  -l, --language <code>     Language code, e.g., 'en' (default: en)
  --dry-run                 Preview files without processing
  --list-presets            Show available audio presets
  -h, --help                Show this help message

Examples:
  # Transcribe Makita Masters recordings
  npx tsx scripts/transcribe-workshop.ts \\
    --input ./test-documents/makita-masters/ \\
    --output ./test-documents/makita-masters/transcriptions/

  # Use pocket preset for muffled recordings
  npx tsx scripts/transcribe-workshop.ts \\
    --input ./recordings/ --preset pocket

  # Quick test with small model on CPU
  npx tsx scripts/transcribe-workshop.ts \\
    --input ./recordings/ --model small --cpu-only
`);
}

/**
 * Discover audio files in input directory
 */
async function discoverAudioFiles(inputDir: string): Promise<string[]> {
  const entries = await fs.readdir(inputDir, { withFileTypes: true });

  const audioFiles = entries
    .filter((entry) => {
      if (!entry.isFile()) return false;
      const ext = path.extname(entry.name).toLowerCase();
      return AUDIO_EXTENSIONS.includes(ext);
    })
    .map((entry) => path.join(inputDir, entry.name))
    .sort();

  return audioFiles;
}

/**
 * Format time as HH:MM:SS or MM:SS
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration for display
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Generate plain text output
 */
function generatePlainText(result: WhisperXTranscriptionResult): string {
  return result.text;
}

/**
 * Generate speaker-labeled output with timestamps
 */
function generateSpeakerText(result: WhisperXTranscriptionResult): string {
  const lines: string[] = [];

  for (const segment of result.segments) {
    const timestamp = `[${formatTime(segment.start)}]`;
    const speaker = segment.speaker ? `[${segment.speaker}]` : '';
    lines.push(`${timestamp} ${speaker} ${segment.text}`.trim());
  }

  return lines.join('\n');
}

/**
 * Generate SRT subtitle format
 */
function generateSRT(result: WhisperXTranscriptionResult): string {
  const lines: string[] = [];

  result.segments.forEach((segment, index) => {
    const startTime = formatSRTTime(segment.start);
    const endTime = formatSRTTime(segment.end);
    const speaker = segment.speaker ? `[${segment.speaker}] ` : '';

    lines.push(`${index + 1}`);
    lines.push(`${startTime} --> ${endTime}`);
    lines.push(`${speaker}${segment.text}`);
    lines.push('');
  });

  return lines.join('\n');
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Generate JSON output with full metadata
 */
function generateJSON(
  result: WhisperXTranscriptionResult,
  inputFile: string,
  options: TranscriptionOptions
): string {
  return JSON.stringify(
    {
      filename: path.basename(inputFile),
      duration: result.duration,
      language: result.language,
      speakerCount: result.speakers?.length || 0,
      speakers: result.speakers,
      segments: result.segments,
      metadata: {
        model: options.model,
        preset: options.preset,
        processedAt: new Date().toISOString(),
        engine: 'WhisperX',
      },
    },
    null,
    2
  );
}

/**
 * Save transcription outputs in requested formats
 */
async function saveOutputs(
  result: WhisperXTranscriptionResult,
  inputFile: string,
  outputDir: string,
  format: TranscriptionOptions['format'],
  options: TranscriptionOptions
): Promise<string[]> {
  const basename = path.basename(inputFile, path.extname(inputFile));
  const savedFiles: string[] = [];

  await fs.mkdir(outputDir, { recursive: true });

  if (format === 'all' || format === 'txt') {
    const txtPath = path.join(outputDir, `${basename}.txt`);
    await fs.writeFile(txtPath, generatePlainText(result));
    savedFiles.push(txtPath);
  }

  if (format === 'all' || format === 'speakers') {
    const speakersPath = path.join(outputDir, `${basename}.speakers.txt`);
    await fs.writeFile(speakersPath, generateSpeakerText(result));
    savedFiles.push(speakersPath);
  }

  if (format === 'all' || format === 'json') {
    const jsonPath = path.join(outputDir, `${basename}.json`);
    await fs.writeFile(jsonPath, generateJSON(result, inputFile, options));
    savedFiles.push(jsonPath);
  }

  if (format === 'all' || format === 'srt') {
    const srtPath = path.join(outputDir, `${basename}.srt`);
    await fs.writeFile(srtPath, generateSRT(result));
    savedFiles.push(srtPath);
  }

  return savedFiles;
}

/**
 * Process a single audio file
 */
async function processFile(
  inputPath: string,
  options: TranscriptionOptions,
  fileIndex: number,
  totalFiles: number
): Promise<ProcessedFile> {
  const basename = path.basename(inputPath);
  console.log(`\n[${ fileIndex + 1}/${totalFiles}] Processing: ${basename}`);
  console.log('─'.repeat(60));

  const result: ProcessedFile = {
    inputPath,
    outputBasename: path.basename(inputPath, path.extname(inputPath)),
    duration: 0,
  };

  try {
    // Get original duration
    result.duration = await getMediaDuration(inputPath);
    console.log(`  Duration: ${formatDuration(result.duration)}`);

    // Create temp directory for this file
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workshop-'));

    try {
      // Step 1: Preprocess audio
      console.log(`\n  Step 1: Preprocessing with '${options.preset}' preset...`);
      const preprocessedPath = await preprocessWorkshopAudio(inputPath, {
        preset: options.preset,
        outputDir: tempDir,
      });

      // Step 2: Split into chunks if needed
      console.log('\n  Step 2: Preparing audio chunks...');
      const chunkDuration = 600; // 10 minutes
      let chunks: { path: string; index: number; duration: number }[];

      if (result.duration > chunkDuration) {
        chunks = await splitWorkshopAudioIntoChunks(preprocessedPath, chunkDuration, tempDir);
        console.log(`  Created ${chunks.length} chunks (10 min each)`);
      } else {
        chunks = [{ path: preprocessedPath, index: 0, duration: result.duration }];
        console.log('  Single chunk (no splitting needed)');
      }

      // Step 3: Transcribe with WhisperX
      console.log(`\n  Step 3: Transcribing with WhisperX (${options.model} model)...`);
      console.log(`  GPU: ${options.gpu ? 'enabled' : 'disabled'}, Speakers: ${options.minSpeakers}-${options.maxSpeakers}`);

      const transcriptionResult = await transcribeChunksWithWhisperX(
        chunks.map((c) => c.path),
        {
          modelSize: options.model as 'tiny' | 'base' | 'small' | 'medium' | 'large-v2' | 'large-v3',
          device: options.gpu ? 'cuda' : 'cpu',
          computeType: options.gpu ? 'float16' : 'int8',
          batchSize: 16,
          language: options.language,
          minSpeakers: options.minSpeakers,
          maxSpeakers: options.maxSpeakers,
          speakerNames: options.speakerNames.length > 0 ? options.speakerNames : undefined,
          onProgress: (event: ProgressEvent) => {
            const chunkInfo = event.details.currentChunk
              ? ` (chunk ${event.details.currentChunk}/${event.details.totalChunks})`
              : '';
            if (event.percentage !== null) {
              process.stdout.write(`\r  ${event.stage}: ${event.percentage.toFixed(0)}%${chunkInfo}     `);
            } else if (event.message) {
              console.log(`\n  ${event.stage}: ${event.message}`);
            }
          },
        }
      );

      console.log('\n');

      if (!transcriptionResult.success) {
        throw new Error(transcriptionResult.error || 'Transcription failed');
      }

      result.result = transcriptionResult;

      // Step 4: Save outputs
      console.log('  Step 4: Saving outputs...');
      const savedFiles = await saveOutputs(
        transcriptionResult,
        inputPath,
        options.output,
        options.format,
        options
      );

      console.log(`  Saved ${savedFiles.length} file(s):`);
      savedFiles.forEach((f) => console.log(`    - ${path.basename(f)}`));

      // Print summary
      console.log(`\n  Summary:`);
      console.log(`    Duration: ${formatDuration(transcriptionResult.duration)}`);
      console.log(`    Segments: ${transcriptionResult.segments.length}`);
      console.log(`    Words: ${transcriptionResult.text.split(/\s+/).length.toLocaleString()}`);
      if (transcriptionResult.hasSpeakers && transcriptionResult.speakers) {
        console.log(`    Speakers: ${transcriptionResult.speakers.length}`);
        transcriptionResult.speakers.forEach((s) => {
          console.log(`      - ${s.name}: ${s.segmentCount} segments`);
        });
      }

      // Cleanup temp files
      await cleanupWorkshopFiles([preprocessedPath, ...chunks.map((c) => c.path)]);
      await fs.rm(tempDir, { recursive: true, force: true });

    } catch (err) {
      // Cleanup on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }

  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    console.error(`\n  Error: ${result.error}`);
  }

  return result;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('\n🔧 Workshop Audio Transcription Tool');
  console.log('====================================');
  console.log('Optimized for difficult recordings: power tools, distant mics, muffled audio\n');

  // Parse arguments
  const options = parseCliArgs();

  // Check WhisperX availability
  console.log('Checking WhisperX availability...');
  const availability = await checkWhisperXAvailability();

  if (!availability.available) {
    console.error('❌ WhisperX is not available:');
    console.error(availability.error);
    console.log('\n📝 To install, run: pip install -r requirements.txt');
    process.exit(1);
  }

  console.log('✅ WhisperX available');
  console.log(`   Python: ${availability.pythonVersion}\n`);

  // Validate input directory
  const inputPath = path.resolve(options.input);
  try {
    const stat = await fs.stat(inputPath);
    if (!stat.isDirectory()) {
      console.error(`❌ Input path is not a directory: ${inputPath}`);
      process.exit(1);
    }
  } catch {
    console.error(`❌ Input directory not found: ${inputPath}`);
    process.exit(1);
  }

  // Discover audio files
  const audioFiles = await discoverAudioFiles(inputPath);

  if (audioFiles.length === 0) {
    console.error(`❌ No audio files found in: ${inputPath}`);
    console.log(`   Supported formats: ${AUDIO_EXTENSIONS.join(', ')}`);
    process.exit(1);
  }

  // Print configuration
  console.log('Configuration:');
  console.log(`  Input:        ${inputPath}`);
  console.log(`  Output:       ${path.resolve(options.output)}`);
  console.log(`  Preset:       ${options.preset} - ${AUDIO_PRESETS[options.preset]?.description || 'unknown'}`);
  console.log(`  Model:        ${options.model}`);
  console.log(`  Speakers:     ${options.minSpeakers}-${options.maxSpeakers}`);
  console.log(`  GPU:          ${options.gpu ? 'enabled' : 'disabled'}`);
  console.log(`  Format:       ${options.format}`);
  console.log(`  Language:     ${options.language}`);
  console.log();

  // List files to process
  console.log(`Found ${audioFiles.length} audio file(s):`);
  let totalDuration = 0;
  for (const file of audioFiles) {
    const duration = await getMediaDuration(file);
    totalDuration += duration;
    console.log(`  - ${path.basename(file)} (${formatDuration(duration)})`);
  }
  console.log(`  Total duration: ${formatDuration(totalDuration)}`);

  // Dry run check
  if (options.dryRun) {
    console.log('\n📋 Dry run complete - no files processed');
    process.exit(0);
  }

  // Estimate time
  const estimatedMinutes = options.gpu
    ? Math.ceil(totalDuration / 60 / 3) // ~3x realtime on GPU
    : Math.ceil(totalDuration / 60 / 0.5); // ~0.5x realtime on CPU
  console.log(`\n⏱️  Estimated processing time: ${formatDuration(estimatedMinutes * 60)}`);
  console.log();

  // Process each file
  const startTime = Date.now();
  const results: ProcessedFile[] = [];

  for (let i = 0; i < audioFiles.length; i++) {
    const result = await processFile(audioFiles[i], options, i, audioFiles.length);
    results.push(result);
  }

  // Final summary
  const totalTime = (Date.now() - startTime) / 1000;
  const successful = results.filter((r) => r.result?.success).length;
  const failed = results.filter((r) => r.error).length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 Final Summary');
  console.log('='.repeat(60));
  console.log(`  Files processed:    ${results.length}`);
  console.log(`  Successful:         ${successful}`);
  console.log(`  Failed:             ${failed}`);
  console.log(`  Total audio:        ${formatDuration(totalDuration)}`);
  console.log(`  Processing time:    ${formatDuration(totalTime)}`);
  console.log(`  Speed:              ${(totalDuration / totalTime).toFixed(2)}x realtime`);
  console.log(`  Output directory:   ${path.resolve(options.output)}`);

  if (failed > 0) {
    console.log('\n❌ Failed files:');
    results
      .filter((r) => r.error)
      .forEach((r) => {
        console.log(`  - ${path.basename(r.inputPath)}: ${r.error}`);
      });
    process.exit(1);
  }

  console.log('\n✅ All files processed successfully!');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
