import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { DdbEntitlementData, DdbChapterMeta } from '@/lib/ddb-sourcebook';

function normalizeSeedKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function homebrewSeedKey(item: {
  dndBeyondId?: string | null;
  ddbChapterId?: string | null;
  type: string;
  name: string;
}): string {
  if (item.dndBeyondId) return `ddb:${item.dndBeyondId}`;
  if (item.ddbChapterId) {
    return `chapter:${item.ddbChapterId}:${item.type}:${normalizeSeedKey(item.name)}`;
  }
  return `name:${item.type}:${normalizeSeedKey(item.name)}`;
}

async function cloneSourcebookHomebrewToCampaign(
  tx: Prisma.TransactionClient,
  targetCampaignId: string,
  sourcebookId: string,
  userId: string,
): Promise<{
  canonicalToCampaignHomebrewId: Map<string, string>;
  cloneIdBySeedKey: Map<string, string>;
}> {
  const chapters = await tx.ddbSourcebookChapter.findMany({
    where: { sourcebookId },
    select: { id: true },
  });
  const chapterIds = chapters.map((chapter) => chapter.id);
  if (chapterIds.length === 0) {
    return {
      canonicalToCampaignHomebrewId: new Map(),
      cloneIdBySeedKey: new Map(),
    };
  }

  const canonicalRows = await tx.homebrewContent.findMany({
    where: {
      userId,
      ddbChapterId: { in: chapterIds },
      sourceType: 'dndbeyond_import',
    },
    select: {
      id: true,
      type: true,
      name: true,
      data: true,
      images: true,
      tags: true,
      searchText: true,
      dndBeyondId: true,
      dndBeyondUrl: true,
      ddbChapterId: true,
      imageUrl: true,
    },
  });
  if (canonicalRows.length === 0) {
    return {
      canonicalToCampaignHomebrewId: new Map(),
      cloneIdBySeedKey: new Map(),
    };
  }

  const canonicalDdbIds = canonicalRows
    .map((row) => row.dndBeyondId)
    .filter((value): value is string => Boolean(value));

  const existingLinks = await tx.campaignHomebrewContent.findMany({
    where: {
      campaignId: targetCampaignId,
      homebrew: {
        OR: [
          { ddbChapterId: { in: chapterIds } },
          ...(canonicalDdbIds.length > 0
            ? [{ dndBeyondId: { in: canonicalDdbIds } }]
            : []),
        ],
      },
    },
    select: {
      homebrew: {
        select: {
          id: true,
          type: true,
          name: true,
          dndBeyondId: true,
          ddbChapterId: true,
        },
      },
    },
  });

  const canonicalToCampaignHomebrewId = new Map<string, string>();
  const cloneIdBySeedKey = new Map<string, string>();

  for (const link of existingLinks) {
    cloneIdBySeedKey.set(homebrewSeedKey(link.homebrew), link.homebrew.id);
  }

  for (const row of canonicalRows) {
    const key = homebrewSeedKey(row);
    let cloneId = cloneIdBySeedKey.get(key);

    if (!cloneId) {
      const created = await tx.homebrewContent.create({
        data: {
          userId,
          type: row.type,
          name: row.name,
          data: row.data as Prisma.InputJsonValue,
          images: row.images,
          tags: row.tags,
          searchText: row.searchText,
          sourceType: 'sourcebook_seed',
          dndBeyondId: row.dndBeyondId,
          dndBeyondUrl: row.dndBeyondUrl,
          ddbChapterId: row.ddbChapterId,
          imageUrl: row.imageUrl,
        },
        select: { id: true },
      });
      cloneId = created.id;
      cloneIdBySeedKey.set(key, cloneId);
    }

    await tx.campaignHomebrewContent.upsert({
      where: {
        campaignId_homebrewId: {
          campaignId: targetCampaignId,
          homebrewId: cloneId,
        },
      },
      update: {},
      create: {
        campaignId: targetCampaignId,
        homebrewId: cloneId,
      },
    });

    canonicalToCampaignHomebrewId.set(row.id, cloneId);
  }

  return { canonicalToCampaignHomebrewId, cloneIdBySeedKey };
}

