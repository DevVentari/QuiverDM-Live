import dotenv from 'dotenv';
dotenv.config();

import { Worker } from 'bullmq';
import { seedSession0 } from '../../server/services/session0-seeder';
import type { Session0PrepJobData, Session0PrepJobResult } from './session0-prep-queue';

function getRedisConnection(): Record<string, unknown> {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const useTls = url.protocol === 'rediss:';
    return {
      host: url.hostname,
      port: parseInt(url.port || (useTls ? '6380' : '6379')),
      password: url.password || undefined,
      username: url.username !== 'default' ? url.username : undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      ...(useTls ? { tls: {} } : {}),
    };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

new Worker<Session0PrepJobData, Session0PrepJobResult>(
  'session0-prep',
  async (job) => {
    const { sessionId, campaignId, sourcebookSlug } = job.data;
    console.log(`[session0-prep] Seeding Session 0 for ${sessionId} (slug=${sourcebookSlug})`);
    try {
      const result = await seedSession0({ sessionId, campaignId, sourcebookSlug });
      console.log(`[session0-prep] Done: ${result.scenesCreated} scenes, tarokka=${result.tarokka}`);
      return { success: true };
    } catch (err) {
      console.error(`[session0-prep] Failed for session ${sessionId}:`, err);
      // Don't rethrow: leave prepStatus 'draft' so the DM can author manually.
      return { success: false, error: String(err) };
    }
  },
  { connection: getRedisConnection() as any, concurrency: 2 }
);

console.log('[session0-prep] Worker started');
