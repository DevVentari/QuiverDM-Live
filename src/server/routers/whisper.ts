import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Detect if file is video based on file signature
 */
function isVideoFile(buffer: Buffer): boolean {
  // Check common video file signatures
  const signatures = [
    [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // MP4
    [0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70], // MP4
    [0x1a, 0x45, 0xdf, 0xa3], // WebM/MKV
    [0x52, 0x49, 0x46, 0x46], // AVI (first 4 bytes of RIFF)
  ];

  for (const sig of signatures) {
    if (sig.every((byte, i) => buffer[i] === byte)) {
      return true;
    }
  }

  // Check for WebM specifically (more detailed)
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return true;
  }

  return false;
}

/**
 * Convert video to audio using ffmpeg
 */
async function convertVideoToAudio(videoBuffer: Buffer): Promise<Buffer> {
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `video-${Date.now()}.webm`);
  const outputPath = path.join(tempDir, `audio-${Date.now()}.mp3`);

  try {
    // Write video buffer to temp file
    await fs.writeFile(inputPath, videoBuffer);

    // Convert to audio using ffmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputPath);
    });

    // Read converted audio
    const audioBuffer = await fs.readFile(outputPath);

    // Cleanup temp files
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    return audioBuffer;
  } catch (error) {
    // Cleanup on error
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    throw error;
  }
}

export const whisperRouter = router({
  transcribe: publicProcedure
    .input(
      z.object({
        audioFile: z.string(), // base64 encoded audio or video file
        language: z.string().optional(), // optional language code (e.g., 'en')
        prompt: z.string().optional(), // optional prompt to guide transcription
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Convert base64 to Buffer
        let audioBuffer = Buffer.from(input.audioFile, 'base64');

        // Check if it's a video file and convert if needed
        if (isVideoFile(audioBuffer)) {
          console.log('Video file detected, converting to audio...');
          audioBuffer = await convertVideoToAudio(audioBuffer);
          console.log('Video converted to audio successfully');
        }

        // Create a File object from the buffer
        const file = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });

        // Call Whisper API
        const transcription = await openai.audio.transcriptions.create({
          file: file,
          model: 'whisper-1',
          language: input.language,
          prompt: input.prompt,
        });

        return {
          success: true,
          text: transcription.text,
        };
      } catch (error) {
        console.error('Whisper transcription error:', error);
        throw new Error(
          error instanceof Error ? error.message : 'Failed to transcribe audio'
        );
      }
    }),

  translate: publicProcedure
    .input(
      z.object({
        audioFile: z.string(), // base64 encoded audio or video file
        prompt: z.string().optional(), // optional prompt to guide translation
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Convert base64 to Buffer
        let audioBuffer = Buffer.from(input.audioFile, 'base64');

        // Check if it's a video file and convert if needed
        if (isVideoFile(audioBuffer)) {
          console.log('Video file detected, converting to audio...');
          audioBuffer = await convertVideoToAudio(audioBuffer);
          console.log('Video converted to audio successfully');
        }

        // Create a File object from the buffer
        const file = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });

        // Call Whisper API for translation (translates to English)
        const translation = await openai.audio.translations.create({
          file: file,
          model: 'whisper-1',
          prompt: input.prompt,
        });

        return {
          success: true,
          text: translation.text,
        };
      } catch (error) {
        console.error('Whisper translation error:', error);
        throw new Error(
          error instanceof Error ? error.message : 'Failed to translate audio'
        );
      }
    }),
});
