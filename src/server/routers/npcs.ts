import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { npcService } from '../services/npc.service';

export const npcsRouter = router({
  /**
   * Get all NPCs for a campaign with optional search
   * Supports multi-user: any campaign member can view NPCs
   */
  getAll: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        search: z.string().optional(),
      })
    )
    .query(({ input, ctx }) =>
      npcService.getByCampaignId(input.campaignId, ctx.session.user.id, {
        search: input.search,
      })
    ),

  /**
   * Get single NPC by ID
   * Supports multi-user: any campaign member can view
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(({ input, ctx }) =>
      npcService.getById(input.id, ctx.session.user.id)
    ),

  /**
   * Create new NPC
   * Requires DM access or canEditNPCs permission
   */
  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        name: z.string().min(1, 'Name is required').max(255),
        description: z.string().max(10000).optional(),
        faction: z.string().max(255).optional(),
        secrets: z.string().max(10000).optional(),
        imageUrl: z.string().url().optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const { campaignId, ...data } = input;
      return npcService.create(campaignId, ctx.session.user.id, data);
    }),

  /**
   * Update NPC
   * Requires DM access or canEditNPCs permission
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1, 'Name is required').max(255).optional(),
        description: z.string().max(10000).optional(),
        faction: z.string().max(255).optional(),
        secrets: z.string().max(10000).optional(),
        imageUrl: z.string().url().optional(),
        stats: z.any().optional(), // JSON field for D&D stats
      })
    )
    .mutation(({ input, ctx }) => {
      const { id, ...data } = input;
      return npcService.update(id, ctx.session.user.id, data);
    }),

  /**
   * Delete NPC
   * Requires DM access or canEditNPCs permission
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(({ input, ctx }) =>
      npcService.delete(input.id, ctx.session.user.id)
    ),

  /**
   * Get NPCs by faction
   * Supports multi-user: any campaign member can view
   */
  getByFaction: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        faction: z.string(),
      })
    )
    .query(({ input, ctx }) =>
      npcService.getByCampaignId(input.campaignId, ctx.session.user.id, {
        faction: input.faction,
      })
    ),

  /**
   * Get faction list for a campaign
   * Supports multi-user: any campaign member can view
   */
  getFactions: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
      })
    )
    .query(({ input, ctx }) =>
      npcService.getFactions(input.campaignId, ctx.session.user.id)
    ),
});
