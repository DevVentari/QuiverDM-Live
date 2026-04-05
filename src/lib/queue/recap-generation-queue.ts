import 'dotenv/config';
import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface RecapGenerationJobData {
  recapId: string;
  transcriptId: string;
  campaignId: string;
  sessionId: string;
  style: string;
}

export interface RecapGenerationJobResult {
  success: boolean;
  recapId: string;
  tokensUsed?: number;
}

export const recapGenerationQueue = new Queue<RecapGenerationJobData, RecapGenerationJobResult>(
  'recap-generation',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  }
);
