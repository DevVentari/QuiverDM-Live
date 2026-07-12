import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  createSession, listSessions, initiateTrackUpload, processTracks, getIntakeStatus, assignSpeaker, listSpeakerMappings, discardTrack,
} from '../services/sessions.service';
import { addMultiTrackJob } from '@/lib/queue';

export const forgeSessionsRouter = router({
  create: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), title: z.string().max(200).optional() }))
    .mutation(({ ctx, input }) => createSession(ctx.prisma, ctx.session.user.id, input)),
  list: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(({ ctx, input }) => listSessions(ctx.prisma, ctx.session.user.id, input.campaignId)),
  initiate: protectedProcedure
    .input(z.object({
      campaignId: z.string().min(1),
      sessionId: z.string().min(1),
      fileName: z.string().min(1).max(255),
      fileSize: z.number().int().positive().max(2_000_000_000),
      contentType: z.string().min(1),
      uploadGroupId: z.string().min(1).max(64),
      speakerTag: z.string().max(64).optional(),
    }))
    .mutation(({ ctx, input }) => initiateTrackUpload(ctx.prisma, ctx.session.user.id, input)),
  process: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), sessionId: z.string().min(1), uploadGroupId: z.string().min(1) }))
    .mutation(({ ctx, input }) => processTracks(ctx.prisma, addMultiTrackJob, ctx.session.user.id, input)),
  status: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), sessionId: z.string().min(1), uploadGroupId: z.string().min(1) }))
    .query(({ ctx, input }) => getIntakeStatus(ctx.prisma, ctx.session.user.id, input)),
  assignSpeaker: protectedProcedure
    .input(z.object({
      campaignId: z.string().min(1),
      speakerLabel: z.string().min(1).max(100),
      characterName: z.string().min(1).max(100),
      isDM: z.boolean().default(false),
    }))
    .mutation(({ ctx, input }) => assignSpeaker(ctx.prisma, ctx.session.user.id, input)),
  mappings: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(({ ctx, input }) => listSpeakerMappings(ctx.prisma, ctx.session.user.id, input.campaignId)),
  discard: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), recordingId: z.string().min(1) }))
    .mutation(({ ctx, input }) => discardTrack(ctx.prisma, ctx.session.user.id, input)),
});
