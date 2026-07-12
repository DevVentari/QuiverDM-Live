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

  it('scopes standing to the latest upload group, ignoring an older failed attempt', async () => {
    const s = await createSession(prisma, userId, { campaignId, title: 'Retried Session' });
    const older = new Date(Date.now() - 60_000);
    const newer = new Date();
    const failedRec = await prisma.sessionRecording.create({
      data: {
        sessionId: s.id, type: 'audio', originalUrl: 'old-key', fileSize: 1,
        isMultiTrack: true, uploadGroupId: 'group-old', mergeStatus: 'failed', createdAt: older,
      },
    });
    const completeRec = await prisma.sessionRecording.create({
      data: {
        sessionId: s.id, type: 'audio', originalUrl: 'new-key', fileSize: 1,
        isMultiTrack: true, uploadGroupId: 'group-new', mergeStatus: 'complete', createdAt: newer,
      },
    });
    const transcript = await prisma.transcript.create({
      data: { sessionId: s.id, rawText: 'test transcript' },
    });
    const list = await listSessions(prisma, userId, campaignId);
    const found = list.find((row) => row.id === s.id);
    expect(found?.standing).toBe('transcript ready');
    expect(found?.trackCount).toBe(1);

    await prisma.transcript.delete({ where: { id: transcript.id } });
    await prisma.sessionRecording.deleteMany({ where: { id: { in: [failedRec.id, completeRec.id] } } });
  });
});
