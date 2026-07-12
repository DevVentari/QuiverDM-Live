import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getScribeProgress } from '@/server/services/sessions.service';
import { createForgeCampaign } from '@/server/services/campaign.service';

const prisma = new PrismaClient();
const EMAIL = `scribe-${Date.now()}@recapforge-test.local`;
let userId: string; let campaignId: string; let sessionId: string;

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'Scribe' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'Scribe Test')).id;
  const s = await prisma.gameSession.create({ data: { campaignId, sessionNumber: 1, status: 'planning' } });
  sessionId = s.id;
  const mk = (tag: string, status: string) => prisma.sessionRecording.create({
    data: { sessionId, type: 'audio', originalUrl: `k-${tag}`, fileSize: 1, isMultiTrack: true, uploadGroupId: 'g', speakerTag: tag, mergeStatus: status },
  });
  const r1 = await mk('thechunk_', 'processing');
  const r2 = await mk('ven_tari', 'processing');
  await prisma.trackTranscript.create({ data: { sessionId, recordingId: r1.id, uploadGroupId: 'g', speakerLabel: 'thechunk_', characterName: 'The DM', text: 'The DM: We begin.', segments: [], status: 'done' } });
  // r2 has no TrackTranscript yet → still transcribing
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('getScribeProgress', () => {
  it('reports per-voice status + revealed text mid-transcription', async () => {
    const p = await getScribeProgress(prisma, userId, { campaignId, sessionId });
    expect(p.total).toBe(2);
    expect(p.done).toBe(1);
    expect(p.overall).toBe('transcribing');
    expect(p.transcriptId).toBeNull();
    const dm = p.voices.find((v) => v.speakerLabel === 'thechunk_')!;
    expect(dm.status).toBe('done');
    expect(dm.characterName).toBe('The DM');
    expect(dm.text).toContain('We begin');
    expect(dm.key).toBe('k-thechunk_');
    const beast = p.voices.find((v) => v.speakerLabel === 'ven_tari')!;
    expect(beast.status).toBe('transcribing');
    expect(beast.key).toBe('k-ven_tari');
  });

  it('refuses a non-owner', async () => {
    const stranger = await prisma.user.create({ data: { email: `s-${EMAIL}`, name: 'S' } });
    await expect(getScribeProgress(prisma, stranger.id, { campaignId, sessionId })).rejects.toThrow();
    await prisma.user.delete({ where: { id: stranger.id } });
  });
});
