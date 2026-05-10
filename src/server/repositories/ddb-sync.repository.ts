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
    return prisma.ddbSourcebook.create({
      data: { userId, entitlementId, slug, title, campaignIds },
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
