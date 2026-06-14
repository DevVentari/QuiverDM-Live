import { Queue, QueueEvents } from 'bullmq'
import type { ImportJobMetadata } from '@/lib/import-adapters/types'

function getLocalRedis() {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  }
}
const redisConnection = getLocalRedis()

export const importJobQueue = new Queue<ImportJobMetadata>('import-job', {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
})

export const importJobQueueEvents = new QueueEvents('import-job', {
  connection: redisConnection as any,
})

export async function addImportJob(data: ImportJobMetadata) {
  return importJobQueue.add(`import-${data.source}-${data.jobId}`, data, {
    jobId: data.jobId,
  })
}
