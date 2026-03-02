import type { ImportAdapter, NormalizedDocument, HomebrewContentType } from './types'
import { storage } from '@/lib/storage'

const ENTITY_TYPE_MAP: Record<string, HomebrewContentType> = {
  characters: 'character',
  locations: 'location',
  creatures: 'creature',
  items: 'item',
  journals: 'rule',
  races: 'race',
  organisations: 'rule',
  families: 'rule',
  notes: 'rule',
}

const KANKA_API = 'https://kanka.io/api/1.0'

async function fetchEntityType(token: string, campaignId: string, entityType: string): Promise<NormalizedDocument[]> {
  const docs: NormalizedDocument[] = []
  let url: string | null = `${KANKA_API}/campaigns/${campaignId}/${entityType}`

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) break
    const data: any = await res.json()

    for (const entity of data.data ?? []) {
      docs.push({
        title: entity.name,
        type: ENTITY_TYPE_MAP[entityType],
        data: {
          ...entity,
          name: entity.name,
          description: entity.entry_parsed ?? entity.entry ?? '',
        },
        sourceId: String(entity.id),
        sourceUrl: entity.url,
      })
    }

    url = data.links?.next ?? null
  }

  return docs
}

async function parseExport(fileKey: string): Promise<NormalizedDocument[]> {
  const buffer = await storage.download(fileKey)
  const json = JSON.parse(Buffer.isBuffer(buffer) ? buffer.toString() : String(buffer))
  const docs: NormalizedDocument[] = []

  for (const [entityType, entities] of Object.entries(json)) {
    const type = ENTITY_TYPE_MAP[entityType]
    for (const entity of entities as any[]) {
      docs.push({
        title: entity.name,
        type,
        data: entity,
        sourceId: String(entity.id),
      })
    }
  }

  return docs
}

export const kankaAdapter: ImportAdapter = {
  source: 'kanka',

  async normalize(params) {
    const { mode, token, campaignId, fileKey, entityTypes } = params as {
      mode: 'api' | 'export'
      token?: string
      campaignId?: string
      fileKey?: string
      entityTypes?: string[]
    }

    if (mode === 'export' && fileKey) return parseExport(fileKey)

    if (mode === 'api' && token && campaignId) {
      const types = entityTypes ?? Object.keys(ENTITY_TYPE_MAP)
      const results = await Promise.all(types.map((t) => fetchEntityType(token, campaignId, t)))
      return results.flat()
    }

    throw new Error('Kanka requires (mode:api, token, campaignId) or (mode:export, fileKey)')
  },
}
