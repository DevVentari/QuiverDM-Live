import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

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

export interface SessionEventsJobData {
  sessionId: string;
  campaignId: string;
  fromSegmentId?: string;
}

export interface SessionEventsJobResult {
  success: boolean;
  eventsExtracted: number;
  error?: string;
}

export const sessionEventsQueue = new Queue<SessionEventsJobData, SessionEventsJobResult>(
  'session-events',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 15000 },
      removeOnComplete: { age: 24 * 3600, count: 500 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addSessionEventsJob(data: SessionEventsJobData) {
  return sessionEventsQueue.add('extract-events', data, {
    jobId: `session-events-${data.sessionId}`,
  });
}
