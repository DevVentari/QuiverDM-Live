import { prisma } from '@/lib/prisma';
import { ddbSyncRepository } from '@/server/repositories/ddb-sync.repository';
import { upsertEmbeddings } from '@/server/repositories/embedding.repository';
import { generateEmbedding } from '@/lib/ai/embeddings';
import type { ChapterContent, DdbMonsterData } from '@/lib/ddb-sourcebook';
import type { ProseChunk } from './ddb-chapter-chunker';

export interface PendingChange {
  entityType: 'HomebrewContent' | 'EncounterPlan' | 'WorldEntity';
  entityId: string;
  entityName: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface UpsertResult {
  created: boolean;
  id: string;
  existingName?: string;
}

export interface AiAttemptRecord {
  chapterId: string;
  prompt: string;
  rawResponse: string;
  parsed: unknown;
  parseError?: string;
  promptCharLimit: number;
  proseLength: number;
  truncated: boolean;
  durationMs: number;
}

export interface WriteSink {
  upsertMonster(args: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    monster: DdbMonsterData;
  }): Promise<UpsertResult>;

  upsertEncounter(args: {
    campaignId: string;
    chapterId: string;
    chapterSlug: string;
    areaName: string;
    description?: string;
    monsters?: string[];
    difficulty?: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
  }): Promise<UpsertResult>;

  upsertItem(args: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    itemType?: string;
    rarity?: string;
    description: string;
  }): Promise<UpsertResult>;

  upsertWorldEntity(args: {
    campaignId: string;
    chapterId: string;
    type: 'NPC' | 'LOCATION';
    name: string;
    description: string;
    role?: string;
    location?: string;
    locationType?: string;
    notable?: string;
  }): Promise<UpsertResult>;

  setChapterStatus(chapterId: string, status: 'running' | 'idle' | 'error'): Promise<void>;

  finalizeChapter(args: {
    chapterId: string;
    contentHash: string;
    pendingChanges: PendingChange[];
  }): Promise<void>;

  recordFetched(args: {
    chapterId: string;
    chapterSlug: string;
    chapterIndex: number;
    content: ChapterContent;
  }): Promise<void>;

  recordSkippedMonster(args: {
    chapterId: string;
    ddbId: string;
    slug: string;
    reason: string;
    status?: number;
    via?: 'jwt' | 'cookie';
    finalUrl?: string;
    htmlSnippet?: string;
  }): Promise<void>;

  recordAiAttempt(record: AiAttemptRecord): Promise<void>;

  recordIssue(args: {
    chapterId: string;
    severity: 'info' | 'warn' | 'error';
    message: string;
  }): Promise<void>;

  /**
   * Embed chapter prose chunks into the RAG store. Implementations decide
   * whether to actually call the embedding model (PrismaSink yes; DryRunSink no).
   */
  ingestChapterProse(args: {
    chapterId: string;
    chapterSlug: string;
    sourceSlug: string;
    campaignIds: string[];
    chunks: ProseChunk[];
  }): Promise<{ embedded: number; skipped: number }>;
}

