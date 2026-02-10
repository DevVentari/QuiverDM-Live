/**
 * Session Repository
 * Data access layer for session-related database operations.
 */

import { prisma } from '../db';

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
          hasSpeakers: true,
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

export async function create(data: {
  campaignId: string;
  title: string;
  sessionNumber: number;
  date?: Date;
  summary?: string;
  status?: string;
  quickNotes?: string;
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

export const sessionRepository = {
  findById,
  findByCampaignId,
  findActiveByCampaignId,
  create,
  update,
  remove,
  getNextSessionNumber,
};
