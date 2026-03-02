import type { ImportAdapter, NormalizedDocument } from './types'

function extractDocId(url: string): string | null {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  return match?.[1] ?? null
}

export const googleDocsAdapter: ImportAdapter = {
  source: 'google_docs',

  async normalize(params) {
    const { docUrl, token } = params as { docUrl: string; token?: string }
    if (!docUrl) throw new Error('Google Docs adapter requires docUrl')

    const docId = extractDocId(docUrl)
    if (!docId) throw new Error(`Cannot extract doc ID from URL: ${docUrl}`)

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`
    const res = await fetch(exportUrl, { headers })
    if (!res.ok) throw new Error(`Failed to fetch Google Doc: ${res.status}`)

    const text = await res.text()
    return [{ title: docId, markdown: text, sourceId: docId, sourceUrl: docUrl }]
  },
}
