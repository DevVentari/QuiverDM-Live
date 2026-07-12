import { randomBytes } from 'crypto';
import { TRPCError } from '@trpc/server';
import type { PrismaClient } from '@prisma/client';
import { assertCampaignOwner } from '../guards';
import { getStorageMode } from '@main/lib/storage';

export type Standing =
  | 'awaiting delivery'
  | 'in the composing room'
  | 'transcribing'
  | 'transcript ready'
  | 'illegible';

export function deriveStanding(recordings: Array<{ mergeStatus: string }>, transcriptCount: number): Standing {
  if (recordings.length === 0) return 'awaiting delivery';
  if (recordings.some((r) => r.mergeStatus === 'failed')) return 'illegible';
  if (recordings.every((r) => r.mergeStatus === 'complete') && transcriptCount > 0) return 'transcript ready';
  if (recordings.some((r) => r.mergeStatus === 'processing')) return 'transcribing';
  return 'in the composing room';
}

export async function createSession(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; title?: string },
): Promise<{ id: string; sessionNumber: number }> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const max = await prisma.gameSession.aggregate({
    where: { campaignId: input.campaignId },
    _max: { sessionNumber: true },
  });
  return prisma.gameSession.create({
    data: {
      campaignId: input.campaignId,
      sessionNumber: (max._max.sessionNumber ?? 0) + 1,
      title: input.title ?? null,
      status: 'planning',
    },
    select: { id: true, sessionNumber: true },
  });
}

export async function listSessions(prisma: PrismaClient, userId: string, campaignId: string) {
  await assertCampaignOwner(prisma, campaignId, userId);
  const sessions = await prisma.gameSession.findMany({
    where: { campaignId },
    select: {
      id: true,
      sessionNumber: true,
      title: true,
      suggestedTitle: true,
      suggestedVoice: true,
      date: true,
      recordings: { where: { isMultiTrack: true }, select: { mergeStatus: true, uploadGroupId: true, createdAt: true } },
      _count: { select: { transcripts: true } },
    },
    orderBy: { sessionNumber: 'desc' },
  });
  return sessions.map((s) => {
    let latestGroupRecordings = s.recordings;
    if (s.recordings.length > 0) {
      const latest = s.recordings.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
      latestGroupRecordings = s.recordings.filter((r) => r.uploadGroupId === latest.uploadGroupId);
    }
    return {
      id: s.id,
      sessionNumber: s.sessionNumber,
      title: s.title ?? s.suggestedTitle,
      suggestedVoice: s.title ? null : s.suggestedVoice,
      date: s.date,
      standing: deriveStanding(latestGroupRecordings, s._count.transcripts),
      trackCount: latestGroupRecordings.length,
    };
  });
}

export async function getSession(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; sessionId: string },
) {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  return prisma.gameSession.findFirst({
    where: { id: input.sessionId, campaignId: input.campaignId },
    select: { id: true, sessionNumber: true, title: true, suggestedTitle: true, suggestedVoice: true, suggestedChapter: true },
  });
}

export async function applyTitle(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; sessionId: string; title?: string; voice?: string; chapter?: number },
): Promise<void> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  await prisma.gameSession.updateMany({
    where: { id: input.sessionId, campaignId: input.campaignId },
    data: {
      ...(input.title !== undefined ? { title: input.title, suggestedTitle: input.title } : {}),
      ...(input.voice !== undefined ? { suggestedVoice: input.voice } : {}),
      ...(input.chapter !== undefined ? { suggestedChapter: input.chapter } : {}),
    },
  });
}

/**
 * Pass the galley for press — the DM's sign-off that the reviewed transcript is
 * the final chronicle. Marks the session complete. Publishing it to the players'
 * wiki (the literal "press") is P5; this records the approval P5 will build on.
 */
export async function passForPress(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; sessionId: string },
): Promise<void> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  await prisma.gameSession.updateMany({
    where: { id: input.sessionId, campaignId: input.campaignId },
    data: { status: 'completed' },
  });
}

