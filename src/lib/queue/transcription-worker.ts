/**
 * BullMQ Transcription Worker
 *
 * Standalone process that picks up transcription jobs and processes them
 * via AssemblyAI. Run with: npm run worker:transcription
 *
 * Processing flow:
 * 1. Verify recording exists in DB
 * 2. Update TranscriptionJob status → processing
 * 3. If video: extract audio with ffmpeg
 * 4. Submit to AssemblyAI with speaker_labels + word_boost
 * 5. Poll status every 5s, update progress
 * 6. On complete: save transcript + increment usage
 * 7. Optionally delete original file
 * 8. Mark job as completed
 */

import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  submitAsyncTranscription,
  pollTranscriptionStatus,
  getAsyncResult,
} from '../transcription/assemblyai';
import {
  TranscriptionProgressTracker,
} from '../transcription/progress';
import { saveTranscript } from '../transcription/db';
import { extractAudioFromVideo } from '../ffmpeg';
import { deleteFromLocal, extractKeyFromLocalUrl, getAbsolutePathFromKey } from '../storage/local-storage';
import { deleteFromR2, extractKeyFromUrl } from '../storage/r2';
import { getSignedUrl } from '../storage';
import type { TranscriptionJobData, TranscriptionJobResult } from './transcription-queue';
import { addSessionEventsJob } from './session-events-queue';
import { addAiSummaryJob } from './ai-summary-queue';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Redis connection (same pattern as queue)
// ---------------------------------------------------------------------------

