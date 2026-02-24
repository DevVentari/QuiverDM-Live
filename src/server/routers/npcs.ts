import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { npcService } from '../services/npc.service';

const npcNameSchema = z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or fewer');
const npcDescriptionSchema = z.string().max(10000, 'Description must be 10000 characters or fewer');

export const npcsRouter = router({
  /**
   * Get all NPCs for a campaign with optional search
   * Supports multi-user: any campaign member can view NPCs
   */
  getAll: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        search: z.string().max(10000).optional(),
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
        id: z.string().min(1),
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
        name: npcNameSchema,
        description: npcDescriptionSchema.optional(),
        faction: z.string().max(255).optional(),
        secrets: z.string().max(10000).optional(),
        imageUrl: z.string().max(2048).optional(),
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
        name: npcNameSchema.optional(),
        description: npcDescriptionSchema.optional(),
        faction: z.string().max(255).optional(),
        secrets: z.string().max(10000).optional(),
        imageUrl: z.string().max(2048).optional(),
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
        id: z.string().min(1),
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
        campaignId: z.string().min(1),
        faction: z.string().min(1).max(255),
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
        campaignId: z.string().min(1),
      })
    )
    .query(({ input, ctx }) =>
      npcService.getFactions(input.campaignId, ctx.session.user.id)
    ),
});
