import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Enhanced audio preprocessing for difficult recording environments
 * Optimized for workshop/trade events with power tools, distant mics, muffled audio
 */

export type AudioPreset = 'workshop' | 'pocket' | 'outdoor' | 'conference' | 'standard';

export interface WorkshopPreprocessOptions {
  preset?: AudioPreset;
  outputDir?: string;
}

/**
 * Audio preprocessing presets for different recording environments
 */
export const AUDIO_PRESETS: Record<AudioPreset, {
  description: string;
  filters: string[];
}> = {
  workshop: {
    description: 'Power tools, industrial noise, multiple speakers (Makita Masters)',
    filters: [
      'highpass=f=100',                                    // Remove low rumble (motors, HVAC)
      'equalizer=f=2500:t=q:w=1.5:g=4',                   // Boost mid-highs (de-muffle)
      'equalizer=f=4000:t=q:w=1.0:g=3',                   // Boost high frequencies
      'agate=threshold=0.02:attack=10:release=100',       // Noise gate (linear threshold)
      'afftdn=nr=12:nf=-30:tn=1',                         // FFT noise reduction
      'acompressor=threshold=0.1:ratio=4:attack=5:release=50', // Dynamics (linear threshold)
      'loudnorm=I=-16:TP=-1.5:LRA=11',                    // Loudness normalization
      'lowpass=f=7500',                                   // Remove harsh highs
      'alimiter=limit=0.9:attack=5:release=50',           // Final limiting (linear)
    ],
  },
  pocket: {
    description: 'Phone in pocket, heavy muffling',
    filters: [
      'highpass=f=80',
      'equalizer=f=2000:t=q:w=2:g=6',                     // Stronger high boost
      'equalizer=f=4000:t=q:w=1.5:g=5',
      'equalizer=f=6000:t=q:w=1:g=3',
      'afftdn=nr=10:nf=-25:tn=1',
      'acompressor=threshold=0.18:ratio=3:attack=10:release=100',
      'loudnorm=I=-14:TP=-1.5:LRA=11',                    // Louder target
      'lowpass=f=8000',
    ],
  },
  outdoor: {
    description: 'Wind noise, variable ambient',
    filters: [
      'highpass=f=150',                                   // Higher cutoff for wind
      'afftdn=nr=8:nf=-25:tn=1',
      'acompressor=threshold=0.12:ratio=3:attack=20:release=100',
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      'lowpass=f=6000',
    ],
  },
  conference: {
    description: 'Echo, reverb, distant mic',
    filters: [
      'highpass=f=100',
      'afftdn=nr=6:nf=-28:tn=1',
      'acompressor=threshold=0.08:ratio=2.5:attack=15:release=80',
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      'lowpass=f=7000',
    ],
  },
  standard: {
    description: 'Standard preprocessing (same as existing ffmpeg.ts)',
    filters: [
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      'highpass=f=200',
      'lowpass=f=3000',
    ],
  },
};

/**
 * Preprocess audio file for optimal transcription with workshop-optimized filters
 *
 * @param inputPath - Path to input audio file (M4A, MP3, WAV, etc.)
 * @param options - Preprocessing options
 * @returns Path to preprocessed audio file
 */
export async function preprocessWorkshopAudio(
  inputPath: string,
  options: WorkshopPreprocessOptions = {}
): Promise<string> {
  const { preset = 'workshop', outputDir } = options;

  const presetConfig = AUDIO_PRESETS[preset];
  if (!presetConfig) {
    throw new Error(`Unknown audio preset: ${preset}`);
  }

  // Determine output path
  const inputBasename = path.basename(inputPath, path.extname(inputPath));
  const outputFolder = outputDir || path.dirname(inputPath);
  const outputPath = path.join(outputFolder, `${inputBasename}_preprocessed.mp3`);

  // Ensure output directory exists
  await fs.mkdir(outputFolder, { recursive: true });

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters(presetConfig.filters)
      .outputOptions([
        '-ac 1',             // Mono (better for transcription)
        '-ar 16000',         // 16kHz sample rate (Whisper's native rate)
        '-acodec libmp3lame', // MP3 codec
        '-b:a 64k',          // 64kbps sufficient for mono speech
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log(`  Applying ${preset} preset filters...`);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r  Preprocessing: ${progress.percent.toFixed(1)}%`);
        }
      })
      .on('end', () => {
        console.log(`\r  Preprocessing: 100% - Complete`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg preprocessing failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Get information about available audio presets
 */
export function getPresetInfo(preset?: AudioPreset): string {
  if (preset) {
    const config = AUDIO_PRESETS[preset];
    if (!config) {
      return `Unknown preset: ${preset}`;
    }
    return `${preset}: ${config.description}\n  Filters: ${config.filters.length}`;
  }

  // Return all presets
  return Object.entries(AUDIO_PRESETS)
    .map(([name, config]) => `  ${name}: ${config.description}`)
    .join('\n');
}

/**
 * Split audio file into chunks for processing
 * Reuses logic from ffmpeg.ts but with workshop preprocessing
 */
export async function splitWorkshopAudioIntoChunks(
  audioPath: string,
  chunkDurationSeconds: number = 600, // 10 minutes per chunk
  outputDir: string
): Promise<{ path: string; index: number; duration: number }[]> {
  const chunks: { path: string; index: number; duration: number }[] = [];

  // Get duration
  const duration = await getMediaDuration(audioPath);
  const numChunks = Math.ceil(duration / chunkDurationSeconds);

  await fs.mkdir(outputDir, { recursive: true });

  for (let i = 0; i < numChunks; i++) {
    const startTime = i * chunkDurationSeconds;
    const chunkPath = path.join(outputDir, `chunk_${i.toString().padStart(3, '0')}.mp3`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(audioPath)
        .setStartTime(startTime)
        .setDuration(chunkDurationSeconds)
        .outputOptions([
          '-acodec libmp3lame',
          '-b:a 128k',
        ])
        .output(chunkPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    chunks.push({
      path: chunkPath,
      index: i,
      duration: Math.min(chunkDurationSeconds, duration - startTime),
    });
  }

  return chunks;
}

/**
 * Get duration of an audio/video file in seconds
 */
export function getMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        resolve(metadata.format.duration || 0);
      }
    });
  });
}

/**
 * Clean up temporary files
 */
export async function cleanupWorkshopFiles(filePaths: string[]): Promise<void> {
  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        // Ignore errors for files that don't exist
      }
    })
  );
}
