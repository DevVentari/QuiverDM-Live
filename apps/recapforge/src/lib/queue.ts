import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, type MultiTrackJobData } from '@quiverdm/shared';

/** Same queue + job options as the main app's src/lib/queue/multi-track-queue.ts. */
let queue: Queue<MultiTrackJobData> | null = null;

function getQueue(): Queue<MultiTrackJobData> {
  if (!queue) {
    const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
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
