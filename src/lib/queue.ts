/**
 * BullMQ Job Queue Configuration
 *
 * Provides durable background job processing with Redis
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import Redis from 'ioredis';

// Redis connection configuration
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6380'),
  maxRetriesPerRequest: null, // Required for BullMQ
};

// Create Redis connection for testing
export const redis = new Redis(redisConnection);

/**
 * PDF Processing Job Data
 */
export interface PDFProcessingJobData {
  pdfId: string;
  userId: string;
  campaignId: string;
  r2Key: string;
  filename: string;
  options: {
    useLLM: boolean; // Use LLM for Marker PDF vision (expensive)
    useAIExtraction?: boolean; // Use AI to extract D&D content from markdown (cheap)
    llmProvider?: 'gemini' | 'anthropic' | 'openai';
  };
}

/**
 * PDF Processing Job Result
 */
export interface PDFProcessingJobResult {
  success: boolean;
  markdownPath?: string;
  markdownContent?: string;
  error?: string;
  processingTime?: number;
}

/**
 * PDF Processing Queue
 *
 * Handles asynchronous PDF → Markdown conversion with Marker
 */
export const pdfProcessingQueue = new Queue<PDFProcessingJobData, PDFProcessingJobResult>(
  'pdf-processing',
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3, // Retry up to 3 times on failure
      backoff: {
        type: 'exponential',
        delay: 5000, // Start with 5 second delay, doubles each attempt
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
  }
);

/**
 * Queue Events for monitoring
 */
export const pdfProcessingQueueEvents = new QueueEvents('pdf-processing', {
  connection: redisConnection,
});

/**
 * Add a PDF processing job to the queue
 */
export async function addPDFProcessingJob(data: PDFProcessingJobData) {
  const job = await pdfProcessingQueue.add(`process-pdf-${data.pdfId}`, data, {
    jobId: data.pdfId, // Use PDF ID as job ID for idempotency
  });

  return job;
}

/**
 * Get job status and progress
 */
export async function getPDFProcessingJobStatus(pdfId: string) {
  const job = await pdfProcessingQueue.getJob(pdfId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    returnvalue: job.returnvalue,
  };
}

/**
 * Cancel a PDF processing job
 */
export async function cancelPDFProcessingJob(pdfId: string) {
  const job = await pdfProcessingQueue.getJob(pdfId);

  if (job) {
    await job.remove();
    return true;
  }

  return false;
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    pdfProcessingQueue.getWaitingCount(),
    pdfProcessingQueue.getActiveCount(),
    pdfProcessingQueue.getCompletedCount(),
    pdfProcessingQueue.getFailedCount(),
    pdfProcessingQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Clean up old jobs (maintenance function)
 */
export async function cleanQueue() {
  await pdfProcessingQueue.clean(24 * 3600 * 1000, 1000, 'completed'); // 24 hours
  await pdfProcessingQueue.clean(7 * 24 * 3600 * 1000, 100, 'failed'); // 7 days
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('Shutting down PDF processing queue...');
  await pdfProcessingQueue.close();
  await pdfProcessingQueueEvents.close();
  await redis.quit();
  console.log('Queue shutdown complete');
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
