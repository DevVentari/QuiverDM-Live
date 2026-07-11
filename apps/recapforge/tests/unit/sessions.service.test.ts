import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { deriveStanding, createSession, listSessions } from '@/server/services/sessions.service';
import { createForgeCampaign } from '@/server/services/campaign.service';

const prisma = new PrismaClient();
const EMAIL = `sess-${Date.now()}@recapforge-test.local`;
let userId: string;
let campaignId: string;

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'Sess Test' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'Sessions Test')).id;
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('deriveStanding', () => {
  it.each([
    [[], 0, 'awaiting delivery'],
    [[{ mergeStatus: 'pending' }], 0, 'in the composing room'],
    [[{ mergeStatus: 'pending' }, { mergeStatus: 'processing' }], 0, 'transcribing'],
    [[{ mergeStatus: 'complete' }], 1, 'transcript ready'],
    [[{ mergeStatus: 'complete' }, { mergeStatus: 'failed' }], 0, 'illegible'],
  ])('%j / %i transcripts → %s', (recs, tCount, expected) => {
    expect(deriveStanding(recs as { mergeStatus: string }[], tCount as number)).toBe(expected);
  });
});

describe('createSession / listSessions', () => {
  it('numbers sessions sequentially and lists with standing', async () => {
    const s1 = await createSession(prisma, userId, { campaignId });
    const s2 = await createSession(prisma, userId, { campaignId, title: 'The Withering Weeks' });
    expect(s2.sessionNumber).toBe(s1.sessionNumber + 1);
    const list = await listSessions(prisma, userId, campaignId);
    expect(list[0].title).toBe('The Withering Weeks'); // newest first
    expect(list[0].standing).toBe('awaiting delivery');
  });
});
