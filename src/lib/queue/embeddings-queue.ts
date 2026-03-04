import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export type EmbeddingEntityType = 'transcript' | 'npc' | 'quest' | 'rules';

export interface EmbeddingJobData {
  entityId: string;
  entityType: EmbeddingEntityType;
  text: string;
  metadata: Record<string, unknown>;
  campaignId?: string;
}

export const embeddingsQueue = new Queue<EmbeddingJobData>('embeddings', {
  connection: getRedisConnection() as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function addEmbeddingJob(data: EmbeddingJobData) {
  return embeddingsQueue.add(`embed-${data.entityType}-${data.entityId}`, data, {
    jobId: `${data.entityType}-${data.entityId}`,
  });
}
