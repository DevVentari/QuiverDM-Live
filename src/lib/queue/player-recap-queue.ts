/**
 * BullMQ Queue for Player Recap Generation
 */
import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface PlayerRecapJobData {
  sessionId: string;
  aiSummary: string;
  sessionTitle: string | null;
  sessionNumber: number;
}

export interface PlayerRecapJobResult {
  success: boolean;
  recap?: string;
  error?: string;
}

export const playerRecapQueue = new Queue<PlayerRecapJobData, PlayerRecapJobResult>(
  'player-recap',
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
