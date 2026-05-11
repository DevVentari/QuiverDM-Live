import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

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
