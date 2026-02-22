import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { chunkText, generateEmbedding } from '@/lib/ai/embeddings';
import { upsertEmbeddings } from '@/server/repositories/embedding.repository';
import type { EmbeddingJobData } from './embeddings-queue';

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

const worker = new Worker<EmbeddingJobData>(
  'embeddings',
  async (job) => {
    const { entityId, entityType, text, metadata, campaignId } = job.data;
    const chunks = chunkText(text);

    const embeddedChunks = await Promise.all(
      chunks.map(async (chunk, index) => ({
        text: chunk,
        index,
        vector: await generateEmbedding(chunk),
      }))
    );

    await upsertEmbeddings(entityId, entityType, embeddedChunks, metadata, campaignId);
    console.log(`[embeddings] Indexed ${embeddedChunks.length} chunks for ${entityType}:${entityId}`);
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 2,
  }
);

worker.on('failed', (job, err) => {
  console.error(`[embeddings] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[embeddings] Worker error:', err.message);
});

console.log('[embeddings] Worker started');
