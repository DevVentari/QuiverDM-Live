/**
 * BullMQ Transcription Processing Queue
 *
 * Handles async audio/video → transcript processing via AssemblyAI.
 * Pattern follows src/lib/queue/queue.ts (PDF queue).
 */

import { Queue, QueueEvents } from 'bullmq';
import { getRedisConnection } from './queue';

const redisConnection = getRedisConnection();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranscriptionJobData {
  jobId: string; // TranscriptionJob DB record ID
  sessionId: string;
  recordingId?: string;
  userId: string;
  audioUrl: string; // Local file path or remote URL
  isVideo: boolean;
  speakerLabels: boolean;
  speakersExpected?: number;
  language?: string;
  wordBoost?: string[];
  deleteOriginalFile: boolean;
  fileUrl?: string; // Original file URL for deletion
  campaignId?: string;
}

export interface TranscriptionJobResult {
  success: boolean;
  transcriptId?: string;
  error?: string;
  processingTime?: number;
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export const transcriptionQueue = new Queue<TranscriptionJobData, TranscriptionJobResult>(
  'transcription-processing',
  {
    connection: redisConnection as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 500,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
      },
    },
  }
);

export const transcriptionQueueEvents = new QueueEvents('transcription-processing', {
  connection: redisConnection as any,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Add a transcription processing job to the queue.
 */
export async function addTranscriptionJob(data: TranscriptionJobData) {
  const job = await transcriptionQueue.add(
    `transcribe-${data.jobId}`,
    data,
    { jobId: data.jobId }
  );
  return job;
}

/**
 * Get job status and progress.
 */
export async function getTranscriptionJobStatus(jobId: string) {
  const job = await transcriptionQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  return {
    id: job.id,
    state,
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    returnvalue: job.returnvalue,
  };
}

/**
 * Cancel a transcription job.
 */
export async function cancelTranscriptionJob(jobId: string) {
  const job = await transcriptionQueue.getJob(jobId);
  if (job) {
    await job.remove();
    return true;
  }
  return false;
}
