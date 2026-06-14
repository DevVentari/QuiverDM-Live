import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('notionAdapter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pre-classifies NPC pages as creature', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          properties: { title: { title: [{ plain_text: 'Solithar' }] } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'A powerful deity.' }] } }],
          has_more: false,
        }),
      })

    const { notionAdapter } = await import('@/lib/import-adapters/notion.adapter')
    const docs = await notionAdapter.normalize({
      pageIds: ['page-1'],
      token: 'secret_test',
      parentTitle: 'NPCs',
    })

    expect(docs).toHaveLength(1)
    expect(docs[0].title).toBe('Solithar')
    expect(docs[0].type).toBe('creature')
    expect(docs[0].markdown).toContain('A powerful deity.')
  })

  it('throws if token is missing', async () => {
    const { notionAdapter } = await import('@/lib/import-adapters/notion.adapter')
    await expect(notionAdapter.normalize({ pageIds: ['p1'], token: '' })).rejects.toThrow('token')
  })
})
