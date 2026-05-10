/**
 * Meili Sync Queue
 *
 * Fans out create/update/delete events for campaigns, sessions, world entities,
 * and world entries into MeiliSearch. Producers should call enqueueMeiliSync
 * fire-and-forget — sync failures must never break user-facing CRUD.
 *
 * The two original indexes (homebrew_content, npcs) still use direct calls in
 * src/lib/search.ts and are intentionally NOT routed through this queue.
 */

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export type MeiliSyncKind =
  | 'campaign'
  | 'session'
  | 'world_entity'
  | 'world_entry';

export type MeiliSyncOp = 'upsert' | 'delete';

export interface MeiliSyncJobData {
  kind: MeiliSyncKind;
  op: MeiliSyncOp;
  id: string;
}

export const MEILI_SYNC_QUEUE_NAME = 'meili-sync';

export const meiliSyncQueue = new Queue<MeiliSyncJobData>(MEILI_SYNC_QUEUE_NAME, {
  connection: getRedisConnection() as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function enqueueMeiliSync(data: MeiliSyncJobData) {
  return meiliSyncQueue.add(`${data.kind}-${data.op}-${data.id}`, data, {
    jobId: `${data.kind}-${data.id}-${data.op}`,
  });
}

/**
 * Fire-and-forget enqueue helper for use from request paths.
 * Logs and swallows enqueue failures so a Redis hiccup never breaks CRUD.
 */
export function enqueueMeiliSyncSafe(data: MeiliSyncJobData): void {
  void enqueueMeiliSync(data).catch((err) => {
    console.warn('[MeiliSync] enqueue failed:', err);
  });
}