export class PrismaWriteSink implements WriteSink {
  async upsertMonster({ userId, chapterId, sourceSlug, monster }: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    monster: DdbMonsterData;
  }): Promise<UpsertResult> {
    const existing = await prisma.homebrewContent.findFirst({
      where: { userId, dndBeyondId: monster.ddbId },
    });

    if (existing) {
      return { created: false, id: existing.id, existingName: existing.name };
    }

    try {
      const created = await prisma.homebrewContent.create({
        data: {
          userId,
          type: 'creature',
          name: monster.name,
          dndBeyondId: monster.ddbId,
          dndBeyondUrl: monster.sourceUrl,
          ddbChapterId: chapterId,
          sourceType: 'dndbeyond_import',
          data: monster as any,
          searchText: monster.name,
          tags: [sourceSlug],
          images: monster.imageUrl ? [monster.imageUrl] : [],
          imageUrl: monster.imageUrl ?? null,
        },
      });
      return { created: true, id: created.id };
    } catch {
      // Race with parallel chapter — re-read
      const raced = await prisma.homebrewContent.findFirst({
        where: { userId, dndBeyondId: monster.ddbId },
      });
      return raced
        ? { created: false, id: raced.id, existingName: raced.name }
        : { created: false, id: 'unknown' };
    }
  }

  async upsertEncounter({ campaignId, chapterId, chapterSlug, areaName, description, difficulty }: {
    campaignId: string;
    chapterId: string;
    chapterSlug: string;
    areaName: string;
    description?: string;
    monsters?: string[];
    difficulty?: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly';
  }): Promise<UpsertResult> {
    const existing = await prisma.encounterPlan.findFirst({
      where: { campaignId, ddbChapterId: chapterId, name: areaName },
    });
    if (existing) return { created: false, id: existing.id, existingName: existing.name };

    const created = await prisma.encounterPlan.create({
      data: {
        campaignId,
        name: areaName,
        ddbChapterId: chapterId,
        sceneDescription: description ?? `Encounter area from ${chapterSlug}`,
        difficulty: difficulty ?? 'medium',
      },
    });
    return { created: true, id: created.id };
  }

  async upsertItem({ userId, chapterId, sourceSlug, name, itemType, rarity, description }: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    itemType?: string;
    rarity?: string;
    description: string;
  }): Promise<UpsertResult> {
    const existing = await prisma.homebrewContent.findFirst({
      where: { userId, type: 'item', name, ddbChapterId: chapterId },
    });
    if (existing) return { created: false, id: existing.id, existingName: existing.name };

    const created = await prisma.homebrewContent.create({
      data: {
        userId,
        type: 'item',
        name,
        ddbChapterId: chapterId,
        sourceType: 'dndbeyond_import',
        data: { itemType, rarity, description } as any,
        searchText: `${name} ${description}`,
        tags: [sourceSlug, 'item', ...(rarity ? [rarity] : [])],
        images: [],
      },
    });
    return { created: true, id: created.id };
  }

  async upsertWorldEntity(args: {
    campaignId: string;
    chapterId: string;
    type: 'NPC' | 'LOCATION';
    name: string;
    description: string;
    role?: string;
    location?: string;
    locationType?: string;
    notable?: string;
  }): Promise<UpsertResult> {
    const existing = await prisma.worldEntity.findFirst({
      where: { campaignId: args.campaignId, name: args.name },
    });
    if (existing) return { created: false, id: existing.id, existingName: existing.name };

    const properties: Record<string, unknown> = {};
    if (args.role) properties.role = args.role;
    if (args.location) properties.location = args.location;
    if (args.locationType) properties.locationType = args.locationType;
    if (args.notable) properties.notable = args.notable;

    const created = await prisma.worldEntity.create({
      data: {
        campaignId: args.campaignId,
        type: args.type as any,
        name: args.name,
        description: args.description,
        ddbChapterId: args.chapterId,
        status: 'active' as any,
        confidence: 0.7,
        properties,
      } as any,
    });
    return { created: true, id: created.id };
  }

  async setChapterStatus(chapterId: string, status: 'running' | 'idle' | 'error'): Promise<void> {
    await ddbSyncRepository.setChapterSyncStatus(chapterId, status);
  }

  async finalizeChapter({ chapterId, contentHash, pendingChanges }: {
    chapterId: string;
    contentHash: string;
    pendingChanges: PendingChange[];
  }): Promise<void> {
    await ddbSyncRepository.updateChapterHash(chapterId, contentHash, pendingChanges);
  }

  async recordFetched(): Promise<void> { /* no-op in prod */ }
  async recordSkippedMonster(): Promise<void> { /* no-op in prod */ }
  async recordAiAttempt(): Promise<void> { /* no-op in prod */ }
  async recordIssue({ severity, message, chapterId }: {
    chapterId: string;
    severity: 'info' | 'warn' | 'error';
    message: string;
  }): Promise<void> {
    if (severity !== 'info') {
      console.warn(`[ddb-chapter ${chapterId}] ${severity}: ${message}`);
    }
  }

  async ingestChapterProse({ chapterId, chapterSlug, sourceSlug, campaignIds, chunks }: {
    chapterId: string;
    chapterSlug: string;
    sourceSlug: string;
    campaignIds: string[];
    chunks: ProseChunk[];
  }): Promise<{ embedded: number; skipped: number }> {
    if (chunks.length === 0) return { embedded: 0, skipped: 0 };
    let embedded = 0;
    let skipped = 0;
    const vectorChunks: Array<{ text: string; index: number; vector: number[] }> = [];
    for (const chunk of chunks) {
      try {
        const vector = await generateEmbedding(chunk.text);
        vectorChunks.push({ text: chunk.text, index: chunk.index, vector });
        embedded++;
      } catch (e) {
        skipped++;
        console.warn(`[ddb-chapter ${chapterId}] embed chunk ${chunk.index} failed: ${(e as Error).message}`);
      }
    }
    if (vectorChunks.length === 0) return { embedded, skipped };
    const metadata = { sourceSlug, chapterSlug, ddbChapterId: chapterId };
    // Embeddings are scoped per campaign so RAG search filters by campaign.
    for (const campaignId of campaignIds) {
      // entityId = `${chapterId}:${campaignId}` lets us re-ingest per (chapter, campaign) cleanly
      await upsertEmbeddings(`${chapterId}:${campaignId}`, 'ddb_chapter', vectorChunks, metadata, campaignId);
    }
    return { embedded, skipped };
  }
}
