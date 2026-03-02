import dotenv from 'dotenv'
dotenv.config({ override: true })

import { Worker, Job } from 'bullmq'
import { processDocument } from '@/lib/import-processing.service'
import {
  updateImportJobProgress,
  completeImportJob,
  failImportJob,
} from '@/server/repositories/import-job.repository'
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

const worker = new Worker<ImportJobMetadata>(
  'import-job',
  async (job: Job<ImportJobMetadata>) => {
    const { jobId, source, userId, campaignId, params } = job.data

    const { AdapterFactory } = await import('@/lib/import-adapters/index')
    const adapter = await AdapterFactory.create(source)
    const docs = await adapter.normalize(params)

    await updateImportJobProgress(jobId, 0, docs.length)

    let totalSaved = 0
    const allErrors: string[] = []

    for (let i = 0; i < docs.length; i++) {
      const { saved, errors } = await processDocument(docs[i], {
        userId,
        jobId,
        source,
        campaignId,
      })
      totalSaved += saved
      allErrors.push(...errors)
      await updateImportJobProgress(jobId, i + 1, docs.length)
    }

    await completeImportJob(jobId)
    return { saved: totalSaved, errors: allErrors }
  },
  {
    connection: getLocalRedis() as any,
    concurrency: 2,
  }
)

worker.on('failed', async (job, err) => {
  if (job) await failImportJob(job.data.jobId, err.message)
  console.error('[import-job-worker] job failed:', err)
})

console.log('[import-job-worker] listening...')
