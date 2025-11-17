import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  processVideoForTranscription,
  cleanupFiles,
} from '@/lib/ffmpeg';
import {
  transcribeChunksWithWhisperX,
  checkWhisperXAvailability,
  type WhisperXOptions,
  type ProgressEvent,
} from '@/lib/whisperx';
import {
  createTranscriptionJob,
  updateTranscriptionProgress,
  getTranscriptionProgress,
  getTranscriptionProgressBySessionId,
  TranscriptionProgressTracker,
} from '@/lib/transcription-progress';
import { saveTranscript } from '@/lib/transcription-db';
import { deleteFromLocal, extractKeyFromLocalUrl, getAbsolutePathFromKey } from '@/lib/local-storage';
import { deleteFromR2, extractKeyFromUrl } from '@/lib/r2-storage';
import { prisma } from '@/lib/prisma';
import { verifySessionOwnership, verifyRecordingOwnership } from '../lib/ownership';

export const sessionTranscriptionRouter = router({
  /**
   * Check if WhisperX is available
   */
  checkLocalWhisper: protectedProcedure.query(async () => {
    return await checkWhisperXAvailability();
  }),

  /**
   * Transcribe a D&D session video/audio file using WhisperX
   * Supports optional speaker diarization
   * Automatically deletes original video file after successful transcription
   */
  transcribeSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        recordingId: z.string().optional(),
        filePath: z.string(),
        fileUrl: z.string().optional(), // Original file URL to delete after transcription
        modelSize: z
          .enum(['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3'])
          .default('medium'),
        language: z.string().optional(),
        useGPU: z.boolean().default(true),
        useSpeakers: z.boolean().default(false),
        numSpeakers: z.number().optional(),
        minSpeakers: z.number().default(1),
        maxSpeakers: z.number().default(8),
        speakerNames: z.array(z.string()).optional(),
        batchSize: z.number().default(16),
        deleteOriginalFile: z.boolean().default(true), // Auto-delete video after transcription
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifySessionOwnership(input.sessionId, userId);
      await verifyRecordingOwnership(input.recordingId, userId);
      const {
        sessionId,
        recordingId,
        filePath,
        fileUrl,
        modelSize,
        language,
        useGPU,
        useSpeakers,
        numSpeakers,
        minSpeakers,
        maxSpeakers,
        speakerNames,
        batchSize,
        deleteOriginalFile,
      } = input;

      // Create transcription job for progress tracking
      const jobId = await createTranscriptionJob({
        sessionId,
        recordingId,
        filePath,
        modelSize,
        language,
        useGPU,
        useSpeakers,
        speakerNames,
        numSpeakers,
      });

      // Create temporary work directory
      const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quiverdm-'));

      try {
        // Resolve absolute path if filePath looks like a key
        let resolvedFilePath = filePath;
        if (!filePath.includes('\\') && !filePath.includes('/')) {
          // Looks like a key, resolve it
          resolvedFilePath = getAbsolutePathFromKey(filePath);
        } else if (filePath.startsWith('session-recordings/')) {
          // Also resolve if it's a relative storage path
          resolvedFilePath = getAbsolutePathFromKey(filePath);
        }

        // Check if file exists
        await fs.access(resolvedFilePath);

        // Update filePath for the rest of the function
        const actualFilePath = resolvedFilePath;

        console.log('Processing video file:', actualFilePath);

        // Update progress: extracting audio
        await updateTranscriptionProgress(jobId, {
          status: 'processing',
          currentStep: 'extracting_audio',
        });

        // Extract audio and split into chunks
        const { audioPath, chunks } = await processVideoForTranscription(
          actualFilePath,
          workDir
        );

        console.log(`Created ${chunks.length} audio chunks`);

        // Create progress tracker
        const tracker = new TranscriptionProgressTracker(jobId, chunks.length);
        await tracker.setStep('splitting_chunks');
        await tracker.startProcessing();

        // Update: transcribing (and diarizing if enabled)
        await tracker.setStep(useSpeakers ? 'diarizing' : 'transcribing');

        // Create progress callback to handle real-time updates from Python
        const onProgress = async (event: ProgressEvent) => {
          await tracker.handleProgressEvent(event);
        };

        // Transcribe all chunks using WhisperX
        const options: WhisperXOptions = {
          modelSize,
          language,
          device: useGPU ? 'cuda' : 'cpu',
          computeType: useGPU ? 'float16' : 'int8',
          batchSize,
          // Speaker diarization options (only used if useSpeakers is true)
          ...(useSpeakers && {
            speakerNames,
            numSpeakers,
            minSpeakers,
            maxSpeakers,
          }),
          // Real-time progress callback
          onProgress,
        };

        // Track progress during transcription
        const chunkPaths = chunks.map((c) => c.path);
        const result = await transcribeChunksWithWhisperX(chunkPaths, options);

        // Cleanup temporary files
        await cleanupFiles([audioPath, ...chunks.map((c) => c.path)]);
        await fs.rm(workDir, { recursive: true, force: true });

        if (!result.success) {
          await tracker.fail(result.error || 'Transcription failed');
          throw new Error(result.error || 'Transcription failed');
        }

        // Save to database
        await tracker.setStep('saving');
        const transcriptId = await saveTranscript({
          sessionId,
          recordingId,
          result,
        });

        // Delete original video file if requested (default: true)
        if (deleteOriginalFile && fileUrl) {
          try {
            console.log('Deleting original video file:', fileUrl);

            // Determine if it's local storage or R2
            if (fileUrl.startsWith('/api/storage/')) {
              const key = extractKeyFromLocalUrl(fileUrl);
              await deleteFromLocal(key);
              console.log('Original video deleted from local storage:', key);
            } else if (fileUrl.includes('.r2.cloudflarestorage.com')) {
              const key = extractKeyFromUrl(fileUrl);
              await deleteFromR2(key);
              console.log('Original video deleted from R2:', key);
            }

            // Update SessionRecording in database to mark original as deleted
            if (recordingId) {
              await prisma.sessionRecording.update({
                where: { id: recordingId },
                data: {
                  originalDeleted: true,
                  processingStatus: 'completed',
                },
              });
              console.log('SessionRecording updated: originalDeleted = true');
            }
          } catch (error) {
            console.error('Failed to delete original video file:', error);
            // Don't fail the entire transcription if cleanup fails
          }
        }

        // Mark as completed
        await tracker.complete(transcriptId);

        return {
          success: true,
          jobId,
          transcriptId,
          transcription: result.text,
          transcriptionWithSpeakers: result.textWithSpeakers || undefined,
          segments: result.segments,
          language: result.language,
          duration: result.duration,
          hasSpeakers: result.hasSpeakers,
          speakers: result.speakers || undefined,
          chunks: chunks.length,
          deletedOriginalFile: deleteOriginalFile && !!fileUrl,
        };
      } catch (error) {
        // Cleanup on error
        await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});

        console.error('Transcription error:', error);

        // Update job as failed
        await updateTranscriptionProgress(jobId, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        throw new Error(
          error instanceof Error ? error.message : 'Failed to transcribe session'
        );
      }
    }),

  /**
   * Get transcription progress by job ID
   */
  getTranscriptionProgress: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const progress = await getTranscriptionProgress(input.jobId);
      if (!progress) {
        throw new Error('Transcription job not found');
      }
      return progress;
    }),

  /**
   * Get all transcription jobs for a session
   */
  getSessionTranscriptionJobs: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifySessionOwnership(input.sessionId, userId);
      return await getTranscriptionProgressBySessionId(input.sessionId);
    }),
});
