import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { router, campaignDMProcedure, campaignMemberProcedure } from '../trpc';
import { prisma } from '../db';
import { createFoundryApiKey } from '../foundry-api-key';

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
});
