import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifySessionOwnership, verifyCampaignOwnership } from '../lib/ownership';

export const sessionsRouter = router({
  /**
   * Get all sessions for a campaign
   */
  getAll: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      if (input.campaignId) {
        await verifyCampaignOwnership(input.campaignId, userId);
      }
      const sessions = await prisma.gameSession.findMany({
        where: {
          campaignId: input.campaignId,
        },
        orderBy: {
          sessionNumber: 'desc',
        },
        include: {
          recordings: {
            select: {
              id: true,
              originalUrl: true,
              durationSeconds: true,
            },
          },
          transcripts: {
            select: {
              id: true,
              rawText: true,
              hasSpeakers: true,
            },
          },
        },
      });

      return sessions;
    }),

  /**
   * Get single session by ID
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifySessionOwnership(input.id, userId);
      const session = await prisma.gameSession.findUnique({
        where: {
          id: input.id,
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
          recordings: true,
          transcripts: true,
        },
      });

      return session;
    }),

  /**
   * Create new session
   */
  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        title: z.string().optional(),
        quickNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyCampaignOwnership(input.campaignId, userId);
      // Get next session number
      const lastSession = await prisma.gameSession.findFirst({
        where: {
          campaignId: input.campaignId,
        },
        orderBy: {
          sessionNumber: 'desc',
        },
        select: {
          sessionNumber: true,
        },
      });

      const nextSessionNumber = (lastSession?.sessionNumber ?? 0) + 1;

      const session = await prisma.gameSession.create({
        data: {
          campaignId: input.campaignId,
          sessionNumber: nextSessionNumber,
          title: input.title || `Session ${nextSessionNumber}`,
          quickNotes: input.quickNotes,
          status: 'in_progress',
        },
      });

      return session;
    }),

  /**
   * Update session
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        quickNotes: z.string().optional(),
        recap: z.string().optional(),
        status: z.enum(['planning', 'in_progress', 'completed']).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifySessionOwnership(input.id, userId);
      const { id, ...data } = input;

      const session = await prisma.gameSession.update({
        where: { id },
        data,
      });

      return session;
    }),

  /**
   * Delete session
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifySessionOwnership(input.id, userId);
      await prisma.gameSession.delete({
        where: {
          id: input.id,
        },
      });

      return { success: true };
    }),

  /**
   * Get active session for a campaign
   */
  getActive: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyCampaignOwnership(input.campaignId, userId);
      const activeSession = await prisma.gameSession.findFirst({
        where: {
          campaignId: input.campaignId,
          status: 'in_progress',
        },
        orderBy: {
          sessionNumber: 'desc',
        },
      });

      return activeSession;
    }),

  /**
   * Complete session
   */
  complete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        recap: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifySessionOwnership(input.id, userId);
      const session = await prisma.gameSession.update({
        where: { id: input.id },
        data: {
          status: 'completed',
          recap: input.recap,
        },
      });

      return session;
    }),
});
