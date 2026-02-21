import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import {
  getTranscript,
  getSessionTranscripts,
  updateTranscriptCorrection,
  deleteTranscript,
} from '@/lib/transcription/db';
import { authz } from '../services/authorization.service';
import { NotFoundError } from '../errors';

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
