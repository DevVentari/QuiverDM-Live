import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { DdbEntitlementData, DdbChapterMeta } from '@/lib/ddb-sourcebook';

export const ddbSyncRepository = {
  async upsertEntitlements(userId: string, entitlements: DdbEntitlementData[]) {
    return Promise.all(
      entitlements.map(e =>
        prisma.ddbEntitlement.upsert({
          where: { userId_slug: { userId, slug: e.slug } },
          create: { userId, ...e },
          update: { title: e.title, coverImageUrl: e.coverImageUrl, accessType: e.accessType, detectedAt: new Date() },
        })
      )
    );
  },

  async listEntitlements(userId: string) {
    return prisma.ddbEntitlement.findMany({
      where: { userId },
      include: { sourcebook: { select: { id: true, syncStatus: true, lastSyncedAt: true } } },
      orderBy: { title: 'asc' },
    });
  },

  async createSourcebook(userId: string, entitlementId: string, slug: string, title: string, campaignIds: string[]) {
    const sourcebook = await prisma.ddbSourcebook.create({
      data: { userId, entitlementId, slug, title, campaignIds },
    });
    // Mirror the campaignIds array into the CampaignSourcebook join table so
    // Compendium / homebrew queries can resolve "this campaign uses sourcebook X"
    // via a proper FK relation. Idempotent on the (campaignId, sourcebookId) unique.
    if (campaignIds.length > 0) {
      await prisma.campaignSourcebook.createMany({
        data: campaignIds.map((campaignId) => ({ campaignId, sourcebookId: sourcebook.id })),
        skipDuplicates: true,
      });
    }
    return sourcebook;
  },

  async linkSourcebookToCampaigns(sourcebookId: string, campaignIds: string[]) {
    if (campaignIds.length === 0) return;
    await prisma.campaignSourcebook.createMany({
      data: campaignIds.map((campaignId) => ({ campaignId, sourcebookId })),
      skipDuplicates: true,
    });
  },

  /**
   * Clone WorldEntity + NPC rows tied to a sourcebook's chapters from a donor
   * campaign (any campaign owned by `userId` that has previously ingested this
   * sourcebook) into `targetCampaignId`. Used after linking a sourcebook so
   * the new campaign has its NPCs / locations / factions without re-running
   * the heavyweight DDB sync. Idempotent — skips rows that already exist in
   * the target via the (campaignId, name, type) unique constraint.
   *
   * Returns counts so the caller can surface "Seeded N NPCs, M locations…"
   */
  async seedCampaignFromSourcebook(
    targetCampaignId: string,
    sourcebookId: string,
    userId: string,
  ): Promise<{ entitiesSeeded: number; npcsSeeded: number; source: 'master' | 'donor' | 'none'; donorCampaignId: string | null }> {
    const existingEntities = await prisma.worldEntity.findMany({
      where: { campaignId: targetCampaignId },
      select: { name: true, type: true },
    });
    const existingKey = new Set(existingEntities.map((e) => `${e.type}:${e.name.toLowerCase()}`));

    // 1. Master copy — SourcebookEntity rows written by the dev-managed sync.
    //    This is the canonical, deletion-resistant source.
    const masterEntities = await prisma.sourcebookEntity.findMany({
      where: { sourcebookId },
      select: {
        type: true, name: true, description: true, properties: true,
        aliases: true, status: true, chapterId: true, sourceType: true,
        confidence: true, imageUrl: true,
      },
    });

    if (masterEntities.length > 0) {
      const toCreate = masterEntities.filter(
        (e) => !existingKey.has(`${e.type}:${e.name.toLowerCase()}`),
      );
      if (toCreate.length === 0) {
        return { entitiesSeeded: 0, npcsSeeded: 0, source: 'master', donorCampaignId: null };
      }
      const result = await prisma.worldEntity.createMany({
        data: toCreate.map((e) => ({
          campaignId: targetCampaignId,
          type: e.type,
          name: e.name,
          description: e.description,
          properties: e.properties as Prisma.InputJsonValue,
          aliases: e.aliases,
          status: e.status,
          ddbChapterId: e.chapterId,
          sourceType: e.sourceType,
          confidence: e.confidence,
          imageUrl: e.imageUrl,
        })),
        skipDuplicates: true,
      });
      return {
        entitiesSeeded: result.count,
        npcsSeeded: toCreate.filter((e) => e.type === 'NPC').length,
        source: 'master',
        donorCampaignId: null,
      };
    }

    // 2. Fallback — clone from a donor user-campaign that has the sourcebook's
    //    chapters in its WorldEntity. Legacy path; will be eliminated once all
    //    sourcebooks have been re-synced into the master table.
    const chapters = await prisma.ddbSourcebookChapter.findMany({
      where: { sourcebookId },
      select: { id: true },
    });
    const chapterIds = chapters.map((c) => c.id);
    if (chapterIds.length === 0) {
      return { entitiesSeeded: 0, npcsSeeded: 0, source: 'none', donorCampaignId: null };
    }
    const donorCampaign = await prisma.worldEntity.findFirst({
      where: {
        ddbChapterId: { in: chapterIds },
        campaignId: { not: targetCampaignId },
        campaign: { members: { some: { userId } } },
      },
      select: { campaignId: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!donorCampaign) {
      return { entitiesSeeded: 0, npcsSeeded: 0, source: 'none', donorCampaignId: null };
    }
    const donorEntities = await prisma.worldEntity.findMany({
      where: {
        campaignId: donorCampaign.campaignId,
        ddbChapterId: { in: chapterIds },
      },
      select: {
        type: true, name: true, description: true, properties: true,
        aliases: true, status: true, ddbChapterId: true, sourceType: true,
        confidence: true, imageUrl: true,
      },
    });
    const toCreate = donorEntities.filter(
      (e) => !existingKey.has(`${e.type}:${e.name.toLowerCase()}`),
    );
    if (toCreate.length === 0) {
      return { entitiesSeeded: 0, npcsSeeded: 0, source: 'donor', donorCampaignId: donorCampaign.campaignId };
    }
    const result = await prisma.worldEntity.createMany({
      data: toCreate.map((e) => ({
        campaignId: targetCampaignId,
        type: e.type,
        name: e.name,
        description: e.description,
        properties: e.properties as Prisma.InputJsonValue,
        aliases: e.aliases,
        status: e.status,
        ddbChapterId: e.ddbChapterId,
        sourceType: e.sourceType,
        confidence: e.confidence,
        imageUrl: e.imageUrl,
      })),
      skipDuplicates: true,
    });
    return {
      entitiesSeeded: result.count,
      npcsSeeded: toCreate.filter((e) => e.type === 'NPC').length,
      source: 'donor',
      donorCampaignId: donorCampaign.campaignId,
    };
  },

  async unlinkSourcebookFromCampaign(sourcebookId: string, campaignId: string) {
    await prisma.campaignSourcebook.deleteMany({
      where: { sourcebookId, campaignId },
    });
  },

  async upsertChapters(sourcebookId: string, chapters: DdbChapterMeta[]) {
    return Promise.all(
      chapters.map(c =>
        prisma.ddbSourcebookChapter.upsert({
          where: { sourcebookId_slug: { sourcebookId, slug: c.slug } },
          create: {
            sourcebookId,
            slug: c.slug,
            title: c.title,
            chapterIndex: c.chapterIndex,
            parentSlug: c.parentSlug ?? null,
          },
          update: {
            title: c.title,
            chapterIndex: c.chapterIndex,
            parentSlug: c.parentSlug ?? null,
          },
        })
      )
    );
  },

  async setSyncStatus(sourcebookId: string, status: string, error?: string | null) {
    return prisma.ddbSourcebook.update({
      where: { id: sourcebookId },
      data: {
        syncStatus: status,
        lastSyncError: error ?? null,
        ...(status === 'idle' ? { lastSyncedAt: new Date() } : {}),
      },
    });
  },

  async setChapterSyncStatus(chapterId: string, status: string) {
    return prisma.ddbSourcebookChapter.update({
      where: { id: chapterId },
      data: { syncStatus: status },
    });
  },

  async updateChapterHash(chapterId: string, contentHash: string, pendingChanges: object[]) {
    return prisma.ddbSourcebookChapter.update({
      where: { id: chapterId },
      data: {
        contentHash,
        syncStatus: 'idle',
        lastSyncedAt: new Date(),
        hasPendingChanges: pendingChanges.length > 0,
        pendingChanges: pendingChanges.length > 0 ? pendingChanges : undefined,
      },
    });
  },

  async getChaptersWithChanges(sourcebookId: string) {
    return prisma.ddbSourcebookChapter.count({ where: { sourcebookId, hasPendingChanges: true } });
  },

  async resolveChange(
    chapterId: string,
    entityId: string,
    field: string,
    action: 'accept' | 'keep',
    entityType?: string,
    newValue?: unknown
  ) {
    return prisma.$transaction(async (tx) => {
      const chapter = await tx.ddbSourcebookChapter.findUnique({ where: { id: chapterId } });
      if (!chapter?.pendingChanges) return;

      const changes = chapter.pendingChanges as Array<{ entityId: string; field: string; newValue: unknown; entityType: string }>;
      const remaining = changes.filter(c => !(c.entityId === entityId && c.field === field));

      if (action === 'accept' && newValue !== undefined && entityType) {
        if (entityType === 'HomebrewContent') {
          await tx.homebrewContent.update({ where: { id: entityId }, data: { [field]: newValue } as any });
        } else if (entityType === 'EncounterPlan') {
          await tx.encounterPlan.update({ where: { id: entityId }, data: { [field]: newValue } as any });
        } else if (entityType === 'WorldEntity') {
          await tx.worldEntity.update({ where: { id: entityId }, data: { [field]: newValue } as any });
        }
      }

      await tx.ddbSourcebookChapter.update({
        where: { id: chapterId },
        data: {
          pendingChanges: remaining.length > 0 ? (remaining as unknown as Prisma.InputJsonValue) : undefined,
          hasPendingChanges: remaining.length > 0,
        },
      });
    });
  },
};
