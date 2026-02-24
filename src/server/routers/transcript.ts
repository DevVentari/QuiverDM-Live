import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import {
  getTranscript,
  getSessionTranscripts,
  updateTranscriptCorrection,
  updateTranscriptSegment,
  renameSpeaker,
  deleteTranscript,
} from '@/lib/transcription/db';
import { authz } from '../services/authorization.service';
import { BadRequestError, NotFoundError } from '../errors';

const TranscriptIdSchema = z.string().min(1);
const SessionIdSchema = z.string().min(1);
const SegmentTextSchema = z.string().min(1).max(20000);
const SpeakerNameSchema = z.string().min(1).max(255);

export const transcriptRouter = router({
  /**
   * Get a transcript by ID
   */
  getTranscript: protectedProcedure
    .input(
      z.object({
        transcriptId: TranscriptIdSchema,
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.transcript(input.transcriptId, userId);
      const transcript = await getTranscript(input.transcriptId);
      if (!transcript) {
        throw new NotFoundError('transcript', input.transcriptId);
      }
      return transcript;
    }),

  /**
   * Get all transcripts for a session
   */
  getSessionTranscripts: protectedProcedure
    .input(
      z.object({
        sessionId: SessionIdSchema,
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.session(input.sessionId, userId).verify();
      return await getSessionTranscripts(input.sessionId);
    }),

  /**
   * Update transcript with corrected text
   */
  updateCorrection: protectedProcedure
    .input(
      z.object({
        transcriptId: TranscriptIdSchema,
        correctedText: z.string().max(50000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.transcript(input.transcriptId, userId);
      await updateTranscriptCorrection(input.transcriptId, input.correctedText);
      return { success: true };
    }),

  updateSegment: protectedProcedure
    .input(
      z.object({
        transcriptId: TranscriptIdSchema,
        segmentIndex: z.number().int().min(0),
        text: SegmentTextSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const transcript = await authz.transcript(input.transcriptId, ctx.session.user.id);
      const timestamps = (transcript.timestamps as any[]) ?? [];

      if (input.segmentIndex >= timestamps.length) {
        throw new BadRequestError('Segment index is out of range for this transcript');
      }

      await updateTranscriptSegment(
        input.transcriptId,
        input.segmentIndex,
        input.text
      );
      return { success: true };
    }),

  renameSpeaker: protectedProcedure
    .input(
      z.object({
        transcriptId: TranscriptIdSchema,
        oldName: z.string().min(1).max(255),
        newName: SpeakerNameSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      await authz.transcript(input.transcriptId, ctx.session.user.id);
      await renameSpeaker(input.transcriptId, input.oldName, input.newName);
      return { success: true };
    }),

  /**
   * Delete a transcript
   */
  deleteTranscript: protectedProcedure
    .input(
      z.object({
        transcriptId: TranscriptIdSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.transcript(input.transcriptId, userId);
      await deleteTranscript(input.transcriptId);
      return { success: true };
    }),
});
