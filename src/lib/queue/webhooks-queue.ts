import { Queue } from 'bullmq';

function getRedisConnection() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

export interface WebhookDeliveryData {
  endpointId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
}

export const webhooksQueue = new Queue<WebhookDeliveryData>('webhooks', {
  connection: getRedisConnection() as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function addWebhookJob(data: WebhookDeliveryData) {
  return webhooksQueue.add(
    `webhook-${data.event}-${data.endpointId}-${Date.now()}`,
    data
  );
}

