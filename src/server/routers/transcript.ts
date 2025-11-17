import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import {
  getTranscript,
  getSessionTranscripts,
  updateTranscriptCorrection,
  deleteTranscript,
} from '@/lib/transcription-db';
import { verifyTranscriptOwnership, verifySessionOwnership } from '../lib/ownership';

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
      await verifyTranscriptOwnership(input.id, userId);
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
      await verifySessionOwnership(input.sessionId, userId);
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
      await verifyTranscriptOwnership(input.id, userId);
      await updateTranscriptCorrection(input.transcriptId, input.correctedText);
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
      await verifyTranscriptOwnership(input.id, userId);
      await deleteTranscript(input.transcriptId);
      return { success: true };
    }),
});
