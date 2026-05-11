import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export type VisualAssetKind = 'campaign-banner' | 'campaign-emblem' | 'world-activity-thumb';

export interface VisualAssetJobData {
  kind: VisualAssetKind;
  campaignId: string;
  userId: string;
  worldEntryId?: string;
  promptHint?: string;
}

export interface VisualAssetJobResult {
  success: boolean;
  url?: string;
  error?: string;
}

export const visualAssetQueue = new Queue<VisualAssetJobData, VisualAssetJobResult>(
  'visual-assets',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 20000 },
      removeOnComplete: { age: 24 * 3600, count: 200 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function enqueueVisualAsset(data: VisualAssetJobData) {
  return visualAssetQueue.add(`${data.kind}:${data.campaignId}`, data);
}
