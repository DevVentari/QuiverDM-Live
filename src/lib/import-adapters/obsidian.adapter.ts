import type { ImportAdapter, NormalizedDocument } from './types'

const VALID_TYPES = new Set([
  'item', 'creature', 'spell', 'location', 'subclass', 'feat',
  'rule', 'race', 'class', 'background', 'character',
])
import { storage } from '@/lib/storage'
import JSZip from 'jszip'
import matter from 'gray-matter'

export const obsidianAdapter: ImportAdapter = {
  source: 'obsidian',

  async normalize(params) {
    const { fileKey } = params as { fileKey: string }
    if (!fileKey) throw new Error('Obsidian adapter requires fileKey')

    const buffer = await storage.download(fileKey)
    const zip = await JSZip.loadAsync(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as any))
    const docs: NormalizedDocument[] = []

    for (const [filename, file] of Object.entries(zip.files)) {
      if ((file as any).dir || !filename.endsWith('.md')) continue
      const content = await (file as any).async('string')
      const { data: frontmatter, content: markdown } = matter(content)
      const name = filename.replace(/\.md$/, '').split('/').pop() ?? 'Untitled'

      docs.push({
        title: frontmatter.title ?? name,
        markdown: `# ${frontmatter.title ?? name}\n\n${markdown}`,
        type: VALID_TYPES.has(frontmatter.type) ? frontmatter.type : undefined,
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
        sourceId: filename,
      })
    }

    return docs
  },
}
