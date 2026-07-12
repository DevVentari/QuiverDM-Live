import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getGalleyTranscript } from '@/server/services/transcript.service';
import { createForgeCampaign } from '@/server/services/campaign.service';

const prisma = new PrismaClient();
const EMAIL = `gal-${Date.now()}@recapforge-test.local`;
let userId: string; let campaignId: string; let sessionId: string;

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'Gal' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'Galley Test')).id;
  const s = await prisma.gameSession.create({ data: { campaignId, sessionNumber: 1, status: 'planning' } });
  sessionId = s.id;
  await prisma.transcript.create({
    data: {
      sessionId, rawText: 'x', correctedText: 'x', hasSpeakers: true, source: 'multi_track',
      timestamps: [
        { start: 0, end: 10, text: 'We begin.', speaker: 'The DM' },
        { start: 10, end: 20, text: 'pizza is here', speaker: "Kah'Roak" },
      ],
      oocReviewItems: [
        { index: 1, speaker: "Kah'Roak", text: 'pizza is here', start_formatted: '0:10', classification: 'ooc', confidence: 0.9, reason: 'table talk' },
      ],
      cleanupStatus: 'ooc_pending_review',
    },
  });
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('getGalleyTranscript', () => {
  it('returns indexed character-named lines + ooc marks', async () => {
    const g = (await getGalleyTranscript(prisma, userId, { campaignId, sessionId }))!;
    expect(g.lines).toHaveLength(2);
    expect(g.lines[0]).toMatchObject({ index: 0, speaker: 'The DM', text: 'We begin.' });
    expect(g.oocMarks).toHaveLength(1);
    expect(g.oocMarks[0]).toMatchObject({ index: 1, reason: 'table talk' });
    expect(g.cleanupStatus).toBe('ooc_pending_review');
  });

  it('returns null when no transcript exists', async () => {
    const s2 = await prisma.gameSession.create({ data: { campaignId, sessionNumber: 2, status: 'planning' } });
    expect(await getGalleyTranscript(prisma, userId, { campaignId, sessionId: s2.id })).toBeNull();
  });
});
