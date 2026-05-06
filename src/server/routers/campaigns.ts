/**
 * Campaigns Router
 *
 * Thin wrapper around CampaignService for campaign CRUD operations.
 * All business logic lives in the service layer.
 */

import { router, protectedProcedure, campaignOwnerProcedure, campaignMemberProcedure, campaignDMProcedure } from '../trpc';
import { z } from 'zod';
import { campaignService } from '../services/campaign.service';
import { prisma } from '../db';
import { serverTrack } from '@/lib/analytics.server';
import { EVENTS } from '@/lib/analytics-events';

// =============================================================================
// Input Schemas
// =============================================================================

const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional(),
  bannerUrl: z.string().optional(),
  settings: z.object({
    gameSystem: z.string().optional(),
    settingName: z.string().optional(),
    playerCount: z.number().min(1).max(20).optional(),
    startingLevel: z.number().min(1).max(20).optional(),
    schedule: z.object({
      day: z.string().optional(),
      time: z.string().optional(),
      frequency: z.string().optional(),
    }).optional(),
    houseRules: z.string().optional(),
    themes: z.array(z.string()).optional(),
  }).optional(),
  players: z.array(
    z.object({
      name: z.string().max(100),
      characterName: z.string().max(100),
    }).refine(
      (r) => r.name.trim() !== '' || r.characterName.trim() !== '',
      { message: 'Player row must have at least a name or character name' }
    )
  ).optional(),
});

const UpdateCampaignSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Campaign name is required').optional(),
  description: z.string().optional(),
  bannerUrl: z.string().optional(),
  status: z.enum(['planning', 'active', 'completed', 'archived']).optional(),
  glossary: z.record(z.string()).optional(),
});

// =============================================================================
// Router
// =============================================================================

export const campaignsRouter = router({
  /**
   * Get all campaigns where user is a member (any role)
   */
  getAll: protectedProcedure.query(({ ctx }) =>
    campaignService.getAll(ctx.session.user.id)
  ),

  /**
   * Get single campaign by ID (with membership verification)
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input, ctx }) =>
      campaignService.getById(input.id, ctx.session.user.id)
    ),

  /**
   * Get single campaign by slug (with membership verification)
   */
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ input, ctx }) =>
      campaignService.getBySlug(input.slug, ctx.session.user.id)
    ),

  /**
   * Create new campaign for authenticated user
   */
  create: protectedProcedure
    .input(CreateCampaignSchema)
    .mutation(async ({ input, ctx }) => {
      const campaign = await campaignService.create(ctx.session.user.id, input);
      void serverTrack(ctx.session.user.id, EVENTS.CAMPAIGN_CREATED, { campaign_id: campaign.id });
      return campaign;
    }),

  /**
   * Update campaign (requires owner access)
   */
  update: protectedProcedure
    .input(UpdateCampaignSchema)
    .mutation(({ input, ctx }) => {
      const { id, ...data } = input;
      return campaignService.update(id, ctx.session.user.id, data);
    }),

  /**
   * Delete campaign (requires owner access)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input, ctx }) =>
      campaignService.delete(input.id, ctx.session.user.id)
    ),

  /**
   * Get campaign stats
   */
  getStats: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ input, ctx }) =>
      campaignService.getStats(input.campaignId, ctx.session.user.id)
    ),

  /**
   * Get all campaigns for dashboard (optimized query)
   */
  getMyMemberships: protectedProcedure.query(({ ctx }) =>
    campaignService.getDashboardCampaigns(ctx.session.user.id)
  ),

  /**
   * Get pending campaign invites for current user
   */
  getPendingInvites: protectedProcedure.query(({ ctx }) =>
    campaignService.getPendingInvites(ctx.session.user.email)
  ),

  /**
   * Accept a campaign invite
   */
  acceptInvite: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(({ ctx, input }) =>
      campaignService.acceptInvite(
        input.inviteId,
        ctx.session.user.id,
        ctx.session.user.email
      )
    ),

  /**
   * Decline a campaign invite
   */
  declineInvite: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(({ ctx, input }) =>
      campaignService.declineInvite(input.inviteId, ctx.session.user.email)
    ),

  getDdbCampaignUrl: campaignMemberProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { dndBeyondCampaignUrl: true },
      });
      return { url: campaign?.dndBeyondCampaignUrl ?? null };
    }),

  setDdbCampaignUrl: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      url: z.string().regex(/dndbeyond\.com\/campaigns\/\d+/).nullable(),
    }))
    .mutation(async ({ input }) => {
      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: { dndBeyondCampaignUrl: input.url },
      });
      return { url: input.url };
    }),

  /**
   * Update campaign settings JSON (sourcebook, discordWebhookUrl, etc.)
   */
  updateSettings: campaignOwnerProcedure
    .input(z.object({
      campaignId: z.string(),
      sourcebook: z.string().optional(),
      discordWebhookUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { settings: true },
      });
      const current = (campaign?.settings ?? {}) as Record<string, unknown>;
      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: {
          settings: {
            ...current,
            ...(input.sourcebook !== undefined && { sourcebook: input.sourcebook }),
            ...(input.discordWebhookUrl !== undefined && { discordWebhookUrl: input.discordWebhookUrl }),
          },
        },
      });
    }),

  seedFromWorldSourcebook: protectedProcedure
    .input(z.object({
      campaignId: z.string(),
      sourceSlug: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const target = await prisma.campaign.findFirst({
        where: { id: input.campaignId, members: { some: { userId, role: { in: ['OWNER', 'CO_DM'] } } } },
      });
      if (!target) throw new Error('Campaign not found or insufficient permissions');

      const source = await prisma.campaign.findUnique({
        where: { slug: input.sourceSlug },
        include: {
          npcs: true,
          documents: true,
        },
      });
      if (!source) throw new Error(`World sourcebook "${input.sourceSlug}" not found`);

      // Copy campaign documents (lore, factions, locations, timelines)
      for (const doc of source.documents) {
        const existing = await prisma.campaignDocument.findUnique({
          where: { campaignId_slug: { campaignId: target.id, slug: doc.slug } },
        });
        if (existing) continue;
        await prisma.campaignDocument.create({
          data: {
            campaignId: target.id,
            title: doc.title,
            slug: doc.slug,
            type: doc.type,
            content: doc.content,
            data: doc.data ?? undefined,
            tags: doc.tags,
            sourceFile: doc.sourceFile ?? undefined,
            searchText: doc.searchText,
            brainIngestStatus: 'none',
          },
        });
      }

      // Copy NPCs
      for (const npc of source.npcs) {
        const existing = await prisma.nPC.findFirst({
          where: { campaignId: target.id, name: npc.name },
        });
        if (existing) continue;
        await prisma.nPC.create({
          data: {
            campaignId: target.id,
            name: npc.name,
            description: npc.description ?? undefined,
            role: npc.role ?? undefined,
            stats: npc.stats ?? undefined,
            tags: npc.tags,
          },
        });
      }

      const docCount = source.documents.length;
      const npcCount = source.npcs.length;
      return { docCount, npcCount };
    }),
});
