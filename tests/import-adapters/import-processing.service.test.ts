import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  homebrewContent: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'hb-1' }),
    update: vi.fn().mockResolvedValue({ id: 'hb-1' }),
  },
}
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/ai/extraction', () => ({
  extractWithFallback: vi.fn().mockResolvedValue({
    success: true,
    items: [{ type: 'creature', name: 'Goblin', data: { hp: 7 } }],
    provider: 'gemini',
  }),
}))

describe('processDocument', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves pre-structured doc without calling AI', async () => {
    const { processDocument } = await import('@/lib/import-processing.service')
    const { extractWithFallback } = await import('@/lib/ai/extraction')
    const result = await processDocument(
      { title: 'Solithar', type: 'creature', data: { cr: 20 } },
      { userId: 'u1', jobId: 'j1', source: 'notion' }
    )
    expect(extractWithFallback).not.toHaveBeenCalled()
    expect(mockPrisma.homebrewContent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'creature', name: 'Solithar', sourceType: 'notion_import' }),
      })
    )
    expect(result.saved).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  it('calls AI extraction for markdown-only doc', async () => {
    const { processDocument } = await import('@/lib/import-processing.service')
    const { extractWithFallback } = await import('@/lib/ai/extraction')
    const result = await processDocument(
      { title: 'Goblin Lair', markdown: '# Goblin Lair\nA damp cave...' },
      { userId: 'u1', jobId: 'j1', source: 'obsidian' }
    )
    expect(extractWithFallback).toHaveBeenCalled()
    expect(result.saved).toBe(1)
  })

  it('returns error when no markdown and no data', async () => {
    const { processDocument } = await import('@/lib/import-processing.service')
    const result = await processDocument(
      { title: 'Empty' },
      { userId: 'u1', jobId: 'j1', source: 'notion' }
    )
    expect(result.saved).toBe(0)
    expect(result.errors).toHaveLength(1)
  })
})
