import type { ImportAdapter, NormalizedDocument } from './types'
import { storage } from '@/lib/storage'

export const markdownFileAdapter: ImportAdapter = {
  source: 'markdown_file',

  async normalize(params) {
    const { fileKey, originalName } = params as { fileKey: string; originalName?: string }
    if (!fileKey) throw new Error('Markdown file adapter requires fileKey')

    const buffer = await storage.download(fileKey)
    const markdown = Buffer.isBuffer(buffer) ? buffer.toString('utf-8') : String(buffer)
    const title = originalName?.replace(/\.md$/i, '') ?? 'Imported Markdown'

    return [{ title, markdown, sourceId: fileKey }]
  },
}
