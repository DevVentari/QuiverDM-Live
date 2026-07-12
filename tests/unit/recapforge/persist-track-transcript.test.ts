import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { persistTrackTranscript } from '@/lib/recap/track-transcript';

const prisma = new PrismaClient();
const EMAIL = `ptt-${Date.now()}@recapforge-test.local`;
let sessionId: string;
let recordingId: string;

beforeAll(async () => {
  const user = await prisma.user.create({ data: { email: EMAIL, name: 'PTT' } });
  const c = await prisma.campaign.create({ data: { name: 'PTT', slug: `ptt-${Date.now()}`, userId: user.id, settings: { recapforge: true } } });
  const s = await prisma.gameSession.create({ data: { campaignId: c.id, sessionNumber: 1, status: 'planning' } });
  sessionId = s.id;
  const rec = await prisma.sessionRecording.create({
    data: { sessionId, type: 'audio', originalUrl: 'k', fileSize: 1, isMultiTrack: true, uploadGroupId: 'g1', speakerTag: 'thechunk_', mergeStatus: 'processing' },
  });
  recordingId = rec.id;
});

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (user) { await prisma.campaign.deleteMany({ where: { userId: user.id } }); await prisma.user.delete({ where: { id: user.id } }); }
  await prisma.$disconnect();
});

describe('persistTrackTranscript', () => {
  it('upserts a done track with text built from words', async () => {
    await persistTrackTranscript(prisma, {
      sessionId, uploadGroupId: 'g1', recordingId, speakerLabel: 'thechunk_', characterName: 'The DM',
      words: [{ text: 'Hello', start: 0, end: 500 }, { text: 'there', start: 500, end: 1000 }], status: 'done',
    });
    const row = await prisma.trackTranscript.findUnique({ where: { recordingId } });
    expect(row?.status).toBe('done');
    expect(row?.characterName).toBe('The DM');
    expect(row?.text).toContain('Hello there');
  });

  it('is idempotent on recordingId (re-run overwrites, no dupes)', async () => {
    await persistTrackTranscript(prisma, {
      sessionId, uploadGroupId: 'g1', recordingId, speakerLabel: 'thechunk_', characterName: 'The DM',
      words: [{ text: 'Again', start: 0, end: 500 }], status: 'done',
    });
    const rows = await prisma.trackTranscript.findMany({ where: { recordingId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toContain('Again');
  });
});
