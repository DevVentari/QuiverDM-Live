import { router, publicProcedure, protectedProcedure } from '../trpc';
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

export const transcriptRouter = router({
  /**
   * Get a transcript by ID
   */
  getTranscript: protectedProcedure
    .input(
      z.object({
        transcriptId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.transcript(input.transcriptId, userId);
      const transcript = await getTranscript(input.transcriptId);
      if (!transcript) {
        throw new Error('Transcript not found');
      }
      return transcript;
    }),

  /**
   * Get all transcripts for a session
   */
  getSessionTranscripts: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
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
        transcriptId: z.string(),
        correctedText: z.string(),
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
        transcriptId: z.string(),
        segmentIndex: z.number().int().min(0),
        text: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await authz.transcript(input.transcriptId, ctx.session.user.id);
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
        transcriptId: z.string(),
        oldName: z.string(),
        newName: z.string().min(1),
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
        transcriptId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.transcript(input.transcriptId, userId);
      await deleteTranscript(input.transcriptId);
      return { success: true };
    }),
});
