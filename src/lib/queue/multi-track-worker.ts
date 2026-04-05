/**
 * Multi-Track Processing Worker
 *
 * Transcribes multiple individual audio files, merges by timestamp,
 * and writes a single Transcript record.
 *
 * Run with: npm run worker:multi-track
 */

import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { prisma } from '../prisma';
import { getRedisConnection } from './queue';
import type { MultiTrackJobData, MultiTrackJobResult } from './multi-track-queue';
import {
  submitAsyncTranscription,
  pollTranscriptionStatus,
  getAsyncResult,
  getCampaignWordBoost,
} from '../transcription/assemblyai';
import { getSignedUrl } from '../storage';
import { mergeTranscripts, segmentsToText, type TrackInput } from '../recap/transcript-merger';
import {
  broadcastMultiTrackProgress,
  broadcastMultiTrackComplete,
  broadcastMultiTrackError,
} from '../../server/websocket';
import { applyMappingsToTranscriptData } from '../recap/speaker-mapping-utils';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveAudioUrl(originalUrl: string): Promise<string> {
  if (
    originalUrl.startsWith('session-recordings/') ||
    originalUrl.startsWith('files/')
  ) {
    return getSignedUrl(originalUrl, 3600);
  }
  if (originalUrl.startsWith('/api/storage/')) {
    const key = originalUrl.replace(/^\/api\/storage\//, '');
    return getSignedUrl(key, 3600);
  }
  return originalUrl;
}

async function transcribeTrack(
  recording: { id: string; originalUrl: string; speakerTag: string | null },
  wordBoost: string[]
): Promise<{ words: Array<{ text: string; start: number; end: number }>; durationMs: number }> {
  const audioUrl = await resolveAudioUrl(recording.originalUrl);

  const assemblyaiId = await submitAsyncTranscription({
    audioUrl,
    speakerLabels: false,
    wordBoost,
    boostParam: 'high',
  });

  // Poll until complete (max 30 min = 360 × 5s)
  let status = await pollTranscriptionStatus(assemblyaiId);
  let attempts = 0;
  while (status.status !== 'completed' && status.status !== 'error' && attempts < 360) {
    await sleep(5000);
    status = await pollTranscriptionStatus(assemblyaiId);
    attempts++;
  }

  if (status.status !== 'completed') {
    throw new Error(
      `AssemblyAI transcription timed out or failed for recording ${recording.id} (status: ${status.status})`
    );
  }

  const result = await getAsyncResult(assemblyaiId);
  if (!result.success) {
    throw new Error(`Failed to get result for recording ${recording.id}: ${result.error ?? 'unknown'}`);
  }

  // NOTE: TranscriptionSegment.start/end are in SECONDS — convert to ms for merger
  const words = result.segments.map((seg) => ({
    text: seg.text.trim(),
    start: Math.round(seg.start * 1000),
    end: Math.round(seg.end * 1000),
  }));

  const durationMs = result.duration * 1000;

  return { words, durationMs };
}

async function processMultiTrack(
  job: Job<MultiTrackJobData, MultiTrackJobResult>
): Promise<MultiTrackJobResult> {
  const { uploadGroupId, sessionId, campaignId } = job.data;

  console.log(`[MultiTrackWorker] Processing group ${uploadGroupId}`);

  // 1. Load all recordings for this group
  const recordings = await prisma.sessionRecording.findMany({
    where: { uploadGroupId },
    orderBy: { createdAt: 'asc' },
  });

  if (recordings.length === 0) {
    throw new Error(`No recordings found for uploadGroupId ${uploadGroupId}`);
  }

  // 2. Get word boost from campaign names + per-file speaker tags (spec: "speakerTag passed as word boost")
  const campaignWordBoost = await getCampaignWordBoost(campaignId);
  const speakerTags = recordings.map((r) => r.speakerTag).filter((t): t is string => Boolean(t));
  const wordBoost = [...new Set([...campaignWordBoost, ...speakerTags])];

  // Fetch existing speaker mappings — best-effort, never blocks transcription
  let mappingLookup = new Map<string, string>();
  try {
    const existingMappings = await prisma.speakerMapping.findMany({
      where: { campaignId },
      select: { speakerLabel: true, characterName: true },
    });
    mappingLookup = new Map(existingMappings.map((m) => [m.speakerLabel, m.characterName]));
  } catch (err) {
    console.warn('[MultiTrackWorker] Failed to load speaker mappings, continuing without:', err);
  }

  // 3. Mark all recordings as processing
  await prisma.sessionRecording.updateMany({
    where: { uploadGroupId },
    data: { mergeStatus: 'processing' },
  });

  // 4. Transcribe all tracks (max 3 concurrent)
  const tracks: TrackInput[] = [];
  const total = recordings.length;
  let completed = 0;

  for (let i = 0; i < recordings.length; i += 3) {
    const batch = recordings.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(async (rec, j) => {
        const speakerLabel = rec.speakerTag || `Speaker ${i + j}`;
        try {
          const { words } = await transcribeTrack(
            { id: rec.id, originalUrl: rec.originalUrl, speakerTag: rec.speakerTag },
            wordBoost
          );
          completed++;
          broadcastMultiTrackProgress(uploadGroupId, {
            recordingId: rec.id,
            completed,
            total,
            stage: 'transcribed',
          });
          return { words, speakerTag: speakerLabel };
        } catch (err) {
          broadcastMultiTrackError(uploadGroupId, String(err), rec.id);
          throw err;
        }
      })
    );
    tracks.push(...results);
  }

  // 5. Merge transcripts by timestamp
  const segments = mergeTranscripts(tracks);
  const rawText = segmentsToText(segments);

  const uniqueSpeakers = [...new Set(tracks.map((t) => t.speakerTag))];
  const rawSpeakers = uniqueSpeakers.map((name, i) => ({
    id: `S${i}`,
    name,
    segments: segments.filter((s) => s.speaker === name).length,
  }));
  const rawTimestamps = segments.map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text,
    speaker: s.speaker,
  }));

  const { speakers: speakersJson, timestamps: resolvedTimestamps } = applyMappingsToTranscriptData(
    rawSpeakers,
    rawTimestamps,
    mappingLookup
  );

  // 6. Write Transcript record
  const transcript = await prisma.transcript.create({
    data: {
      sessionId,
      rawText,
      correctedText: rawText,
      speakers: speakersJson,
      timestamps: resolvedTimestamps,
      hasSpeakers: true,
      durationSeconds:
        segments.length > 0
          ? Math.round(segments[segments.length - 1].end / 1000)
          : 0,
    },
  });

  // 7. Update all recordings to complete
  await prisma.sessionRecording.updateMany({
    where: { uploadGroupId },
    data: { mergeStatus: 'complete' },
  });

  // 8. Broadcast completion
  broadcastMultiTrackComplete(uploadGroupId, transcript.id);

  console.log(`[MultiTrackWorker] Done — transcript ${transcript.id}`);

  return { success: true, transcriptId: transcript.id, tracksProcessed: tracks.length };
}

// ---------------------------------------------------------------------------
// Worker bootstrap
// ---------------------------------------------------------------------------

const worker = new Worker<MultiTrackJobData, MultiTrackJobResult>(
  'multi-track-processing',
  processMultiTrack,
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[MultiTrackWorker] Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[MultiTrackWorker] Job ${job?.id} failed:`, err);
  if (job?.data.uploadGroupId) {
    broadcastMultiTrackError(job.data.uploadGroupId, err.message);
    prisma.sessionRecording
      .updateMany({
        where: { uploadGroupId: job.data.uploadGroupId },
        data: { mergeStatus: 'failed' },
      })
      .catch(console.error);
  }
});

worker.on('error', (err) => {
  console.error('[MultiTrackWorker] Worker error:', err);
});

console.log('[MultiTrackWorker] Started — listening on multi-track-processing queue');
