/**
 * Session Repository
 * Data access layer for session-related database operations.
 */

import { prisma } from '../db';
import type { Prisma } from '@prisma/client';

export async function findById(id: string) {
  return prisma.gameSession.findUnique({
    where: { id },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
        },
      },
      recordings: true,
      transcripts: true,
      _count: {
        select: {
          recaps: { where: { approvedAt: { not: null } } },
        },
      },
    },
  });
}

export async function findByCampaignId(campaignId: string) {
  return prisma.gameSession.findMany({
    where: { campaignId },
    orderBy: { sessionNumber: 'desc' },
    include: {
      recordings: {
        select: {
          id: true,
          originalUrl: true,
          durationSeconds: true,
        },
      },
      transcripts: {
        select: {
          id: true,
          rawText: true,
          correctedText: true,
          hasSpeakers: true,
          source: true,
        },
      },
      _count: {
        select: {
          recaps: { where: { approvedAt: { not: null } } },
        },
      },
    },
  });
}

export async function findActiveByCampaignId(campaignId: string) {
  return prisma.gameSession.findFirst({
    where: {
      campaignId,
      status: 'in_progress',
    },
    orderBy: { sessionNumber: 'desc' },
  });
}

/** Return the N most recent sessions that have recaps, for loose-thread detection. */
export async function findRecentByCampaignId(campaignId: string, limit = 5) {
  return prisma.gameSession.findMany({
    where: {
      campaignId,
      recap: { not: null },
    },
    orderBy: { sessionNumber: 'desc' },
    take: limit,
    select: {
      id: true,
      sessionNumber: true,
      title: true,
      recap: true,
      aiSummary: true,
    },
  });
}

export async function create(data: {
  campaignId: string;
  title: string;
  sessionNumber: number;
  date?: Date;
  summary?: string;
  status?: string;
  quickNotes?: string;
  prepData?: Prisma.InputJsonValue;
  prepStatus?: string;
}) {
  return prisma.gameSession.create({ data });
}

export async function update(
  id: string,
  data: {
    title?: string;
    summary?: string;
    date?: Date;
    status?: string;
    quickNotes?: string;
    recap?: string;
    prepData?: Prisma.InputJsonValue;
    prepStatus?: string;
    playerVisibility?: string;
    aiSummaryStatus?: string;
    aiSummary?: string;
    aiHighlights?: Prisma.InputJsonValue;
    aiSummaryError?: string | null;
    aiSummaryAt?: Date | null;
    shareToken?: string;
  }
) {
  return prisma.gameSession.update({ where: { id }, data });
}

export async function updatePrep(
  id: string,
  data: {
    prepData: Prisma.InputJsonValue;
    prepStatus: string;
  }
) {
  return prisma.gameSession.update({ where: { id }, data });
}

export async function remove(id: string) {
  return prisma.gameSession.delete({ where: { id } });
}

export async function getNextSessionNumber(campaignId: string) {
  const lastSession = await prisma.gameSession.findFirst({
    where: { campaignId },
    orderBy: { sessionNumber: 'desc' },
    select: { sessionNumber: true },
  });
  return (lastSession?.sessionNumber ?? 0) + 1;
}

export async function updateSummaryStatus(
  id: string,
  data: {
    aiSummaryStatus: string;
    aiSummary?: string;
    aiHighlights?: Prisma.InputJsonValue;
    aiSummaryError?: string | null;
    aiSummaryAt?: Date | null;
  }
) {
  return prisma.gameSession.update({ where: { id }, data });
}

export async function findByShareToken(shareToken: string) {
  return prisma.gameSession.findUnique({
    where: { shareToken },
    include: {
      campaign: { select: { id: true, name: true } },
      transcripts: {
        select: {
          id: true,
          rawText: true,
          correctedText: true,
          speakers: true,
          timestamps: true,
        },
      },
    },
  });
}

export async function setShareToken(id: string, shareToken: string) {
  return prisma.gameSession.update({ where: { id }, data: { shareToken } });
}

export async function findByCampaignIdWithSummaries(campaignId: string) {
  return prisma.gameSession.findMany({
    where: { campaignId },
    orderBy: { sessionNumber: 'desc' },
    select: {
      id: true,
      sessionNumber: true,
      title: true,
      date: true,
      status: true,
      prepStatus: true,
      aiSummary: true,
      aiSummaryStatus: true,
      aiHighlights: true,
      shareToken: true,
    },
  });
}

export const sessionRepository = {
  findById,
  findByCampaignId,
  findActiveByCampaignId,
  findRecentByCampaignId,
  create,
  update,
  updatePrep,
  remove,
  getNextSessionNumber,
  updateSummaryStatus,
  findByShareToken,
  setShareToken,
  findByCampaignIdWithSummaries,
};
