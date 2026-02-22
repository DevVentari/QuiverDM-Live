import { PrismaClient } from '@prisma/client';
import type {
  TranscriptionSegment,
  WhisperXTranscriptionResult,
} from './whisperx';
import { addEmbeddingJob } from '@/lib/queue/embeddings-queue';
import { deleteEntityEmbeddings } from '@/server/repositories/embedding.repository';

// Alias for compatibility
type LocalTranscriptionResult = WhisperXTranscriptionResult;
type SpeakerTranscriptionResult = WhisperXTranscriptionResult;

const prisma = new PrismaClient();

export interface SaveTranscriptParams {
  sessionId: string;
  recordingId?: string;
  result: LocalTranscriptionResult | SpeakerTranscriptionResult;
}

/**
 * Check if result is from speaker diarization
 */
function isSpeakerResult(
  result: LocalTranscriptionResult | SpeakerTranscriptionResult
): result is SpeakerTranscriptionResult {
  return 'hasSpeakers' in result;
}

async function enqueueTranscriptEmbedding(transcriptId: string) {
  const transcript = await prisma.transcript.findUnique({
    where: { id: transcriptId },
    include: {
      session: {
        select: {
          campaignId: true,
          sessionNumber: true,
          title: true,
          date: true,
        },
      },
    },
  });

  if (!transcript) {
    return;
  }

  const text = (transcript.correctedText || transcript.rawText || '').trim();
  if (!text) {
    return;
  }

  void addEmbeddingJob({
    entityId: transcript.id,
    entityType: 'transcript',
    text,
    metadata: {
      sessionId: transcript.sessionId,
      sessionNumber: transcript.session.sessionNumber,
      title: transcript.session.title,
      date: transcript.session.date.toISOString(),
    },
    campaignId: transcript.session.campaignId,
  }).catch((error) => {
    console.error('[embeddings] Failed to enqueue transcript:', error);
  });
}

/**
 * Save transcription result to database
 */
export async function saveTranscript(
  params: SaveTranscriptParams
): Promise<string> {
  const { sessionId, recordingId, result } = params;

  if (!result.success) {
    throw new Error('Cannot save failed transcription');
  }

  const hasSpeakers = isSpeakerResult(result) && result.hasSpeakers;
  const textWithSpeakers = isSpeakerResult(result)
    ? result.textWithSpeakers
    : undefined;

  // Extract speakers if available
  const speakers = hasSpeakers
    ? extractUniqueSpeakers(result.segments)
    : null;

  // Prepare timestamps data
  const timestamps = result.segments.map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text,
    speaker: 'speaker' in seg ? seg.speaker : undefined,
  }));

  // Create transcript record
  const transcript = await prisma.transcript.create({
    data: {
      sessionId,
      recordingId,
      rawText: result.text,
      correctedText: textWithSpeakers || result.text,
      speakers: speakers || undefined,
      timestamps,
      language: result.language,
      languageProbability: result.language_probability,
      durationSeconds: result.duration,
      hasSpeakers,
    },
  });

  await enqueueTranscriptEmbedding(transcript.id);

  return transcript.id;
}

/**
 * Extract unique speakers from segments
 */
function extractUniqueSpeakers(
  segments: any[]
): { id: string; name: string; segments: number }[] | null {
  const speakerMap = new Map<string, number>();

  for (const segment of segments) {
    if ('speaker' in segment && segment.speaker) {
      const count = speakerMap.get(segment.speaker) || 0;
      speakerMap.set(segment.speaker, count + 1);
    }
  }

  if (speakerMap.size === 0) {
    return null;
  }

  return Array.from(speakerMap.entries()).map(([speaker, count]) => ({
    id: speaker,
    name: speaker,
    segments: count,
  }));
}

/**
 * Update transcript with corrected text
 */
export async function updateTranscriptCorrection(
  transcriptId: string,
  correctedText: string
): Promise<void> {
  await prisma.transcript.update({
    where: { id: transcriptId },
    data: { correctedText },
  });
  await enqueueTranscriptEmbedding(transcriptId);
}

/**
 * Get transcript by ID
 */
export async function getTranscript(transcriptId: string) {
  return await prisma.transcript.findUnique({
    where: { id: transcriptId },
    include: {
      session: true,
      recording: true,
    },
  });
}

/**
 * Get transcripts for a session
 */
export async function getSessionTranscripts(sessionId: string) {
  return await prisma.transcript.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    include: {
      recording: true,
    },
  });
}

/**
 * Delete transcript
 */
export async function deleteTranscript(transcriptId: string): Promise<void> {
  await prisma.transcript.delete({
    where: { id: transcriptId },
  });
  try {
    await deleteEntityEmbeddings(transcriptId, 'transcript');
  } catch (error) {
    console.error('[embeddings] Failed to delete transcript embeddings:', error);
  }
}

export async function updateTranscriptSegment(
  transcriptId: string,
  segmentIndex: number,
  newText: string
): Promise<void> {
  const transcript = await prisma.transcript.findUnique({
    where: { id: transcriptId },
  });
  if (!transcript?.timestamps) return;
  const segments = transcript.timestamps as Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  if (segmentIndex < 0 || segmentIndex >= segments.length) return;
  segments[segmentIndex] = { ...segments[segmentIndex], text: newText };
  await prisma.transcript.update({
    where: { id: transcriptId },
    data: { timestamps: segments },
  });
  await enqueueTranscriptEmbedding(transcriptId);
}

export async function renameSpeaker(
  transcriptId: string,
  oldName: string,
  newName: string
): Promise<void> {
  const transcript = await prisma.transcript.findUnique({
    where: { id: transcriptId },
  });
  if (!transcript) return;
  const segments = ((transcript.timestamps as any[]) ?? []).map((seg: any) =>
    seg.speaker === oldName ? { ...seg, speaker: newName } : seg
  );
  const speakers = ((transcript.speakers as any[]) ?? []).map((sp: any) =>
    sp.id === oldName ? { ...sp, id: newName, name: newName } : sp
  );
  await prisma.transcript.update({
    where: { id: transcriptId },
    data: { timestamps: segments, speakers },
  });
  await enqueueTranscriptEmbedding(transcriptId);
}
