import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { npcService } from '../services/npc.service';
import { serverTrack } from '@/lib/analytics.server';
import { EVENTS } from '@/lib/analytics-events';
import { mapDdbMonsterToNpc } from '@/lib/dndbeyond-monster-mapper';

const npcNameSchema = z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or fewer');
const npcDescriptionSchema = z.string().max(10000, 'Description must be 10000 characters or fewer');
const npcStatusSchema = z.enum(['alive', 'dead', 'missing', 'captured', 'fled', 'unknown']);
const npcPersonalitySchema = z.object({
  traits: z.array(z.string().max(500)).max(10).optional(),
  ideals: z.array(z.string().max(500)).max(10).optional(),
  bonds: z.array(z.string().max(500)).max(10).optional(),
  flaws: z.array(z.string().max(500)).max(10).optional(),
}).optional();

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
        stats: z.any().optional(),
        tags: z.array(z.string().max(100)).max(20).optional(),
        role: z.string().max(255).optional(),
        status: npcStatusSchema.optional(),
        location: z.string().max(1000).optional(),
        motivation: z.string().max(10000).optional(),
        personality: npcPersonalitySchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { campaignId, ...data } = input;
      const npc = await npcService.create(campaignId, ctx.session.user.id, data);
      void serverTrack(ctx.session.user.id, EVENTS.NPC_CREATED, { campaign_id: campaignId });
      return npc;
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
        tags: z.array(z.string().max(100)).max(20).optional(),
        role: z.string().max(255).optional(),
        playerVisible: z.boolean().optional(),
        status: npcStatusSchema.nullable().optional(),
        location: z.string().max(1000).nullable().optional(),
        motivation: z.string().max(10000).nullable().optional(),
        personality: npcPersonalitySchema.nullable().optional(),
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

  createFromDDB: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        monster: z.object({
          ddbId: z.string(),
          name: z.string(),
          type: z.string(),
          alignment: z.string(),
          ac: z.number(),
          acNote: z.string().optional(),
          hp: z.number(),
          hpDice: z.string().optional(),
          speed: z.record(z.number()),
          abilityScores: z.object({
            str: z.number(), dex: z.number(), con: z.number(),
            int: z.number(), wis: z.number(), cha: z.number(),
          }),
          savingThrows: z.record(z.number()),
          skills: z.record(z.number()),
          damageResistances: z.array(z.string()),
          damageImmunities: z.array(z.string()),
          conditionImmunities: z.array(z.string()),
          senses: z.record(z.union([z.string(), z.number()])),
          languages: z.string(),
          cr: z.string(),
          xp: z.number(),
          actions: z.array(z.object({
            name: z.string(),
            description: z.string(),
            attackBonus: z.number().optional(),
            damageDice: z.string().optional(),
            damageBonus: z.number().optional(),
            saveDc: z.number().optional(),
            saveType: z.string().optional(),
          })),
          legendaryActions: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
          reactions: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
          traits: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
          sourceUrl: z.string(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const mapped = mapDdbMonsterToNpc(input.monster);
      const npc = await npcService.create(input.campaignId, ctx.session.user.id, {
        name: mapped.name,
        description: mapped.description,
        faction: mapped.faction,
        role: mapped.role,
        tags: mapped.tags,
        stats: mapped.stats,
      });
      void serverTrack(ctx.session.user.id, EVENTS.NPC_CREATED, {
        source: 'ddb-extension',
        campaign_id: input.campaignId,
      });
      return npc;
    }),
});
