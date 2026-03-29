---
name: quiverdm-worker
description: Use when adding a new BullMQ background worker to QuiverDM — creating queue file, worker file, npm script registration, or debugging worker startup issues.
---

# QuiverDM Worker Pattern

Two-file BullMQ pattern: queue definition + worker processor. Each worker runs as a separate process.

## Files to Create

| File | Purpose |
|---|---|
| `src/lib/queue/<name>-queue.ts` | Queue instance, job data type, add helper |
| `src/lib/queue/<name>-worker.ts` | Worker processor (standalone process) |

Then add npm script + optional index export.

## Queue File

```typescript
import { Queue } from 'bullmq';

function getRedisConnection() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null, // required by BullMQ
    lazyConnect: true,
  };
}

export interface MyJobData {
  id: string;
  // ... typed payload
}

export const myQueue = new Queue<MyJobData>('my-queue', {
  connection: getRedisConnection() as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function addMyJob(data: MyJobData) {
  return myQueue.add(`my-job-${data.id}-${Date.now()}`, data);
}
```

## Worker File

```typescript
import 'dotenv/config'; // must be first — runs as standalone process
import { Worker } from 'bullmq';
import type { MyJobData } from './my-queue';

function getRedisConnection() { /* same as queue file */ }

const worker = new Worker<MyJobData>(
  'my-queue', // must exactly match Queue name
  async (job) => {
    const { id } = job.data;
    // ... process job
    console.log(`[MyWorker] Processed ${id}`);
    return { success: true };
  },
  { connection: getRedisConnection() as any, concurrency: 5 }
);

worker.on('failed', (job, err) => {
  console.error(`[MyWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

worker.on('error', (error) => {
  console.error('[MyWorker] Worker error:', error);
});

console.log('[MyWorker] Worker started');
```

## Registration

**package.json:**
```json
"worker:name": "tsx src/lib/queue/name-worker.ts"
```

**src/lib/queue/index.ts** (if queue needs to be imported elsewhere):
```typescript
export * from './my-queue';
```

## Existing Workers

| Script | File | Queue Name |
|---|---|---|
| `worker:pdf` | `worker.ts` | pdf |
| `worker:transcription` | `transcription-worker.ts` | transcription |
| `worker:image` | `image-generation-worker.ts` | image-generation |
| `worker:webhooks` | `webhooks-worker.ts` | webhooks |
| `worker:summary` | `ai-summary-worker.ts` | ai-summary |
| `worker:embeddings` | `embeddings-worker.ts` | embeddings |

## Common Mistakes

- Queue name string must match exactly between queue and worker (silent failure if not)
- `maxRetriesPerRequest: null` is required — BullMQ throws without it
- `import 'dotenv/config'` must be at the top of worker — it runs as a standalone Node process
- Do NOT import worker files into Next.js app — they use Node APIs incompatible with the edge/browser
