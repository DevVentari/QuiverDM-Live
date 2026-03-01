import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Queue } from 'bullmq';

function getRedisConnection() {
  // BullMQ workers require persistent blocking connections (LMPOP/BLMOVE).
  // Upstash serverless Redis doesn't support these — always use local Redis.
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

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
