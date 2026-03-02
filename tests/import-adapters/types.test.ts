import { describe, it, expect } from 'vitest'
import type { NormalizedDocument, ImportAdapter } from '@/lib/import-adapters/types'

describe('NormalizedDocument', () => {
  it('accepts markdown-only document', () => {
    const doc: NormalizedDocument = {
      title: 'Test',
      markdown: '# Hello',
    }
    expect(doc.title).toBe('Test')
  })

  it('accepts pre-structured document', () => {
    const doc: NormalizedDocument = {
      title: 'Solithar',
      type: 'creature',
      data: { name: 'Solithar', cr: 20 },
      sourceId: 'notion-page-123',
    }
    expect(doc.type).toBe('creature')
  })
})

describe('IMPORT_SOURCES', () => {
  it('contains all 8 sources', async () => {
    const { IMPORT_SOURCES } = await import('@/lib/import-adapters/types')
    expect(IMPORT_SOURCES).toContain('notion')
    expect(IMPORT_SOURCES).toContain('obsidian')
    expect(IMPORT_SOURCES).toContain('google_docs')
    expect(IMPORT_SOURCES).toContain('docx')
    expect(IMPORT_SOURCES).toContain('markdown_file')
    expect(IMPORT_SOURCES).toContain('world_anvil')
    expect(IMPORT_SOURCES).toContain('campfire')
    expect(IMPORT_SOURCES).toContain('kanka')
  })
})
