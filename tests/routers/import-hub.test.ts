import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-auth', () => ({ default: vi.fn(), getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))

vi.mock('@/server/repositories/import-job.repository', () => ({
  createImportJob: vi.fn().mockResolvedValue({ id: 'j1', status: 'pending', source: 'notion' }),
  findImportJob: vi.fn().mockResolvedValue({ id: 'j1', status: 'processing', progress: 5, total: 20, error: null }),
  listImportJobs: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/queue/import-job-queue', () => ({
  addImportJob: vi.fn().mockResolvedValue({ id: 'j1' }),
}))
vi.mock('@/server/repositories/source-credential.repository', () => ({
  upsertSourceCredential: vi.fn(),
  deleteSourceCredential: vi.fn(),
  listConnectedSources: vi.fn().mockResolvedValue(['notion']),
}))

describe('importHubRouter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('startImport creates a job and queues it', async () => {
    const { createImportJob } = await import('@/server/repositories/import-job.repository')
    const { addImportJob } = await import('@/lib/queue/import-job-queue')
    const { importHubRouter } = await import('@/server/routers/import-hub')
    const caller = importHubRouter.createCaller({ session: { user: { id: 'u1' } } } as any)
    const result = await caller.startImport({ source: 'notion', params: { pageIds: ['p1'] } })
    expect(createImportJob).toHaveBeenCalled()
    expect(addImportJob).toHaveBeenCalled()
    expect(result.jobId).toBeTruthy()
  })

  it('getJobStatus returns job for correct user', async () => {
    const { importHubRouter } = await import('@/server/routers/import-hub')
    const caller = importHubRouter.createCaller({ session: { user: { id: 'u1' } } } as any)
    const result = await caller.getJobStatus({ jobId: 'j1' })
    expect(result.status).toBe('processing')
    expect(result.progress).toBe(5)
  })
})
