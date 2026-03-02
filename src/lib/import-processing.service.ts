import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extractWithFallback } from '@/lib/ai/extraction'
import type { NormalizedDocument } from './import-adapters/types'

interface ProcessingContext {
  userId: string
  jobId: string
  source: string
  campaignId?: string
}

const SOURCE_TYPE_MAP: Record<string, string> = {
  notion: 'notion_import',
  obsidian: 'obsidian_import',
  google_docs: 'google_docs_import',
  docx: 'docx_import',
  markdown_file: 'markdown_import',
  world_anvil: 'world_anvil_import',
  campfire: 'campfire_import',
  kanka: 'kanka_import',
}

const EXTRACTION_TYPE_MAP: Record<string, string> = {
  magic_item: 'item',
  spell: 'spell',
  creature: 'creature',
  feat: 'feat',
  race: 'race',
  background: 'background',
  class_feature: 'subclass',
}

export async function processDocument(
  doc: NormalizedDocument,
  ctx: ProcessingContext
): Promise<{ saved: number; errors: string[] }> {
  const sourceType = SOURCE_TYPE_MAP[ctx.source] ?? `${ctx.source}_import`
  const errors: string[] = []
  let saved = 0

  if (doc.data && doc.type) {
    try {
      await saveContent({
        userId: ctx.userId,
        type: doc.type,
        name: doc.title,
        data: doc.data,
        tags: doc.tags ?? [],
        sourceType,
        sourceExternalId: doc.sourceId,
        sourceJobId: ctx.jobId,
      })
      saved++
    } catch (e) {
      errors.push(`Failed to save "${doc.title}": ${e instanceof Error ? e.message : String(e)}`)
    }
    return { saved, errors }
  }

  if (!doc.markdown) return { saved: 0, errors: [`No content in "${doc.title}"`] }

  const result = await extractWithFallback(doc.markdown)
  if (!result.success || result.items.length === 0) {
    return { saved: 0, errors: [`No items extracted from "${doc.title}"`] }
  }

  for (const item of result.items) {
    const dbType = EXTRACTION_TYPE_MAP[item.type] ?? 'item'
    try {
      await saveContent({
        userId: ctx.userId,
        type: dbType,
        name: item.name,
        data: item.data as Record<string, unknown>,
        tags: doc.tags ?? [],
        sourceType,
        sourceExternalId: doc.sourceId,
        sourceJobId: ctx.jobId,
      })
      saved++
    } catch (e) {
      errors.push(`Failed to save "${item.name}": ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { saved, errors }
}

async function saveContent(data: {
  userId: string
  type: string
  name: string
  data: Record<string, unknown>
  tags: string[]
  sourceType: string
  sourceExternalId?: string
  sourceJobId?: string
}) {
  const existing = await prisma.homebrewContent.findFirst({
    where: { userId: data.userId, name: data.name, type: data.type },
    select: { id: true },
  })

  if (existing) {
    return prisma.homebrewContent.update({
      where: { id: existing.id },
      data: {
        data: data.data as unknown as Prisma.InputJsonValue,
        tags: data.tags,
        sourceType: data.sourceType,
        sourceExternalId: data.sourceExternalId,
        sourceJobId: data.sourceJobId,
        searchText: `${data.name} ${JSON.stringify(data.data)}`.toLowerCase(),
      },
    })
  }

  return prisma.homebrewContent.create({
    data: {
      userId: data.userId,
      type: data.type,
      name: data.name,
      data: data.data as unknown as Prisma.InputJsonValue,
      tags: data.tags,
      sourceType: data.sourceType,
      sourceExternalId: data.sourceExternalId,
      sourceJobId: data.sourceJobId,
      searchText: `${data.name} ${JSON.stringify(data.data)}`.toLowerCase(),
    },
  })
}
