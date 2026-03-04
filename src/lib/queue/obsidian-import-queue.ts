import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface ObsidianImportJobData {
  jobId: string;
  campaignId: string;
  userId: string;
  zipPath: string;
  options: {
    npcs: boolean;
    sessions: boolean;
    characters: boolean;
    homebrew: boolean;
  };
}

export const obsidianImportQueue = new Queue<ObsidianImportJobData>(
  'obsidian-import',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 24 * 3600 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addObsidianImportJob(data: ObsidianImportJobData) {
  return obsidianImportQueue.add(`import-${data.jobId}`, data, {
    jobId: data.jobId,
  });
}