export const ddbSyncRepository = {
  async upsertEntitlements(userId: string, entitlements: DdbEntitlementData[]) {
    return Promise.all(
      entitlements.map((entitlement) =>
        prisma.ddbEntitlement.upsert({
          where: { userId_slug: { userId, slug: entitlement.slug } },
          create: { userId, ...entitlement },
          update: {
            title: entitlement.title,
            coverImageUrl: entitlement.coverImageUrl,
            accessType: entitlement.accessType,
            detectedAt: new Date(),
          },
        }),
      ),
    );
  },

  async listEntitlements(userId: string) {
    return prisma.ddbEntitlement.findMany({
      where: { userId },
      include: {
        sourcebook: {
          select: { id: true, syncStatus: true, lastSyncedAt: true },
        },
      },
      orderBy: { title: 'asc' },
    });
  },

  async createSourcebook(
    userId: string,
    entitlementId: string,
    slug: string,
    title: string,
    campaignIds: string[],
  ) {
    const sourcebook = await prisma.ddbSourcebook.create({
      data: { userId, entitlementId, slug, title, campaignIds },
    });

    if (campaignIds.length > 0) {
      await prisma.campaignSourcebook.createMany({
        data: campaignIds.map((campaignId) => ({
          campaignId,
          sourcebookId: sourcebook.id,
        })),
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
   * Seed a campaign from the canonical sourcebook store. This clones sourcebook
   * homebrew into campaign-local links first, then materializes world entities
   * so no campaign runtime path depends on owner-level shared HomebrewContent.
   */
  async seedCampaignFromSourcebook(
    targetCampaignId: string,
    sourcebookId: string,
    userId: string,
  ): Promise<{
    entitiesSeeded: number;
    npcsSeeded: number;
    source: 'master' | 'donor' | 'none';
    donorCampaignId: string | null;
  }> {
    return prisma.$transaction(async (tx) => {
      const { canonicalToCampaignHomebrewId, cloneIdBySeedKey } =
        await cloneSourcebookHomebrewToCampaign(
          tx,
          targetCampaignId,
          sourcebookId,
          userId,
        );

      const existingEntities = await tx.worldEntity.findMany({
        where: { campaignId: targetCampaignId },
        select: { name: true, type: true },
      });
      const existingKey = new Set(
        existingEntities.map((entity) => `${entity.type}:${entity.name.toLowerCase()}`),
      );

      const masterEntities = await tx.sourcebookEntity.findMany({
        where: { sourcebookId },
        select: {
          type: true,
          name: true,
          description: true,
          properties: true,
          aliases: true,
          status: true,
          chapterId: true,
          sourceType: true,
          confidence: true,
          imageUrl: true,
          statBlockId: true,
          statBlock: {
            select: {
              dndBeyondId: true,
              ddbChapterId: true,
              type: true,
              name: true,
            },
          },
        },
      });

      if (masterEntities.length > 0) {
        const toCreate = masterEntities.filter(
          (entity) => !existingKey.has(`${entity.type}:${entity.name.toLowerCase()}`),
        );
        if (toCreate.length === 0) {
          return {
            entitiesSeeded: 0,
            npcsSeeded: 0,
            source: 'master' as const,
            donorCampaignId: null,
          };
        }

        const result = await tx.worldEntity.createMany({
          data: toCreate.map((entity) => ({
            campaignId: targetCampaignId,
            type: entity.type,
            name: entity.name,
            description: entity.description,
            properties: entity.properties as Prisma.InputJsonValue,
            aliases: entity.aliases,
            status: entity.status,
            ddbChapterId: entity.chapterId,
            sourceType: entity.sourceType,
            confidence: entity.confidence,
            imageUrl: entity.imageUrl,
            statBlockId:
              (entity.statBlockId
                ? canonicalToCampaignHomebrewId.get(entity.statBlockId)
                : undefined) ??
              (entity.statBlock
                ? cloneIdBySeedKey.get(homebrewSeedKey(entity.statBlock))
                : undefined) ??
              null,
          })),
          skipDuplicates: true,
        });

        return {
          entitiesSeeded: result.count,
          npcsSeeded: toCreate.filter((entity) => entity.type === 'NPC').length,
          source: 'master' as const,
          donorCampaignId: null,
        };
      }

      const chapters = await tx.ddbSourcebookChapter.findMany({
        where: { sourcebookId },
        select: { id: true },
      });
      const chapterIds = chapters.map((chapter) => chapter.id);
      if (chapterIds.length === 0) {
        return {
          entitiesSeeded: 0,
          npcsSeeded: 0,
          source: 'none' as const,
          donorCampaignId: null,
        };
      }

      const donorCampaign = await tx.worldEntity.findFirst({
        where: {
          ddbChapterId: { in: chapterIds },
          campaignId: { not: targetCampaignId },
          campaign: { members: { some: { userId } } },
        },
        select: { campaignId: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (!donorCampaign) {
        return {
          entitiesSeeded: 0,
          npcsSeeded: 0,
          source: 'none' as const,
          donorCampaignId: null,
        };
      }

      const donorEntities = await tx.worldEntity.findMany({
        where: {
          campaignId: donorCampaign.campaignId,
          ddbChapterId: { in: chapterIds },
        },
        select: {
          type: true,
          name: true,
          description: true,
          properties: true,
          aliases: true,
          status: true,
          ddbChapterId: true,
          sourceType: true,
          confidence: true,
          imageUrl: true,
          statBlock: {
            select: {
              dndBeyondId: true,
              ddbChapterId: true,
              type: true,
              name: true,
            },
          },
        },
      });

      const toCreate = donorEntities.filter(
        (entity) => !existingKey.has(`${entity.type}:${entity.name.toLowerCase()}`),
      );
      if (toCreate.length === 0) {
        return {
          entitiesSeeded: 0,
          npcsSeeded: 0,
          source: 'donor' as const,
          donorCampaignId: donorCampaign.campaignId,
        };
      }

      const result = await tx.worldEntity.createMany({
        data: toCreate.map((entity) => ({
          campaignId: targetCampaignId,
          type: entity.type,
          name: entity.name,
          description: entity.description,
          properties: entity.properties as Prisma.InputJsonValue,
          aliases: entity.aliases,
          status: entity.status,
          ddbChapterId: entity.ddbChapterId,
          sourceType: entity.sourceType,
          confidence: entity.confidence,
          imageUrl: entity.imageUrl,
          statBlockId: entity.statBlock
            ? (cloneIdBySeedKey.get(homebrewSeedKey(entity.statBlock)) ?? null)
            : null,
        })),
        skipDuplicates: true,
      });

      return {
        entitiesSeeded: result.count,
        npcsSeeded: toCreate.filter((entity) => entity.type === 'NPC').length,
        source: 'donor' as const,
        donorCampaignId: donorCampaign.campaignId,
      };
    });
  },

  async unlinkSourcebookFromCampaign(sourcebookId: string, campaignId: string) {
    await prisma.campaignSourcebook.deleteMany({
      where: { sourcebookId, campaignId },
    });
  },

  async upsertChapters(sourcebookId: string, chapters: DdbChapterMeta[]) {
    return Promise.all(
      chapters.map((chapter) =>
        prisma.ddbSourcebookChapter.upsert({
          where: {
            sourcebookId_slug: { sourcebookId, slug: chapter.slug },
          },
          create: {
            sourcebookId,
            slug: chapter.slug,
            title: chapter.title,
            chapterIndex: chapter.chapterIndex,
            parentSlug: chapter.parentSlug ?? null,
          },
          update: {
            title: chapter.title,
            chapterIndex: chapter.chapterIndex,
            parentSlug: chapter.parentSlug ?? null,
          },
        }),
      ),
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

  async updateChapterHash(
    chapterId: string,
    contentHash: string,
    pendingChanges: object[],
    bodySections: Array<{ heading: string | null; level: number; markdown: string }>,
  ) {
    const data: any = {
      contentHash,
      syncStatus: 'idle',
      lastSyncedAt: new Date(),
      hasPendingChanges: pendingChanges.length > 0,
      pendingChanges:
        pendingChanges.length > 0 ? pendingChanges : Prisma.JsonNull,
      bodySections: bodySections as unknown as Prisma.InputJsonValue,
      bodySyncedAt: new Date(),
    };

    return prisma.ddbSourcebookChapter.update({
      where: { id: chapterId },
      data,
    });
  },
  async getChaptersWithChanges(sourcebookId: string) {
    return prisma.ddbSourcebookChapter.count({
      where: { sourcebookId, hasPendingChanges: true },
    });
  },

  async resolveChange(
    chapterId: string,
    entityId: string,
    field: string,
    action: 'accept' | 'keep',
    entityType?: string,
    newValue?: unknown,
  ) {
    return prisma.$transaction(async (tx) => {
      const chapter = await tx.ddbSourcebookChapter.findUnique({
        where: { id: chapterId },
      });
      if (!chapter?.pendingChanges) return;

      const changes = chapter.pendingChanges as Array<{
        entityId: string;
        field: string;
        newValue: unknown;
        entityType: string;
      }>;
      const remaining = changes.filter(
        (change) =>
          !(change.entityId === entityId && change.field === field),
      );

      if (action === 'accept' && newValue !== undefined && entityType) {
        if (entityType === 'HomebrewContent') {
          await tx.homebrewContent.update({
            where: { id: entityId },
            data: { [field]: newValue } as any,
          });
        } else if (entityType === 'EncounterPlan') {
          await tx.encounterPlan.update({
            where: { id: entityId },
            data: { [field]: newValue } as any,
          });
        } else if (entityType === 'WorldEntity') {
          await tx.worldEntity.update({
            where: { id: entityId },
            data: { [field]: newValue } as any,
          });
        }
      }

      await tx.ddbSourcebookChapter.update({
        where: { id: chapterId },
        data: {
          pendingChanges:
            remaining.length > 0
              ? (remaining as unknown as Prisma.InputJsonValue)
              : undefined,
          hasPendingChanges: remaining.length > 0,
        },
      });
    });
  },
};

