import type { ImportAdapter, NormalizedDocument, HomebrewContentType } from './types'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

function classifyByParentTitle(parentTitle: string): HomebrewContentType | undefined {
  const t = parentTitle.toLowerCase()
  if (t.includes('npc') || t.includes('monster') || t.includes('creature')) return 'creature'
  if (t.includes('location') || t.includes('region') || t.includes('place')) return 'location'
  if (t.includes('character') || t.includes(' pc') || t.includes('player')) return 'character'
  if (t.includes('god') || t.includes('deity') || t.includes('pantheon')) return 'creature'
  return undefined
}

async function getPageTitle(pageId: string, token: string): Promise<string> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION },
  })
  if (!res.ok) throw new Error(`Failed to fetch Notion page ${pageId}: ${res.status}`)
  const page = await res.json()
  const titleProp = page.properties?.title ?? page.properties?.Name
  if (!titleProp) return 'Untitled'
  return titleProp.title?.map((t: any) => t.plain_text).join('') ?? 'Untitled'
}

async function getBlocksAsMarkdown(blockId: string, token: string): Promise<string> {
  const lines: string[] = []
  let cursor: string | undefined

  do {
    const url = `${NOTION_API}/blocks/${blockId}/children${cursor ? `?start_cursor=${cursor}` : ''}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION },
    })
    if (!res.ok) break
    const data = await res.json()
    for (const block of data.results ?? []) {
      lines.push(blockToMarkdown(block))
    }
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)

  return lines.filter(Boolean).join('\n')
}

function blockToMarkdown(block: any): string {
  const getText = (richText: any[]) => richText?.map((t: any) => t.plain_text).join('') ?? ''
  switch (block.type) {
    case 'heading_1': return `# ${getText(block.heading_1.rich_text)}`
    case 'heading_2': return `## ${getText(block.heading_2.rich_text)}`
    case 'heading_3': return `### ${getText(block.heading_3.rich_text)}`
    case 'paragraph': return getText(block.paragraph.rich_text)
    case 'bulleted_list_item': return `- ${getText(block.bulleted_list_item.rich_text)}`
    case 'numbered_list_item': return `1. ${getText(block.numbered_list_item.rich_text)}`
    case 'callout': return `> ${getText(block.callout.rich_text)}`
    case 'toggle': return `> ${getText(block.toggle.rich_text)}`
    case 'quote': return `> ${getText(block.quote.rich_text)}`
    case 'code': return `\`\`\`\n${getText(block.code.rich_text)}\n\`\`\``
    default: return ''
  }
}

export const notionAdapter: ImportAdapter = {
  source: 'notion',

  async normalize(params) {
    const { pageIds, token, parentTitle } = params as {
      pageIds: string[]
      token: string
      parentTitle?: string
    }

    if (!token) throw new Error('Notion adapter requires a token')
    if (!pageIds?.length) throw new Error('Notion adapter requires at least one pageId')

    const docs: NormalizedDocument[] = []
    for (const pageId of pageIds) {
      const title = await getPageTitle(pageId, token)
      const markdown = await getBlocksAsMarkdown(pageId, token)
      const type = parentTitle ? classifyByParentTitle(parentTitle) : undefined
      docs.push({
        title,
        markdown,
        type,
        sourceId: pageId,
        sourceUrl: `https://notion.so/${pageId.replace(/-/g, '')}`,
      })
    }
    return docs
  },
}
