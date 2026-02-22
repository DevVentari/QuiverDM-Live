import { Queue } from 'bullmq';

function getRedisConnection() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT || '6380', 10),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

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
