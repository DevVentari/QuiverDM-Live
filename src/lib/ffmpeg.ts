import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

// Note: Requires ffmpeg to be installed on the system
// Windows: Download from https://ffmpeg.org/download.html or use: winget install ffmpeg
// macOS: brew install ffmpeg
// Linux: sudo apt-get install ffmpeg

export interface AudioChunk {
  path: string;
  index: number;
  duration: number;
}

/**
 * Extract audio from a video file with pre-processing for optimal transcription
 * Applies: normalization, noise reduction, mono conversion, and optimal sample rate
 */
export async function extractAudioFromVideo(
  videoPath: string,
  outputPath: string,
  enablePreprocessing: boolean = true
): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(videoPath);

    if (enablePreprocessing) {
      // Audio filters for optimal transcription quality:
      // 1. Loudness normalization (EBU R128 standard)
      // 2. Highpass filter at 200Hz (removes rumble)
      // 3. Lowpass filter at 3000Hz (focuses on speech range)
      command.audioFilters([
        'loudnorm=I=-16:TP=-1.5:LRA=11', // Normalize loudness
        'highpass=f=200',                // Remove low-frequency noise
        'lowpass=f=3000',                // Remove high-frequency noise
      ]);

      command.outputOptions([
        '-vn',               // No video
        '-ac 1',             // Mono (better for transcription)
        '-ar 16000',         // 16kHz sample rate (Whisper's native rate)
        '-acodec libmp3lame', // MP3 codec
        '-b:a 64k',          // 64kbps sufficient for mono speech
      ]);
    } else {
      // Legacy extraction without pre-processing
      command.outputOptions([
        '-vn',
        '-acodec libmp3lame',
        '-b:a 128k',
      ]);
    }

    command
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Pre-process existing audio file for transcription
 * Useful for audio files that were not extracted with extractAudioFromVideo
 */
export async function preprocessAudioForTranscription(
  inputPath: string,
  outputPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters([
        'loudnorm=I=-16:TP=-1.5:LRA=11',
        'highpass=f=200',
        'lowpass=f=3000',
      ])
      .outputOptions([
        '-ac 1',
        '-ar 16000',
        '-acodec libmp3lame',
        '-b:a 64k',
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Get duration of an audio/video file in seconds
 */
export async function getMediaDuration(filePath: string): Promise<number> {
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
 * Split audio file into chunks of specified duration (in seconds)
 * Each chunk will be under 25MB for Whisper API compatibility
 */
export async function splitAudioIntoChunks(
  audioPath: string,
  chunkDurationSeconds: number = 600, // 10 minutes per chunk
  outputDir: string
): Promise<AudioChunk[]> {
  const chunks: AudioChunk[] = [];
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
 * Clean up temporary files
 */
export async function cleanupFiles(filePaths: string[]): Promise<void> {
  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.error(`Failed to delete ${filePath}:`, err);
      }
    })
  );
}

/**
 * Process video file: extract audio and split into chunks
 */
export async function processVideoForTranscription(
  videoPath: string,
  workDir: string
): Promise<{ audioPath: string; chunks: AudioChunk[] }> {
  const audioPath = path.join(workDir, 'extracted_audio.mp3');
  const chunksDir = path.join(workDir, 'chunks');

  // Extract audio from video
  await extractAudioFromVideo(videoPath, audioPath);

  // Split audio into chunks
  const chunks = await splitAudioIntoChunks(audioPath, 600, chunksDir);

  return { audioPath, chunks };
}
