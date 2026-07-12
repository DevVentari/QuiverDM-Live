import type { PrismaClient } from '@prisma/client';
import { assertCampaignOwner } from '../guards';

type Ts = { start: number; end: number; text: string; speaker: string };
type Ooc = { index: number; text: string; reason: string; classification: string; verdict?: 'strike' | 'stet' };

export async function getGalleyTranscript(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; sessionId: string },
) {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const t = await prisma.transcript.findFirst({
    where: { sessionId: input.sessionId, session: { campaignId: input.campaignId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, timestamps: true, oocReviewItems: true, cleanupStatus: true },
  });
  if (!t) return null;
  const timestamps = (Array.isArray(t.timestamps) ? t.timestamps : []) as unknown as Ts[];
  const lines = timestamps.map((ts, index) => ({ index, speaker: ts.speaker, text: ts.text, start: ts.start }));
  const rawOoc = (Array.isArray(t.oocReviewItems) ? t.oocReviewItems : []) as unknown as Array<{ index: number; text: string; reason: string; classification: string }>;
  const oocMarks: Ooc[] = rawOoc.map((o) => ({
    index: o.index,
    text: o.text,
    reason: o.reason,
    classification: o.classification,
    verdict: (o as { verdict?: 'strike' | 'stet' }).verdict,
  }));
  return { transcriptId: t.id, lines, oocMarks, cleanupStatus: t.cleanupStatus };
}

export async function resolveOoc(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; transcriptId: string; index: number; verdict: 'strike' | 'stet' },
): Promise<void> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const t = await prisma.transcript.findUnique({
    where: { id: input.transcriptId },
    select: { id: true, sessionId: true, oocReviewItems: true, timestamps: true, correctedText: true, session: { select: { campaignId: true } } },
  });
  if (!t || t.session.campaignId !== input.campaignId) return;
  const items = (Array.isArray(t.oocReviewItems) ? t.oocReviewItems : []) as unknown as Array<Record<string, unknown>>;
  const updated = items.map((it) => (it.index === input.index ? { ...it, verdict: input.verdict } : it));

  let correctedText = t.correctedText ?? '';
  if (input.verdict === 'strike') {
    const ts = (Array.isArray(t.timestamps) ? t.timestamps : []) as unknown as Array<{ text: string; speaker: string }>;
    const line = ts[input.index];
    if (line) {
      // Remove the "Speaker: text" line the cleanup built into correctedText.
      const needle = `${line.speaker}: ${line.text}`;
      correctedText = correctedText
        .split('\n\n')
        .filter((para) => para.trim() !== needle.trim())
        .join('\n\n');
    }
  }
  await prisma.transcript.update({
    where: { id: input.transcriptId },
    data: { oocReviewItems: updated as unknown as object, correctedText },
  });
}
