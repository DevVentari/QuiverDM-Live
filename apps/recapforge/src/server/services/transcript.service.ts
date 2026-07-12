import type { PrismaClient } from '@prisma/client';
import { assertCampaignOwner } from '../guards';

type Ts = { start: number; end: number; text: string; speaker: string };
type Ooc = { index: number; text: string; reason: string; classification: string };

export async function getGalleyTranscript(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; sessionId: string },
) {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const t = await prisma.transcript.findFirst({
    where: { sessionId: input.sessionId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, timestamps: true, oocReviewItems: true, cleanupStatus: true },
  });
  if (!t) return null;
  const timestamps = (Array.isArray(t.timestamps) ? t.timestamps : []) as unknown as Ts[];
  const lines = timestamps.map((ts, index) => ({ index, speaker: ts.speaker, text: ts.text, start: ts.start }));
  const rawOoc = (Array.isArray(t.oocReviewItems) ? t.oocReviewItems : []) as unknown as Array<{ index: number; text: string; reason: string; classification: string }>;
  const oocMarks: Ooc[] = rawOoc.map((o) => ({ index: o.index, text: o.text, reason: o.reason, classification: o.classification }));
  return { transcriptId: t.id, lines, oocMarks, cleanupStatus: t.cleanupStatus };
}
