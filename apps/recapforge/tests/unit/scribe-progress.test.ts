import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getScribeProgress } from '@/server/services/sessions.service';
import { createForgeCampaign } from '@/server/services/campaign.service';

const prisma = new PrismaClient();
const EMAIL = `scribe-${Date.now()}@recapforge-test.local`;
let userId: string; let campaignId: string; let sessionId: string; let campaign2Id: string;

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'Scribe' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'Scribe Test')).id;
  campaign2Id = (await createForgeCampaign(prisma, userId, 'Scribe Test 2')).id;
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
  await prisma.campaign.deleteMany({ where: { id: { in: [campaignId, campaign2Id] } } });
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

  it('shows only the latest upload group when a session was re-delivered', async () => {
    // A second session with an OLD group (3 recordings) and a NEWER group (2).
    const s2 = await prisma.gameSession.create({ data: { campaignId, sessionNumber: 2, status: 'planning' } });
    const mk2 = (group: string, tag: string) => prisma.sessionRecording.create({
      data: { sessionId: s2.id, type: 'audio', originalUrl: `k2-${group}-${tag}`, fileSize: 1, isMultiTrack: true, uploadGroupId: group, speakerTag: tag, mergeStatus: 'processing' },
    });
    await mk2('old', 'a'); await mk2('old', 'b'); await mk2('old', 'c');
    // ensure the "new" group's rows are created later (createdAt ordering)
    await new Promise((r) => setTimeout(r, 10));
    await mk2('new', 'x'); await mk2('new', 'y');
    const p = await getScribeProgress(prisma, userId, { campaignId, sessionId: s2.id });
    expect(p.total).toBe(2); // only the latest group's 2 voices, not all 5
    expect(p.voices.map((v) => v.speakerLabel).sort()).toEqual(['x', 'y']);
  });

  it('refuses a non-owner', async () => {
    const stranger = await prisma.user.create({ data: { email: `s-${EMAIL}`, name: 'S' } });
    await expect(getScribeProgress(prisma, stranger.id, { campaignId, sessionId })).rejects.toThrow();
    await prisma.user.delete({ where: { id: stranger.id } });
  });

  it('refuses a foreign session under an owned campaign (cross-campaign scope)', async () => {
    const p = await getScribeProgress(prisma, userId, { campaignId: campaign2Id, sessionId });
    expect(p.total).toBe(0);
    expect(p.done).toBe(0);
    expect(p.failed).toBe(0);
    expect(p.overall).toBe('transcribing');
    expect(p.transcriptId).toBeNull();
    expect(p.voices).toEqual([]);
  });
});
