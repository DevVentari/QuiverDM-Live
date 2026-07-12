import type { PrismaClient } from '@prisma/client';
import { mergeTranscripts, segmentsToText, type TrackWord } from './transcript-merger';

export async function persistTrackTranscript(
  prisma: PrismaClient,
  input: {
    sessionId: string; uploadGroupId: string; recordingId: string;
    speakerLabel: string; characterName: string | null;
    words: TrackWord[]; status: 'done' | 'error';
  },
): Promise<void> {
  // Build this one voice's segments + text (single-track merge groups its own words).
  const segments = mergeTranscripts([{ words: input.words, speakerTag: input.characterName ?? input.speakerLabel }]);
  const text = segmentsToText(segments);
  const data = {
    sessionId: input.sessionId,
    uploadGroupId: input.uploadGroupId,
    speakerLabel: input.speakerLabel,
    characterName: input.characterName,
    text,
    segments: segments as unknown as object,
    status: input.status,
  };
  await prisma.trackTranscript.upsert({
    where: { recordingId: input.recordingId },
    update: data,
    create: { recordingId: input.recordingId, ...data },
  });
}