function getRedisConnection(): Record<string, unknown> {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const useTls = url.protocol === 'rediss:';
    return {
      host: url.hostname,
      port: parseInt(url.port || (useTls ? '6380' : '6379')),
      password: url.password || undefined,
      username: url.username !== 'default' ? url.username : undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      ...(useTls ? { tls: {} } : {}),
    };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

// ---------------------------------------------------------------------------
// Helper: sleep
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Helper: Resolve audio path
// ---------------------------------------------------------------------------

async function resolveAudioUrl(filePath: string): Promise<string> {
  // R2 storage path → generate signed URL (AssemblyAI fetches it directly)
  if (filePath.startsWith('/api/storage/')) {
    const key = filePath.replace(/^\/api\/storage\//, '');
    if (process.env.STORAGE_MODE === 'r2' || process.env.R2_BUCKET_NAME) {
      return await getSignedUrl(key, 3600);
    }
    return getAbsolutePathFromKey(key);
  }
  // Handle storage keys like session-recordings/...
  if (filePath.startsWith('session-recordings/') || filePath.startsWith('files/')) {
    if (process.env.STORAGE_MODE === 'r2' || process.env.R2_BUCKET_NAME) {
      return await getSignedUrl(filePath, 3600);
    }
    return getAbsolutePathFromKey(filePath);
  }
  // Already an https URL — pass through
  if (filePath.startsWith('https://') || filePath.startsWith('http://')) {
    return filePath;
  }
  return filePath;
}

// ---------------------------------------------------------------------------
// Main processing function
// ---------------------------------------------------------------------------

async function processTranscription(
  job: Job<TranscriptionJobData, TranscriptionJobResult>
): Promise<TranscriptionJobResult> {
  const startTime = Date.now();
  const data = job.data;

  console.log(`[TranscriptionWorker] Processing job ${data.jobId} for session ${data.sessionId}`);

  // 1. Verify recording exists (if specified)
  if (data.recordingId) {
    const recording = await prisma.sessionRecording.findUnique({
      where: { id: data.recordingId },
    });
    if (!recording) {
      throw new Error(`Recording ${data.recordingId} not found`);
    }
  }

  // 2. Create progress tracker
  const tracker = new TranscriptionProgressTracker(data.jobId, 1);
  await tracker.startProcessing();

  let audioFilePath = await resolveAudioUrl(data.audioUrl);
  let tempDir: string | null = null;

  try {
    // 3. If video, extract audio first
    if (data.isVideo) {
      await tracker.setStep('extracting_audio');
      await job.updateProgress(10);

      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quiverdm-transcription-'));
      const extractedAudioPath = path.join(tempDir, 'audio.mp3');

      console.log(`[TranscriptionWorker] Extracting audio from video: ${audioFilePath}`);
      await extractAudioFromVideo(audioFilePath, extractedAudioPath);
      audioFilePath = extractedAudioPath;
    }

    // 4. Submit to AssemblyAI
    await tracker.setStep('submitting_to_assemblyai');
    await job.updateProgress(20);

    console.log(`[TranscriptionWorker] Submitting to AssemblyAI: ${audioFilePath}`);

    const assemblyaiId = await submitAsyncTranscription({
      audioUrl: audioFilePath,
      speakerLabels: data.speakerLabels,
      speakersExpected: data.speakersExpected,
      language: data.language,
      wordBoost: data.wordBoost,
      boostParam: 'high',
    });

    console.log(`[TranscriptionWorker] AssemblyAI transcript ID: ${assemblyaiId}`);

    // Save the AssemblyAI ID in the DB for reference
    await prisma.transcriptionJob.update({
      where: { id: data.jobId },
      data: { assemblyaiTranscriptId: assemblyaiId },
    });

    // 5. Poll for completion
    await tracker.setStep('waiting_for_assemblyai');
    await job.updateProgress(30);

    let pollStatus = await pollTranscriptionStatus(assemblyaiId);
    let pollAttempts = 0;
    const maxPollAttempts = 360; // 30 minutes at 5s intervals

    while (pollStatus.status !== 'completed' && pollStatus.status !== 'error') {
      if (pollAttempts >= maxPollAttempts) {
        throw new Error('Transcription timed out after 30 minutes');
      }

      await sleep(5000);
      pollStatus = await pollTranscriptionStatus(assemblyaiId);
      pollAttempts++;

      // Map poll progress to 30-80% range
      const progressPct = 30 + Math.floor(pollStatus.percentComplete * 0.5);
      await tracker.updateWithSubstep(
        `AssemblyAI: ${pollStatus.status}`,
        progressPct,
        { assemblyaiStatus: pollStatus.status, pollAttempts }
      );
      await job.updateProgress(progressPct);
    }

    if (pollStatus.status === 'error') {
      throw new Error(`AssemblyAI error: ${pollStatus.error || 'Unknown error'}`);
    }

    // 6. Download result
    await tracker.setStep('downloading_result');
    await job.updateProgress(85);

    console.log(`[TranscriptionWorker] Downloading result for ${assemblyaiId}`);
    const result = await getAsyncResult(assemblyaiId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to get transcription result');
    }

    // 7. Save transcript
    await tracker.setStep('saving');
    await job.updateProgress(90);

    const transcriptId = await saveTranscript({
      sessionId: data.sessionId,
      recordingId: data.recordingId,
      result,
    });

    console.log(`[TranscriptionWorker] Transcript saved: ${transcriptId}`);

    // Enqueue session events extraction
    {
      let campaignId = data.campaignId ?? '';
      if (!campaignId) {
        const sess = await prisma.gameSession.findUnique({
          where: { id: data.sessionId },
          select: { campaignId: true },
        });
        campaignId = sess?.campaignId ?? '';
      }
      addSessionEventsJob({ sessionId: data.sessionId, campaignId }).catch(() => undefined);
    }

    // Auto-trigger AI summary if not already generated
    {
      const sessionForSummary = await prisma.gameSession.findUnique({
        where: { id: data.sessionId },
        select: {
          aiSummaryStatus: true,
          title: true,
          sessionNumber: true,
          campaign: { select: { userId: true } },
          transcripts: {
            select: { rawText: true, source: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      if (sessionForSummary?.aiSummaryStatus === 'none') {
        const transcriptText = sessionForSummary.transcripts[0]?.rawText ?? '';
        const transcriptSource = sessionForSummary.transcripts[0]?.source ?? 'upload';
        if (transcriptText.trim()) {
          await prisma.gameSession.update({
            where: { id: data.sessionId },
            data: { aiSummaryStatus: 'pending' },
          });
          addAiSummaryJob({
            jobId: data.sessionId,
            sessionId: data.sessionId,
            userId: sessionForSummary.campaign.userId,
            transcriptText,
            transcriptSource,
            sessionTitle: sessionForSummary.title ?? `Session ${sessionForSummary.sessionNumber}`,
            sessionNumber: sessionForSummary.sessionNumber,
          }).catch(() => undefined);
        }
      }
    }

    // 8. Delete original file if requested
    if (data.deleteOriginalFile && data.fileUrl) {
      try {
        if (data.fileUrl.startsWith('/api/storage/')) {
          const key = extractKeyFromLocalUrl(data.fileUrl);
          await deleteFromLocal(key);
        } else if (data.fileUrl.includes('.r2.cloudflarestorage.com')) {
          const key = extractKeyFromUrl(data.fileUrl);
          await deleteFromR2(key);
        }

        if (data.recordingId) {
          await prisma.sessionRecording.update({
            where: { id: data.recordingId },
            data: {
              originalDeleted: true,
              processingStatus: 'completed',
            },
          });
        }
      } catch (err) {
        console.warn('[TranscriptionWorker] Failed to delete original file:', err);
      }
    }

    // Mark recording as completed
    if (data.recordingId) {
      await prisma.sessionRecording.update({
        where: { id: data.recordingId },
        data: { processingStatus: 'completed' },
      });
    }

    // Complete
    await tracker.complete(transcriptId);
    await job.updateProgress(100);

    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`[TranscriptionWorker] Job ${data.jobId} completed in ${processingTime.toFixed(1)}s`);

    return {
      success: true,
      transcriptId,
      processingTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[TranscriptionWorker] Job ${data.jobId} failed:`, errorMessage);

    await tracker.fail(errorMessage);

    if (data.recordingId) {
      await prisma.sessionRecording.update({
        where: { id: data.recordingId },
        data: {
          processingStatus: 'failed',
          errorMessage,
        },
      });
    }

    throw error;
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Worker setup
// ---------------------------------------------------------------------------

const worker = new Worker<TranscriptionJobData, TranscriptionJobResult>(
  'transcription-processing',
  processTranscription,
  {
    connection: getRedisConnection() as any,
    concurrency: 2,
    limiter: {
      max: 5,
      duration: 60000, // Max 5 jobs per minute
    },
  }
);

worker.on('completed', (job, result) => {
  console.log(`[TranscriptionWorker] Job ${job.id} completed:`, result?.transcriptId);
});

worker.on('failed', (job, error) => {
  console.error(`[TranscriptionWorker] Job ${job?.id} failed:`, error.message);
});

worker.on('error', (error) => {
  console.error('[TranscriptionWorker] Worker error:', error);
});

console.log('[TranscriptionWorker] Worker started, waiting for jobs...');

// Graceful shutdown
async function shutdown() {
  console.log('[TranscriptionWorker] Shutting down...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
