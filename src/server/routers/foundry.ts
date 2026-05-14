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
  getSettings: campaignDMProcedure
    .query(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { settings: true },
      });
      const s = (campaign?.settings ?? {}) as Record<string, unknown>;
      return {
        foundryUrl: (s.foundryUrl as string | null | undefined) ?? null,
        ddbVttUrl: (s.ddbVttUrl as string | null | undefined) ?? null,
      };
    }),

  setFoundryUrl: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), foundryUrl: z.string().url().or(z.literal('')) }))
    .mutation(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { settings: true },
      });
      const current = (campaign?.settings ?? {}) as Record<string, unknown>;
      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: { settings: { ...current, foundryUrl: input.foundryUrl || null } },
      });
      return { ok: true };
    }),

  setDdbVttUrl: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), ddbVttUrl: z.string().url().or(z.literal('')) }))
    .mutation(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { settings: true },
      });
      const current = (campaign?.settings ?? {}) as Record<string, unknown>;
      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: { settings: { ...current, ddbVttUrl: input.ddbVttUrl || null } },
      });
      return { ok: true };
    }),

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

  syncSession: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), sessionId: z.string().cuid() }))
    .mutation(async ({ input }) => {
      const appearances = await prisma.sessionEntityAppearance.findMany({
        where: { sessionId: input.sessionId, campaignId: input.campaignId },
        include: {
          entity: {
            select: {
              id: true,
              name: true,
              description: true,
              imageUrl: true,
            },
          },
        },
      })

      const characters = await prisma.character.findMany({
        where: { campaignCharacters: { some: { campaignId: input.campaignId } } },
        select: { id: true, name: true, portraitUrl: true },
      })

      const jobs: Array<{
        campaignId: string
        type: string
        sourceId: string
        sourceName: string
        payload: Prisma.InputJsonValue
        status: string
      }> = []

      for (const app of appearances) {
        const actor = mapNpcToActor({
          id: app.entity.id,
          name: app.entity.name,
          description: app.entity.description,
          imageUrl: app.entity.imageUrl,
        })
        jobs.push({
          campaignId: input.campaignId,
          type: 'actor_upsert',
          sourceId: app.entity.id,
          sourceName: app.entity.name,
          payload: actor as Prisma.InputJsonValue,
          status: 'pending',
        })
      }

      for (const char of characters) {
        jobs.push({
          campaignId: input.campaignId,
          type: 'actor_upsert',
          sourceId: char.id,
          sourceName: char.name,
          payload: {
            name: char.name,
            type: 'character',
            img: char.portraitUrl ?? 'icons/svg/mystery-man.svg',
            system: { attributes: { hp: { value: 0, max: 0 } } },
          } as Prisma.InputJsonValue,
          status: 'pending',
        })
      }

      if (appearances.length > 0 || characters.length > 0) {
        jobs.push({
          campaignId: input.campaignId,
          type: 'token_place',
          sourceId: input.sessionId,
          sourceName: 'Session tokens',
          payload: {
            sessionId: input.sessionId,
            npcSourceIds: appearances.map((a) => a.entity.id),
            playerSourceIds: characters.map((c) => c.id),
          } as Prisma.InputJsonValue,
          status: 'pending',
        })
      }

      if (jobs.length > 0) {
        await prisma.foundryImportJob.createMany({ data: jobs })
      }

      return { queued: jobs.length }
    }),

  activateScene: campaignDMProcedure
    .input(z.object({ campaignId: z.string(), foundrySceneId: z.string() }))
    .mutation(async ({ input }) => {
      await prisma.foundryImportJob.create({
        data: {
          campaignId: input.campaignId,
          type: 'scene_activate',
          sourceId: input.foundrySceneId,
          sourceName: 'Scene activation',
          payload: { sceneId: input.foundrySceneId } as Prisma.InputJsonValue,
          status: 'pending',
        },
      })
      return { ok: true }
    }),
});
