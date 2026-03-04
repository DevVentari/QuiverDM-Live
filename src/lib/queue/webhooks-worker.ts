import 'dotenv/config';
import { Worker } from 'bullmq';
import { createHmac } from 'crypto';
import type { WebhookDeliveryData } from './webhooks-queue';

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
      enableOfflineQueue: false,
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

const worker = new Worker<WebhookDeliveryData>(
  'webhooks',
  async (job) => {
    const { url, secret, event, payload } = job.data;
    const body = JSON.stringify({
      event,
      payload,
      timestamp: Date.now(),
    });
    const signature = createHmac('sha256', secret).update(body).digest('hex');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-QuiverDM-Event': event,
        'X-QuiverDM-Signature': `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`Webhook delivery failed: ${res.status} ${res.statusText}`);
    }

    console.log(`[WebhooksWorker] Delivered ${event} to ${url}: ${res.status}`);
    return { status: res.status };
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 5,
  }
);

worker.on('failed', (job, err) => {
  console.error(
    `[WebhooksWorker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
    err.message
  );
});

worker.on('error', (error) => {
  console.error('[WebhooksWorker] Worker error:', error);
});

console.log('[WebhooksWorker] Worker started');

