/**
 * BullMQ Queue for Map Generation Jobs
 */
import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export type MapGenerationTarget =
  | { kind: 'campaignMap'; id: string }
  | { kind: 'encounter'; id: string };

export interface MapGenerationJobData {
  target: MapGenerationTarget;
  campaignId: string;
  prompt: string;
}

export interface MapGenerationJobResult {
  success: boolean;
  backgroundUrl?: string;
  error?: string;
}

export const mapGenerationQueue = new Queue<MapGenerationJobData, MapGenerationJobResult>(
  'map-generation',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addMapGenerationJob(data: MapGenerationJobData) {
  const jobId = `map-gen-${data.target.kind}-${data.target.id}`;
  return mapGenerationQueue.add(jobId, data, { jobId });
}
