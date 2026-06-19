import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface Session0PrepJobData {
  sessionId: string;
  campaignId: string;
  sourcebookId: string;
  sourcebookSlug: string;
  sourcebookTitle: string;
  campaignName: string;
}

export interface Session0PrepJobResult {
  success: boolean;
  error?: string;
}

export const session0PrepQueue = new Queue<Session0PrepJobData, Session0PrepJobResult>(
  'session0-prep',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { age: 24 * 3600, count: 200 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addSession0PrepJob(data: Session0PrepJobData) {
  return session0PrepQueue.add(`session0-${data.sessionId}`, data, {
    jobId: data.sessionId,
  });
}
