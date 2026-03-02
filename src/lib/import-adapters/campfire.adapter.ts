import type { ImportAdapter, NormalizedDocument, HomebrewContentType } from './types'
import { storage } from '@/lib/storage'

const TYPE_MAP: Record<string, HomebrewContentType> = {
  character: 'character', characters: 'character',
  location: 'location', locations: 'location',
  creature: 'creature', creatures: 'creature',
  item: 'item', items: 'item',
  lore: 'rule', timeline: 'rule', note: 'rule', notes: 'rule',
}

export const campfireAdapter: ImportAdapter = {
  source: 'campfire',

  async normalize(params) {
    const { fileKey } = params as { fileKey: string }
    if (!fileKey) throw new Error('Campfire adapter requires fileKey')

    const buffer = await storage.download(fileKey)
    const json = JSON.parse(Buffer.isBuffer(buffer) ? buffer.toString() : String(buffer))
    const docs: NormalizedDocument[] = []

    const processSection = (section: any[], typeName: string) => {
      const type = TYPE_MAP[typeName.toLowerCase()]
      for (const entity of section) {
        docs.push({
          title: entity.name ?? entity.title ?? 'Untitled',
          type,
          data: entity,
          tags: Array.isArray(entity.tags) ? entity.tags : [],
          sourceId: entity.id ? String(entity.id) : undefined,
        })
      }
    }

    if (Array.isArray(json)) {
      for (const item of json) {
        processSection([item], item.type ?? 'note')
      }
    } else {
      for (const [key, value] of Object.entries(json)) {
        if (Array.isArray(value)) processSection(value, key)
      }
    }

    return docs
  },
}
