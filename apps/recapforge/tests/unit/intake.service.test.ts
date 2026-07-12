import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  initiateTrackUpload, processTracks, getIntakeStatus, assignSpeaker, listSpeakerMappings, createSession, discardTrack,
} from '@/server/services/sessions.service';
import { createForgeCampaign } from '@/server/services/campaign.service';

const prisma = new PrismaClient();
const EMAIL = `intake-${Date.now()}@recapforge-test.local`;
let userId: string;
let campaignId: string;
let sessionId: string;
const uploadGroupId = `test-group-${Date.now()}`;

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: EMAIL, name: 'Intake Test' } })).id;
  campaignId = (await createForgeCampaign(prisma, userId, 'Intake Test')).id;
  sessionId = (await createSession(prisma, userId, { campaignId })).id;
});

afterAll(async () => {
  await prisma.campaign.deleteMany({ where: { id: campaignId } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

describe('intake', () => {
  it('initiate creates a pending multi-track SessionRecording with a scoped key', async () => {
    const res = await initiateTrackUpload(prisma, userId, {
      campaignId, sessionId, fileName: '1-alexdm.flac', fileSize: 1234,
      contentType: 'audio/flac', uploadGroupId, speakerTag: 'alexdm',
    });
    expect(res.r2Key).toMatch(new RegExp(`^session-recordings/${sessionId}/${uploadGroupId}/`));
    expect(res.uploadUrl).toContain('/api/uploads/track?key=');
    const rec = await prisma.sessionRecording.findUnique({ where: { id: res.recordingId } });
    expect(rec).toMatchObject({ isMultiTrack: true, mergeStatus: 'pending', uploadGroupId, speakerTag: 'alexdm' });
  });

  it('rejects non-audio content types', async () => {
    await expect(initiateTrackUpload(prisma, userId, {
      campaignId, sessionId, fileName: 'x.txt', fileSize: 10,
      contentType: 'text/plain', uploadGroupId,
    })).rejects.toThrow(/audio/i);
  });

  it('process enqueues once with the campaign/session/group payload', async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const res = await processTracks(prisma, enqueue, userId, { campaignId, sessionId, uploadGroupId });
    expect(res).toEqual({ queued: true, trackCount: 1 });
    expect(enqueue).toHaveBeenCalledWith({ uploadGroupId, sessionId, campaignId, userId });
  });

  it('status reports pending group', async () => {
    const s = await getIntakeStatus(prisma, userId, { campaignId, sessionId, uploadGroupId });
    expect(s.total).toBe(1);
    expect(s.overallStatus).toBe('pending');
    expect(s.transcriptId).toBeNull();
  });

  it('assignSpeaker upserts speaker memory', async () => {
    await assignSpeaker(prisma, userId, { campaignId, speakerLabel: 'alexdm', characterName: 'Alex — the DM', isDM: true });
    await assignSpeaker(prisma, userId, { campaignId, speakerLabel: 'alexdm', characterName: 'Alex', isDM: true });
    const mappings = await listSpeakerMappings(prisma, userId, campaignId);
    expect(mappings).toEqual([{ speakerLabel: 'alexdm', characterName: 'Alex', isDM: true }]);
  });

  describe('discardTrack', () => {
    it('removes a pending orphan recording, is a no-op on repeat, and rejects strangers', async () => {
      const discardGroupId = `discard-group-${Date.now()}`;
      const init = await initiateTrackUpload(prisma, userId, {
        campaignId, sessionId, fileName: 'orphan.flac', fileSize: 1,
        contentType: 'audio/flac', uploadGroupId: discardGroupId, speakerTag: 'orphan',
      });

      await discardTrack(prisma, userId, { campaignId, recordingId: init.recordingId });
      const gone = await prisma.sessionRecording.findUnique({ where: { id: init.recordingId } });
      expect(gone).toBeNull();

      // Repeat discard on the same (now-gone) id is a no-op, not a throw.
      await expect(discardTrack(prisma, userId, { campaignId, recordingId: init.recordingId })).resolves.toBeUndefined();

      // A stranger user is forbidden from discarding into this campaign at all.
      const strangerEmail = `discard-stranger-${Date.now()}@recapforge-test.local`;
      const stranger = await prisma.user.create({ data: { email: strangerEmail, name: 'Stranger' } });
      await expect(discardTrack(prisma, stranger.id, { campaignId, recordingId: init.recordingId }))
        .rejects.toMatchObject({ code: 'FORBIDDEN' });
      await prisma.user.delete({ where: { id: stranger.id } });
    });
  });
});
