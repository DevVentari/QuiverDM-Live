/**
 * BullMQ Queue for Feedback Triage
 * Vercel enqueues; local worker spawns `claude` and posts Discord embed.
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Queue } from 'bullmq';

function getRedisConnection() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

export interface FeedbackTriageJobData {
  feedbackId: string;
  threadId: string;
  type: string;
  description: string;
  pageUrl: string;
  consoleLogs: { ts: number; level: string; msg: string }[];
  issueUrl?: string;
}

export const feedbackTriageQueue = new Queue<FeedbackTriageJobData>(
  'feedback-triage',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { age: 24 * 3600 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addFeedbackTriageJob(data: FeedbackTriageJobData) {
  return feedbackTriageQueue.add(`triage-${data.feedbackId}`, data, {
    jobId: data.feedbackId,
  });
}
