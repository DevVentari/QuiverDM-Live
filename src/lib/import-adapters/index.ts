import type { ImportAdapter, ImportSource } from './types'

type AdapterFactory = () => Promise<ImportAdapter>
const ADAPTER_MAP = new Map<ImportSource, AdapterFactory>()

export const AdapterFactory = {
  register(source: ImportSource, factory: AdapterFactory) {
    ADAPTER_MAP.set(source, factory)
  },

  async create(source: ImportSource): Promise<ImportAdapter> {
    const factory = ADAPTER_MAP.get(source)
    if (!factory) throw new Error(`No adapter registered for source: ${source}`)
    return factory()
  },
}

AdapterFactory.register('notion', async () => (await import('./notion.adapter')).notionAdapter)
AdapterFactory.register('obsidian', async () => (await import('./obsidian.adapter')).obsidianAdapter)
AdapterFactory.register('google_docs', async () => (await import('./google-docs.adapter')).googleDocsAdapter)
AdapterFactory.register('docx', async () => (await import('./docx.adapter')).docxAdapter)
AdapterFactory.register('markdown_file', async () => (await import('./markdown-file.adapter')).markdownFileAdapter)
AdapterFactory.register('world_anvil', async () => (await import('./world-anvil.adapter')).worldAnvilAdapter)
AdapterFactory.register('campfire', async () => (await import('./campfire.adapter')).campfireAdapter)
AdapterFactory.register('kanka', async () => (await import('./kanka.adapter')).kankaAdapter)
