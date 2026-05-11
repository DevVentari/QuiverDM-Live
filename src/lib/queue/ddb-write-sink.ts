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

  upsertSpell(args: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    level: number;
    school: string;
    castingTime: string;
    range: string;
    components: string;
    duration: string;
    description: string;
    higherLevels?: string;
    classes?: string[];
  }): Promise<UpsertResult>;

  upsertFeat(args: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    prerequisite?: string;
    description: string;
    benefits: string[];
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

  /**
   * Write the sourcebook-scoped master copy of an extracted entity.
   * Independent of any user campaign — survives campaign deletes.
   */
  upsertSourcebookEntity(args: {
    sourcebookId: string;
    chapterId: string;
    type: 'NPC' | 'LOCATION' | 'FACTION' | 'ITEM' | 'EVENT' | 'THREAT' | 'SECRET' | 'CUSTOM' | 'ARC' | 'NOTE' | 'PC';
    name: string;
    description: string;
    properties?: Record<string, unknown>;
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

  /**
   * Resolve monster names referenced by an EncounterPlan to the user's
   * imported HomebrewContent rows and create EncounterPlanCreature children.
   * Idempotent — skips creature names already linked to this plan.
   */
  linkEncounterCreatures(args: {
    planId: string;
    userId: string;
    monsterNames: string[];
  }): Promise<{ linked: number; unmatched: number }>;
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

  async upsertSpell({ userId, chapterId, sourceSlug, name, level, school, castingTime, range, components, duration, description, higherLevels, classes }: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    level: number;
    school: string;
    castingTime: string;
    range: string;
    components: string;
    duration: string;
    description: string;
    higherLevels?: string;
    classes?: string[];
  }): Promise<UpsertResult> {
    const existing = await prisma.homebrewContent.findFirst({
      where: { userId, type: 'spell', name, ddbChapterId: chapterId },
    });
    if (existing) return { created: false, id: existing.id, existingName: existing.name };

    const created = await prisma.homebrewContent.create({
      data: {
        userId,
        type: 'spell',
        name,
        ddbChapterId: chapterId,
        sourceType: 'dndbeyond_import',
        data: { level, school, castingTime, range, components, duration, description, higherLevels, classes } as any,
        searchText: `${name} ${description}`.slice(0, 4000),
        tags: [sourceSlug, `level-${level}`, school],
      },
    });
    return { created: true, id: created.id };
  }

  async upsertFeat({ userId, chapterId, sourceSlug, name, prerequisite, description, benefits }: {
    userId: string;
    chapterId: string;
    sourceSlug: string;
    name: string;
    prerequisite?: string;
    description: string;
    benefits: string[];
  }): Promise<UpsertResult> {
    const existing = await prisma.homebrewContent.findFirst({
      where: { userId, type: 'feat', name, ddbChapterId: chapterId },
    });
    if (existing) return { created: false, id: existing.id, existingName: existing.name };

    const created = await prisma.homebrewContent.create({
      data: {
        userId,
        type: 'feat',
        name,
        ddbChapterId: chapterId,
        sourceType: 'dndbeyond_import',
        data: { prerequisite, description, benefits } as any,
        searchText: `${name} ${description}`.slice(0, 4000),
        tags: [sourceSlug],
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

  async upsertSourcebookEntity(args: {
    sourcebookId: string;
    chapterId: string;
    type: 'NPC' | 'LOCATION' | 'FACTION' | 'ITEM' | 'EVENT' | 'THREAT' | 'SECRET' | 'CUSTOM' | 'ARC' | 'NOTE' | 'PC';
    name: string;
    description: string;
    properties?: Record<string, unknown>;
  }): Promise<UpsertResult> {
    const existing = await prisma.sourcebookEntity.findUnique({
      where: { sourcebookId_type_name: { sourcebookId: args.sourcebookId, type: args.type as any, name: args.name } },
      select: { id: true, name: true },
    });
    if (existing) {
      await prisma.sourcebookEntity.update({
        where: { id: existing.id },
        data: {
          description: args.description,
          properties: (args.properties ?? {}) as any,
          chapterId: args.chapterId,
        },
      });
      return { created: false, id: existing.id, existingName: existing.name };
    }
    const created = await prisma.sourcebookEntity.create({
      data: {
        sourcebookId: args.sourcebookId,
        chapterId: args.chapterId,
        type: args.type as any,
        name: args.name,
        description: args.description,
        properties: (args.properties ?? {}) as any,
        sourceType: 'dndbeyond_import',
        confidence: 0.7,
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

  async linkEncounterCreatures({ planId, userId, monsterNames }: {
    planId: string;
    userId: string;
    monsterNames: string[];
  }): Promise<{ linked: number; unmatched: number }> {
    const cleaned = [...new Set(monsterNames.map(n => n.trim()).filter(Boolean))];
    if (cleaned.length === 0) return { linked: 0, unmatched: 0 };

    const existing = await prisma.encounterPlanCreature.findMany({
      where: { planId },
      select: { name: true },
    });
    const alreadyLinked = new Set(existing.map(c => c.name.toLowerCase()));
    const toAdd = cleaned.filter(n => !alreadyLinked.has(n.toLowerCase()));
    if (toAdd.length === 0) return { linked: 0, unmatched: 0 };

    const matches = await prisma.homebrewContent.findMany({
      where: {
        userId,
        type: 'creature',
        name: { in: toAdd, mode: 'insensitive' },
      },
      select: { id: true, name: true, data: true },
    });
    const byLowerName = new Map(matches.map(m => [m.name.toLowerCase(), m]));

    let linked = 0;
    let unmatched = 0;
    for (const name of toAdd) {
      const match = byLowerName.get(name.toLowerCase());
      const data = (match?.data ?? null) as { cr?: string; xp?: number } | null;
      try {
        await prisma.encounterPlanCreature.create({
          data: {
            planId,
            name,
            count: 1,
            cr: data?.cr ?? null,
            xp: data?.xp ?? null,
            sourceType: match ? 'homebrew' : 'srd',
            sourceId: match?.id ?? null,
            statBlock: (match?.data as any) ?? undefined,
          },
        });
        if (match) linked++; else unmatched++;
      } catch {
        // Race or constraint — re-read to confirm
      }
    }
    return { linked, unmatched };
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
