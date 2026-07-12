import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, type MultiTrackJobData, type ForgeRecapJobData } from '@quiverdm/shared';

/** Same queue + job options as the main app's src/lib/queue/multi-track-queue.ts. */
let queue: Queue<MultiTrackJobData> | null = null;

function getQueue(): Queue<MultiTrackJobData> {
  if (!queue) {
    const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
      // Fail loudly and fast when Redis is unreachable — with the offline
      // queue enabled, a bad REDIS_URL turns enqueue into an infinite hang.
      enableOfflineQueue: false,
      connectTimeout: 5_000,
    });
    queue = new Queue<MultiTrackJobData>(QUEUE_NAMES.multiTrack, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 86_400, count: 200 },
        removeOnFail: { age: 604_800 },
      },
    });
  }
  return queue;
}

export function addMultiTrackJob(data: MultiTrackJobData) {
  return getQueue().add(`multi-track-${data.uploadGroupId}`, data, {
    jobId: `multi-track-${data.uploadGroupId}`,
  });
}

/** Forge recap queue (P4) — recipe + prompt assembly for recap generation. */
let recapQueue: Queue<ForgeRecapJobData> | null = null;

function getRecapQueue(): Queue<ForgeRecapJobData> {
  if (!recapQueue) {
    const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      connectTimeout: 5_000,
    });
    recapQueue = new Queue<ForgeRecapJobData>(QUEUE_NAMES.forgeRecap, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 15_000 },
        removeOnComplete: { age: 86_400, count: 200 },
        removeOnFail: { age: 604_800 },
      },
    });
  }
  return recapQueue;
}

export function addForgeRecapJob(data: ForgeRecapJobData) {
  return getRecapQueue().add(`forge-recap-${data.sessionId}`, data, {
    jobId: `forge-recap-${data.sessionId}`,
  });
}
