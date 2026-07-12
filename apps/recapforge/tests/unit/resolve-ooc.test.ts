import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { resolveOoc, getGalleyTranscript } from '@/server/services/transcript.service';
import { createForgeCampaign } from '@/server/services/campaign.service';

const prisma = new PrismaClient();
const EMAIL = `ooc-${Date.now()}@recapforge-test.local`;
let userId: string; let campaignId: string; let sessionId: string; let transcriptId: string;

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'Ooc' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'Ooc Test')).id;
  const s = await prisma.gameSession.create({ data: { campaignId, sessionNumber: 1, status: 'planning' } });
  sessionId = s.id;
  const t = await prisma.transcript.create({
    data: {
      sessionId, rawText: 'x',
      correctedText: 'The DM: We begin.\n\nKah\'Roak: pizza is here',
      hasSpeakers: true, source: 'multi_track',
      timestamps: [
        { start: 0, end: 10, text: 'We begin.', speaker: 'The DM' },
        { start: 10, end: 20, text: 'pizza is here', speaker: "Kah'Roak" },
      ],
      oocReviewItems: [{ index: 1, speaker: "Kah'Roak", text: 'pizza is here', start_formatted: '0:10', classification: 'ooc', confidence: 0.9, reason: 'table talk' }],
      cleanupStatus: 'ooc_pending_review',
    },
  });
  transcriptId = t.id;
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('resolveOoc', () => {
  it('strike removes the line from correctedText and records the verdict', async () => {
    await resolveOoc(prisma, userId, { campaignId, transcriptId, index: 1, verdict: 'strike' });
    const t = await prisma.transcript.findUnique({ where: { id: transcriptId }, select: { correctedText: true } });
    expect(t?.correctedText).not.toContain('pizza is here');
    const g = (await getGalleyTranscript(prisma, userId, { campaignId, sessionId }))!;
    expect(g.oocMarks[0]).toMatchObject({ index: 1, verdict: 'strike' });
  });

  it('stet leaves the text and records the verdict', async () => {
    // re-seed a stet mark at index 0
    await resolveOoc(prisma, userId, { campaignId, transcriptId, index: 1, verdict: 'stet' });
    const g = (await getGalleyTranscript(prisma, userId, { campaignId, sessionId }))!;
    expect(g.oocMarks[0].verdict).toBe('stet');
  });

  it('refuses a non-owner', async () => {
    const stranger = await prisma.user.create({ data: { email: `s-${EMAIL}`, name: 'S' } });
    await expect(resolveOoc(prisma, stranger.id, { campaignId, transcriptId, index: 1, verdict: 'strike' })).rejects.toThrow();
    await prisma.user.delete({ where: { id: stranger.id } });
  });
});
