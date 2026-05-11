import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface SourcebookSceneExtractionJobData {
  pdfId: string;
  markdownContent: string;
}

export interface SourcebookSceneExtractionJobResult {
  scenesCreated: number;
  chaptersFound: number;
  tablesFound: number;
}

export const sourcebookSceneExtractionQueue = new Queue<
  SourcebookSceneExtractionJobData,
  SourcebookSceneExtractionJobResult
>('sourcebook-scene-extraction', {
  connection: getRedisConnection() as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: { age: 24 * 3600, count: 100 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function addSourcebookSceneExtractionJob(data: SourcebookSceneExtractionJobData) {
  return sourcebookSceneExtractionQueue.add(
    `sourcebook-extract-${data.pdfId}`,
    data,
    { jobId: `sourcebook-extract-${data.pdfId}` }
  );
}
