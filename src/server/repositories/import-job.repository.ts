import { prisma } from '@/lib/prisma'

export async function createImportJob(data: {
  id: string
  userId: string
  campaignId?: string
  source: string
  metadata?: Record<string, unknown>
}) {
  return prisma.importJob.create({
    data: {
      id: data.id,
      userId: data.userId,
      campaignId: data.campaignId,
      source: data.source,
      status: 'pending',
      metadata: data.metadata ?? {},
    },
  })
}

export async function updateImportJobProgress(jobId: string, progress: number, total: number) {
  return prisma.importJob.update({
    where: { id: jobId },
    data: { progress, total, status: 'processing' },
  }).catch(() => {})
}

export async function completeImportJob(jobId: string) {
  return prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'complete' },
  }).catch(() => {})
}

export async function failImportJob(jobId: string, error: string) {
  return prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'failed', error },
  }).catch(() => {})
}

export async function findImportJob(jobId: string, userId: string) {
  return prisma.importJob.findUnique({
    where: { id: jobId },
  }).then((job) => (job?.userId === userId ? job : null))
}

export async function listImportJobs(userId: string, source?: string) {
  return prisma.importJob.findMany({
    where: { userId, ...(source ? { source } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}
