import { Prisma, WorldEntryType } from '@prisma/client';
import { prisma } from '../db';
import { enqueueMeiliSyncSafe } from '@/lib/queue/meili-sync-queue';

export const worldRepository = {
  async findEntries(
    campaignId: string,
    opts?: { type?: WorldEntryType; search?: string; limit?: number; cursor?: string }
  ) {
    const where: Prisma.WorldEntryWhereInput = { campaignId };
    if (opts?.type) where.type = opts.type;
    if (opts?.search) {
      where.OR = [
        { name: { contains: opts.search, mode: 'insensitive' } },
        { summary: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    return prisma.worldEntry.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        summary: true,
        tags: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
      take: opts?.limit ?? 200,
      cursor: opts?.cursor ? { id: opts.cursor } : undefined,
      skip: opts?.cursor ? 1 : 0,
    });
  },

  async findEntryBySlug(campaignId: string, slug: string) {
    return prisma.worldEntry.findUnique({
      where: { campaignId_slug: { campaignId, slug } },
      include: {
        worldEntity: {
          include: {
            sessionAppearances: {
              include: {
                session: { select: { id: true, sessionNumber: true, title: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
      },
    });
  },

  async upsertEntry(
    campaignId: string,
    data: {
      type: WorldEntryType;
      name: string;
      slug: string;
      content: string;
      summary?: string;
      structuredData?: Record<string, unknown>;
      tags?: string[];
      sourceFile?: string;
    }
  ) {
    const sd = data.structuredData
      ? (data.structuredData as Prisma.InputJsonValue)
      : Prisma.JsonNull;
    const entry = await prisma.worldEntry.upsert({
      where: { campaignId_slug: { campaignId, slug: data.slug } },
      create: {
        campaignId,
        type: data.type,
        name: data.name,
        slug: data.slug,
        content: data.content,
        summary: data.summary,
        structuredData: sd,
        tags: data.tags ?? [],
        sourceFile: data.sourceFile,
      },
      update: {
        name: data.name,
        type: data.type,
        content: data.content,
        summary: data.summary,
        structuredData: data.structuredData
          ? (data.structuredData as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        tags: data.tags ?? [],
        sourceFile: data.sourceFile,
      },
    });
    enqueueMeiliSyncSafe({ kind: 'world_entry', op: 'upsert', id: entry.id });
    return entry;
  },

  async linkToWorldEntity(entryId: string, worldEntityId: string) {
    return prisma.worldEntry.update({
      where: { id: entryId },
      data: { worldEntityId },
    });
  },
};
