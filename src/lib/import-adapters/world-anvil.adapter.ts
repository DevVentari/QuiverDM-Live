import type { ImportAdapter, NormalizedDocument, HomebrewContentType } from './types'
import { storage } from '@/lib/storage'

const CATEGORY_MAP: Record<string, HomebrewContentType> = {
  location: 'location', settlement: 'location', dungeon: 'location', wilderness: 'location',
  character: 'character', person: 'character', npc: 'character',
  creature: 'creature', monster: 'creature',
  race: 'race',
  item: 'item', material: 'item', technology: 'item',
  spell: 'spell', magic: 'spell',
}

function classifyArticle(category?: string): HomebrewContentType | undefined {
  if (!category) return undefined
  return CATEGORY_MAP[category.toLowerCase()]
}

async function fetchViaAPI(token: string, worldSlug: string): Promise<NormalizedDocument[]> {
  const docs: NormalizedDocument[] = []
  let page = 1

  while (true) {
    const res = await fetch(
      `https://www.worldanvil.com/api/aragorn/world/${worldSlug}/articles?page=${page}`,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    )
    if (!res.ok) throw new Error(`World Anvil API error (${res.status}) for world ${worldSlug}`)
    const data = await res.json()
    const articles = data.articles ?? data.data ?? []
    if (articles.length === 0) break

    for (const article of articles) {
      docs.push({
        title: article.title ?? article.name ?? 'Untitled',
        markdown: `# ${article.title ?? ''}\n\n${article.content ?? article.body ?? ''}`,
        type: classifyArticle(article.category),
        tags: article.tags ?? [],
        sourceId: String(article.id ?? article.uuid ?? ''),
        sourceUrl: article.url,
      })
    }

    if (!data.has_more && !data.links?.next) break
    page++
  }

  return docs
}

async function parseXMLExport(fileKey: string): Promise<NormalizedDocument[]> {
  const { XMLParser } = await import('fast-xml-parser')
  const buffer = await storage.download(fileKey)
  const parser = new XMLParser({ ignoreAttributes: false })
  const xml = parser.parse(Buffer.isBuffer(buffer) ? buffer.toString() : String(buffer))
  const articles = xml?.world?.articles?.article ?? []
  const list = Array.isArray(articles) ? articles : [articles]

  return list.map((a: any) => ({
    title: a.title ?? a.name ?? 'Untitled',
    markdown: `# ${a.title ?? ''}\n\n${a.content ?? ''}`,
    type: classifyArticle(a.category),
    sourceId: String(a.id ?? a.uuid ?? ''),
  }))
}

export const worldAnvilAdapter: ImportAdapter = {
  source: 'world_anvil',

  async normalize(params) {
    const { mode, token, worldSlug, fileKey } = params as {
      mode: 'api' | 'export'
      token?: string
      worldSlug?: string
      fileKey?: string
    }

    if (mode === 'api' && token && worldSlug) return fetchViaAPI(token, worldSlug)
    if (mode === 'export' && fileKey) return parseXMLExport(fileKey)
    throw new Error('World Anvil requires (mode:api, token, worldSlug) or (mode:export, fileKey)')
  },
}
