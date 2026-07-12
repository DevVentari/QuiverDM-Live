import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  createForgeCampaign, listForgeCampaigns, addPartyMember, listParty, importPartyFromDdb,
} from '../services/campaign.service';
import { ddbClient } from '@/lib/ddb';

export const forgeCampaignRouter = router({
  mine: protectedProcedure.query(({ ctx }) => listForgeCampaigns(ctx.prisma, ctx.session.user.id)),
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(120) }))
    .mutation(({ ctx, input }) => createForgeCampaign(ctx.prisma, ctx.session.user.id, input.name)),
  addPartyMember: protectedProcedure
    .input(z.object({
      campaignId: z.string().min(1),
      playerName: z.string().min(1).max(100),
      characterName: z.string().min(1).max(100),
    }))
    .mutation(({ ctx, input }) => addPartyMember(ctx.prisma, ctx.session.user.id, input)),
  party: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(({ ctx, input }) => listParty(ctx.prisma, ctx.session.user.id, input.campaignId)),
  importParty: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), campaignUrl: z.string().url() }))
    .mutation(({ ctx, input }) => importPartyFromDdb(ctx.prisma, ddbClient, ctx.session.user.id, input)),
});
