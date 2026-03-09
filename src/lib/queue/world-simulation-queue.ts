import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface WorldSimulationJobData {
  campaignId: string;
}

export interface WorldSimulationJobResult {
  success: boolean;
  eventsCreated: number;
  thresholdTriggered: boolean;
  error?: string;
}

export const worldSimulationQueue = new Queue<WorldSimulationJobData, WorldSimulationJobResult>(
  'world-simulation',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
      removeOnComplete: { age: 24 * 3600, count: 200 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addWorldSimulationJob(data: WorldSimulationJobData) {
  return worldSimulationQueue.add(`world-sim-${data.campaignId}-${Date.now()}`, data, {
    jobId: `world-sim-${data.campaignId}-${Date.now()}`,
  });
}
