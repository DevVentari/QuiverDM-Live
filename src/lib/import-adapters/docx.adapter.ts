import type { ImportAdapter, NormalizedDocument } from './types'
import { storage } from '@/lib/storage'

export const docxAdapter: ImportAdapter = {
  source: 'docx',

  async normalize(params) {
    const { fileKey, originalName } = params as { fileKey: string; originalName?: string }
    if (!fileKey) throw new Error('Docx adapter requires fileKey')

    const buffer = await storage.download(fileKey)
    const mammoth = await import('mammoth') as any
    const { value: markdown } = await mammoth.convertToMarkdown({ buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as any) })
    const title = originalName?.replace(/\.docx?$/i, '') ?? 'Imported Document'

    return [{ title, markdown, sourceId: fileKey }]
  },
}
