export const IMPORT_SOURCES = [
  'notion',
  'obsidian',
  'google_docs',
  'docx',
  'markdown_file',
  'world_anvil',
  'campfire',
  'kanka',
] as const

export type ImportSource = (typeof IMPORT_SOURCES)[number]

export type HomebrewContentType =
  | 'item'
  | 'creature'
  | 'spell'
  | 'location'
  | 'subclass'
  | 'feat'
  | 'rule'
  | 'race'
  | 'class'
  | 'background'
  | 'character'

export interface NormalizedDocument {
  title: string
  markdown?: string
  type?: HomebrewContentType
  data?: Record<string, unknown>
  tags?: string[]
  sourceId?: string
  sourceUrl?: string
}

export interface ImportAdapter {
  source: ImportSource
  normalize(params: Record<string, unknown>): Promise<NormalizedDocument[]>
}

export interface ImportJobMetadata {
  source: ImportSource
  userId: string
  campaignId?: string
  jobId: string
  params: Record<string, unknown>
}
