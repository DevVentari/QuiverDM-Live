import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { router, campaignDMProcedure, campaignMemberProcedure } from '../trpc';
import { prisma } from '../db';
import { createFoundryApiKey } from '../foundry-api-key';
import { NotFoundError } from '../errors';
import {
  mapHomebrewToItem,
  mapNpcToActor,
  mapSessionToJournal,
} from '@/lib/foundry-export';

export const foundryRouter = router({
  generateApiKey: campaignDMProcedure
    .mutation(async ({ input }) => {
      const apiKey = createFoundryApiKey(input.campaignId);
      const apiKeyHash = await bcrypt.hash(apiKey, 12);

      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: {
          foundryApiKey: apiKeyHash,
        },
      });

      return { apiKey };
    }),

  getEvents: campaignMemberProcedure
    .input(
      z.object({
        campaignId: z.string(),
        sessionId: z.string().cuid(),
        cursor: z.string().cuid().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const events = await prisma.foundryEvent.findMany({
        where: {
          campaignId: input.campaignId,
          sessionId: input.sessionId,
        },
        cursor: input.cursor ? { id: input.cursor } : undefined,
        take: input.limit + 1,
        skip: input.cursor ? 1 : 0,
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | undefined;
      if (events.length > input.limit) {
        const nextItem = events.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: events.map((event) => ({
          ...event,
          payload: event.payload as Prisma.JsonValue,
        })),
        nextCursor,
      };
    }),

  createImportJob: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        type: z.enum(['npc', 'homebrew_item', 'homebrew_spell', 'session_journal']),
        sourceId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      let payload: Record<string, unknown>;
      let sourceName: string;

      if (input.type === 'npc') {
        const npc = await prisma.nPC.findUnique({
          where: { id: input.sourceId },
        });

        if (!npc || npc.campaignId !== input.campaignId) {
          throw new NotFoundError('npc', input.sourceId);
        }

        payload = mapNpcToActor(npc);
        sourceName = npc.name;
      } else if (input.type === 'homebrew_item' || input.type === 'homebrew_spell') {
        const item = await prisma.homebrewContent.findUnique({
          where: { id: input.sourceId },
        });

        if (!item) {
          throw new NotFoundError('homebrew', input.sourceId);
        }

        payload = mapHomebrewToItem(item);
        sourceName = item.name;
      } else {
        const session = await prisma.gameSession.findUnique({
          where: { id: input.sourceId },
        });

        if (!session || session.campaignId !== input.campaignId) {
          throw new NotFoundError('session', input.sourceId);
        }

        payload = mapSessionToJournal(session);
        sourceName = session.title ?? `Session ${session.sessionNumber}`;
      }

      const job = await prisma.foundryImportJob.create({
        data: {
          campaignId: input.campaignId,
          type: input.type,
          sourceId: input.sourceId,
          sourceName,
          payload: payload as Prisma.InputJsonValue,
        },
      });

      return {
        jobId: job.id,
        sourceName,
      };
    }),

  getImportJobs: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        status: z.string().optional(),
      })
    )
    .query(({ input }) =>
      prisma.foundryImportJob.findMany({
        where: {
          campaignId: input.campaignId,
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
        select: {
          id: true,
          type: true,
          sourceName: true,
          status: true,
          createdAt: true,
          deliveredAt: true,
          error: true,
        },
      })
    ),

  cancelImportJob: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        jobId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const job = await prisma.foundryImportJob.findUnique({
        where: { id: input.jobId },
      });

      if (!job || job.campaignId !== input.campaignId) {
        throw new NotFoundError('job', input.jobId);
      }

      await prisma.foundryImportJob.update({
        where: { id: input.jobId },
        data: {
          status: 'error',
          error: 'Cancelled by DM',
        },
      });

      return { ok: true };
    }),
});
