import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  importJob: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

describe('import-job repository', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createImportJob writes correct fields', async () => {
    mockPrisma.importJob.create.mockResolvedValue({ id: 'job-1', status: 'pending' })
    const { createImportJob } = await import('@/server/repositories/import-job.repository')
    const result = await createImportJob({ id: 'job-1', userId: 'u1', source: 'notion', metadata: { pageIds: ['p1'] } })
    expect(mockPrisma.importJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 'job-1', userId: 'u1', source: 'notion', status: 'pending' }),
    })
    expect(result.status).toBe('pending')
  })

  it('updateImportJobProgress patches progress and status', async () => {
    mockPrisma.importJob.update.mockResolvedValue({})
    const { updateImportJobProgress } = await import('@/server/repositories/import-job.repository')
    await updateImportJobProgress('job-1', 5, 20)
    expect(mockPrisma.importJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { progress: 5, total: 20, status: 'processing' },
    })
  })

  it('findImportJob returns null for wrong userId', async () => {
    mockPrisma.importJob.findUnique.mockResolvedValue({ id: 'j1', userId: 'u1' })
    const { findImportJob } = await import('@/server/repositories/import-job.repository')
    const result = await findImportJob('j1', 'u2')
    expect(result).toBeNull()
  })
})
