import { describe, it, expect, vi } from 'vitest'

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    getJob: vi.fn().mockResolvedValue(null),
    close: vi.fn(),
  })),
  QueueEvents: vi.fn().mockImplementation(() => ({ close: vi.fn() })),
}))

vi.mock('@/lib/queue/queue', () => ({
  getRedisConnection: vi.fn().mockReturnValue({ host: 'localhost', port: 6380, maxRetriesPerRequest: null }),
}))

describe('addImportJob', () => {
  it('enqueues with correct jobId', async () => {
    const { addImportJob, importJobQueue } = await import('@/lib/queue/import-job-queue')
    const spy = vi.spyOn(importJobQueue, 'add')
    await addImportJob({ jobId: 'abc', source: 'notion', userId: 'u1', params: {} })
    expect(spy).toHaveBeenCalledWith(
      'import-notion-abc',
      expect.objectContaining({ jobId: 'abc' }),
      { jobId: 'abc' }
    )
  })
})
