import type { PrismaClient } from '@prisma/client';
import { assertCampaignOwner } from '../guards';

export type Standing =
  | 'awaiting delivery'
  | 'in the composing room'
  | 'transcribing'
  | 'transcript ready'
  | 'illegible';

export function deriveStanding(recordings: Array<{ mergeStatus: string }>, transcriptCount: number): Standing {
  if (recordings.length === 0) return 'awaiting delivery';
  if (recordings.some((r) => r.mergeStatus === 'failed')) return 'illegible';
  if (recordings.every((r) => r.mergeStatus === 'complete') && transcriptCount > 0) return 'transcript ready';
  if (recordings.some((r) => r.mergeStatus === 'processing')) return 'transcribing';
  return 'in the composing room';
}

export async function createSession(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; title?: string },
): Promise<{ id: string; sessionNumber: number }> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const max = await prisma.gameSession.aggregate({
    where: { campaignId: input.campaignId },
    _max: { sessionNumber: true },
  });
  return prisma.gameSession.create({
    data: {
      campaignId: input.campaignId,
      sessionNumber: (max._max.sessionNumber ?? 0) + 1,
      title: input.title ?? null,
      status: 'planning',
    },
    select: { id: true, sessionNumber: true },
  });
}

export async function listSessions(prisma: PrismaClient, userId: string, campaignId: string) {
  await assertCampaignOwner(prisma, campaignId, userId);
  const sessions = await prisma.gameSession.findMany({
    where: { campaignId },
    select: {
      id: true,
      sessionNumber: true,
      title: true,
      date: true,
      recordings: { where: { isMultiTrack: true }, select: { mergeStatus: true } },
      _count: { select: { transcripts: true } },
    },
    orderBy: { sessionNumber: 'desc' },
  });
  return sessions.map((s) => ({
    id: s.id,
    sessionNumber: s.sessionNumber,
    title: s.title,
    date: s.date,
    standing: deriveStanding(s.recordings, s._count.transcripts),
    trackCount: s.recordings.length,
  }));
}