const ALLOWED_AUDIO_TYPES = new Set([
  'audio/flac', 'audio/x-flac', 'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/opus',
  'audio/x-m4a', 'audio/webm',
]);

export async function initiateTrackUpload(
  prisma: PrismaClient,
  userId: string,
  input: {
    campaignId: string; sessionId: string; fileName: string; fileSize: number;
    contentType: string; uploadGroupId: string; speakerTag?: string;
  },
): Promise<{ uploadUrl: string; r2Key: string; recordingId: string; isLocalMode: boolean }> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const session = await prisma.gameSession.findFirst({
    where: { id: input.sessionId, campaignId: input.campaignId },
    select: { id: true },
  });
  if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found in this campaign.' });
  if (!ALLOWED_AUDIO_TYPES.has(input.contentType)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Only audio tracks may be delivered (got ${input.contentType}).` });
  }
  const sanitized = input.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  // Key shape matches the main app's multiTrackUpload.initiate so the homelab
  // worker resolves tracks identically.
  const r2Key = `session-recordings/${input.sessionId}/${input.uploadGroupId}/${Date.now()}-${randomBytes(3).toString('hex')}-${sanitized}`;
  const recording = await prisma.sessionRecording.create({
    data: {
      sessionId: input.sessionId,
      type: 'audio',
      originalUrl: r2Key,
      fileSize: input.fileSize,
      isMultiTrack: true,
      uploadGroupId: input.uploadGroupId,
      speakerTag: input.speakerTag ?? null,
      mergeStatus: 'pending',
      trackFiles: [{ filename: input.fileName, r2Key, speakerTag: input.speakerTag ?? null }],
    },
    select: { id: true },
  });
  // In R2 (prod) the browser PUTs the file DIRECTLY to R2 via a presigned URL —
  // Craig tracks routinely exceed Cloudflare's 100MB body cap, so routing them
  // through the app would 413. Local dev keeps the FormData POST to our route.
  const isLocalMode = getStorageMode() !== 'r2';
  let uploadUrl: string;
  if (isLocalMode) {
    uploadUrl = `/api/uploads/track?key=${encodeURIComponent(r2Key)}`;
  } else {
    // Dynamic import keeps the AWS SDK type graph out of the forge tsc project.
    const { getPresignedUploadUrl } = await import('@main/lib/storage/r2');
    uploadUrl = await getPresignedUploadUrl(r2Key, input.contentType, 3600);
  }
  return { uploadUrl, r2Key, recordingId: recording.id, isLocalMode };
}

export async function processTracks(
  prisma: PrismaClient,
  enqueue: (d: { uploadGroupId: string; sessionId: string; campaignId: string; userId?: string }) => Promise<unknown>,
  userId: string,
  input: { campaignId: string; sessionId: string; uploadGroupId: string },
): Promise<{ queued: true; trackCount: number }> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const recordings = await prisma.sessionRecording.findMany({
    where: { sessionId: input.sessionId, uploadGroupId: input.uploadGroupId },
    select: { mergeStatus: true },
  });
  if (recordings.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tracks have been delivered for this session.' });
  }
  if (recordings.some((r) => r.mergeStatus === 'processing' || r.mergeStatus === 'complete')) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'The scribe has already begun on these tracks.' });
  }
  await enqueue({ uploadGroupId: input.uploadGroupId, sessionId: input.sessionId, campaignId: input.campaignId, userId });
  return { queued: true, trackCount: recordings.length };
}

export async function getIntakeStatus(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; sessionId: string; uploadGroupId: string },
) {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const recordings = await prisma.sessionRecording.findMany({
    where: { sessionId: input.sessionId, uploadGroupId: input.uploadGroupId },
    select: { mergeStatus: true },
  });
  const done = recordings.filter((r) => r.mergeStatus === 'complete').length;
  const failed = recordings.filter((r) => r.mergeStatus === 'failed').length;
  const overallStatus: 'pending' | 'processing' | 'complete' | 'failed' =
    failed > 0 ? 'failed'
    : recordings.length > 0 && done === recordings.length ? 'complete'
    : recordings.some((r) => r.mergeStatus === 'processing') ? 'processing'
    : 'pending';
  const transcript = overallStatus === 'complete'
    ? await prisma.transcript.findFirst({
        where: { sessionId: input.sessionId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
    : null;
  return { total: recordings.length, done, failed, overallStatus, transcriptId: transcript?.id ?? null };
}

export async function assignSpeaker(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; speakerLabel: string; characterName: string; isDM: boolean },
): Promise<void> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  await prisma.speakerMapping.upsert({
    where: { campaignId_speakerLabel: { campaignId: input.campaignId, speakerLabel: input.speakerLabel } },
    update: { characterName: input.characterName, isDM: input.isDM },
    create: {
      campaignId: input.campaignId,
      speakerLabel: input.speakerLabel,
      characterName: input.characterName,
      isDM: input.isDM,
    },
  });
}

export async function listSpeakerMappings(prisma: PrismaClient, userId: string, campaignId: string) {
  await assertCampaignOwner(prisma, campaignId, userId);
  return prisma.speakerMapping.findMany({
    where: { campaignId },
    select: { speakerLabel: true, characterName: true, isDM: true },
    orderBy: { speakerLabel: 'asc' },
  });
}

export async function discardTrack(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; recordingId: string },
): Promise<void> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  await prisma.sessionRecording.deleteMany({
    where: {
      id: input.recordingId,
      mergeStatus: 'pending',
      session: { campaignId: input.campaignId },
    },
  });
}

export async function getScribeProgress(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; sessionId: string },
) {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const owns = await prisma.gameSession.findFirst({ where: { id: input.sessionId, campaignId: input.campaignId }, select: { id: true } });
  if (!owns) return { total: 0, done: 0, failed: 0, overall: 'transcribing' as const, transcriptId: null, voices: [] };
  const allRecordings = await prisma.sessionRecording.findMany({
    where: { sessionId: input.sessionId, isMultiTrack: true },
    select: { id: true, speakerTag: true, mergeStatus: true, originalUrl: true, uploadGroupId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  // Scope to the LATEST upload group (the most-recent delivery) — a session
  // re-delivered several times must show only the current attempt, not every
  // group's tracks stacked together. Mirrors the ledger's standing derivation.
  const latestGroup = allRecordings.length
    ? allRecordings[allRecordings.length - 1].uploadGroupId
    : null;
  const recordings = allRecordings.filter((r) => r.uploadGroupId === latestGroup);
  const tracks = await prisma.trackTranscript.findMany({
    where: { sessionId: input.sessionId },
    select: { recordingId: true, characterName: true, text: true, status: true },
  });
  const byRec = new Map(tracks.map((t) => [t.recordingId, t]));
  const voices = recordings.map((r) => {
    const t = byRec.get(r.id);
    const status: 'queued' | 'transcribing' | 'done' | 'error' =
      t?.status === 'done' ? 'done'
      : t?.status === 'error' ? 'error'
      : r.mergeStatus === 'processing' ? 'transcribing'
      : 'queued';
    return {
      recordingId: r.id,
      speakerLabel: r.speakerTag ?? r.originalUrl,
      characterName: t?.characterName ?? null,
      status,
      text: t?.text ?? '',
      key: r.originalUrl,
    };
  });
  const done = voices.filter((v) => v.status === 'done').length;
  const failed = voices.filter((v) => v.status === 'error').length;
  const transcript = await prisma.transcript.findFirst({
    where: { sessionId: input.sessionId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const overall: 'transcribing' | 'complete' | 'illegible' =
    failed > 0 && done < voices.length ? 'illegible'
    : transcript && recordings.every((r) => r.mergeStatus === 'complete') ? 'complete'
    : 'transcribing';
  return { total: voices.length, done, failed, overall, transcriptId: transcript?.id ?? null, voices };
}
