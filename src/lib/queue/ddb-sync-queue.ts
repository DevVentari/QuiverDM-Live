import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface DdbSyncCoordinatorJobData {
  sourcebookId: string;
  userId: string;
  isUpdateCheck: boolean;
}

export interface DdbChapterExtractJobData {
  chapterId: string;
  sourcebookId: string;
  userId: string;
  sourceSlug: string;
  chapterSlug: string;
  cobaltJwt: string; // short-lived JWT — for monster stat block API calls
  cobaltSessionEncrypted: string; // encrypted CobaltSession — for HTML page scraping (cookie auth)
  campaignIds: string[];
}

export interface DdbSyncReviewJobData {
  sourcebookId: string;
  userId: string;
  chaptersProcessed: number;
}

const connection = getRedisConnection() as any;

export const ddbSyncCoordinatorQueue = new Queue<DdbSyncCoordinatorJobData>('ddb-sourcebook-sync', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: { age: 24 * 3600, count: 50 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export const ddbChapterExtractQueue = new Queue<DdbChapterExtractJobData>('ddb-chapter-extract', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: { age: 24 * 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export const ddbSyncReviewQueue = new Queue<DdbSyncReviewJobData>('ddb-sync-review', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
    removeOnComplete: { age: 24 * 3600, count: 50 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function addDdbSyncJob(sourcebookId: string, userId: string, isUpdateCheck = false) {
  return ddbSyncCoordinatorQueue.add(
    `sync-${sourcebookId}`,
    { sourcebookId, userId, isUpdateCheck },
    { jobId: `sync-${sourcebookId}-${Date.now()}` }
  );
}
