import {
  router,
  protectedProcedure,
  campaignMemberProcedure,
  campaignDMProcedure,
} from '../trpc';
import { z } from 'zod';
import { CharacterStatus } from '@prisma/client';
import { characterService } from '../services/character.service';
import { NotFoundError, ForbiddenError, ValidationError } from '../errors';
import { prisma } from '@/lib/prisma';

// Zod schemas for character data
const abilityScoresSchema = z
  .object({
    str: z.number().min(1).max(30),
    dex: z.number().min(1).max(30),
    con: z.number().min(1).max(30),
    int: z.number().min(1).max(30),
    wis: z.number().min(1).max(30),
    cha: z.number().min(1).max(30),
  })
  .optional();

const hitPointsSchema = z
  .object({
    current: z.number().min(0),
    max: z.number().min(1),
    temp: z.number().min(0).default(0),
  })
  .optional();

const currencySchema = z
  .object({
    cp: z.number().min(0).default(0),
    sp: z.number().min(0).default(0),
    ep: z.number().min(0).default(0),
    gp: z.number().min(0).default(0),
    pp: z.number().min(0).default(0),
  })
  .optional();

/**
 * Characters Router
 * Handles player-owned character management
 */
export const charactersRouter = router({
  // ===========================================================================
  // CHARACTER QUERIES
  // ===========================================================================

  /**
   * Get all characters owned by the current user
   */
  getMyCharacters: protectedProcedure.query(({ ctx }) =>
    characterService.getMyCharacters(ctx.session.user.id)
  ),

  /**
   * Get a single character by ID (owner only)
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input, ctx }) =>
      characterService.getById(input.id, ctx.session.user.id)
    ),

  /**
   * Get characters in a campaign (for DMs and party members)
   */
  getCampaignCharacters: campaignMemberProcedure.query(({ input, ctx }) =>
    characterService.getCampaignCharacters(input.campaignId, ctx.session.user.id, {
      isOwner: ctx.membership.isOwner,
      isCoOwner: ctx.membership.isCoOwner,
    })
  ),

  // ===========================================================================
  // CHARACTER MUTATIONS
  // ===========================================================================

  /**
   * Create a new character
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Character name is required'),
        race: z.string().optional(),
        class: z.string().optional(),
        subclass: z.string().optional(),
        level: z.number().min(1).max(20).default(1),
        background: z.string().optional(),
        portraitUrl: z.string().url().optional(),
        isPortable: z.boolean().default(true),
        abilityScores: abilityScoresSchema,
        hitPoints: hitPointsSchema,
        armorClass: z.number().min(1).max(30).optional(),
        speed: z.number().min(0).max(200).optional(),
        backstory: z.string().optional(),
        personalityTraits: z.string().optional(),
        ideals: z.string().optional(),
        bonds: z.string().optional(),
        flaws: z.string().optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      characterService.create(ctx.session.user.id, input)
    ),

  /**
   * Update a character (owner only)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        race: z.string().optional(),
        class: z.string().optional(),
        subclass: z.string().optional(),
        level: z.number().min(1).max(20).optional(),
        background: z.string().optional(),
        portraitUrl: z.string().url().nullable().optional(),
        isPortable: z.boolean().optional(),
        abilityScores: abilityScoresSchema,
        hitPoints: hitPointsSchema,
        armorClass: z.number().min(1).max(30).nullable().optional(),
        speed: z.number().min(0).max(200).nullable().optional(),
        proficiencyBonus: z.number().min(2).max(6).optional(),
        features: z.any().optional(),
        proficiencies: z.any().optional(),
        inventory: z.any().optional(),
        spellcasting: z.any().optional(),
        hitDice: z.any().optional(),
        currency: currencySchema,
        backstory: z.string().nullable().optional(),
        personalityTraits: z.string().nullable().optional(),
        ideals: z.string().nullable().optional(),
        bonds: z.string().nullable().optional(),
        flaws: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const { id, ...data } = input;
      return characterService.update(id, ctx.session.user.id, data);
    }),

  /**
   * Delete a character (owner only)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input, ctx }) =>
      characterService.delete(input.id, ctx.session.user.id)
    ),

  // ===========================================================================
  // CAMPAIGN CHARACTER MANAGEMENT
  // ===========================================================================

  /**
   * Add a character to a campaign (pending approval)
   */
  addToCampaign: protectedProcedure
    .input(
      z.object({
        characterId: z.string(),
        campaignId: z.string(),
      })
    )
    .mutation(({ input, ctx }) =>
      characterService.addToCampaign(
        input.characterId,
        input.campaignId,
        ctx.session.user.id
      )
    ),

  /**
   * Approve a character for a campaign (DM only)
   */
  approveCharacter: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        campaignCharacterId: z.string(),
      })
    )
    .mutation(({ input }) =>
      characterService.approveCharacter(input.campaignCharacterId, input.campaignId)
    ),

  /**
   * Update character status in campaign (DM only)
   */
  updateCampaignStatus: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        campaignCharacterId: z.string(),
        status: z.nativeEnum(CharacterStatus),
        dmNotes: z.string().optional(),
      })
    )
    .mutation(({ input }) =>
      characterService.updateCampaignStatus(
        input.campaignCharacterId,
        input.campaignId,
        input.status,
        input.dmNotes
      )
    ),

  /**
   * Remove a character from a campaign (DM or owner)
   */
  removeFromCampaign: protectedProcedure
    .input(z.object({ campaignCharacterId: z.string() }))
    .mutation(({ input, ctx }) =>
      characterService.removeFromCampaign(
        input.campaignCharacterId,
        ctx.session.user.id
      )
    ),

  /**
   * Update DM notes for a campaign character (DM only)
   */
  updateDMNotes: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        campaignCharacterId: z.string(),
        dmNotes: z.string(),
      })
    )
    .mutation(({ input }) =>
      characterService.updateDMNotes(
        input.campaignCharacterId,
        input.campaignId,
        input.dmNotes
      )
    ),

  /**
   * Add homebrew item to character
   */
  addHomebrewItem: protectedProcedure
    .input(
      z.object({
        characterId: z.string(),
        homebrewId: z.string(),
        quantity: z.number().min(1).default(1),
        equipped: z.boolean().default(false),
        attuned: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const character = await prisma.character.findUnique({
        where: { id: input.characterId },
      });

      if (!character) {
        throw new NotFoundError('character', input.characterId);
      }

      if (character.userId !== ctx.session.user.id) {
        throw ForbiddenError.forPermission('edit', 'Character');
      }

      const homebrew = await prisma.homebrewContent.findUnique({
        where: { id: input.homebrewId },
      });

      if (!homebrew) {
        throw new NotFoundError('homebrew', input.homebrewId);
      }

      if (homebrew.type !== 'item') {
        throw new ValidationError('Only items can be added to inventory');
      }

      return prisma.characterItem.upsert({
        where: {
          characterId_homebrewId: {
            characterId: input.characterId,
            homebrewId: input.homebrewId,
          },
        },
        update: {
          quantity: input.quantity,
          equipped: input.equipped,
          attuned: input.attuned,
        },
        create: {
          characterId: input.characterId,
          homebrewId: input.homebrewId,
          quantity: input.quantity,
          equipped: input.equipped,
          attuned: input.attuned,
        },
        include: {
          homebrew: true,
        },
      });
    }),

  /**
   * Add homebrew spell to character
   */
  addHomebrewSpell: protectedProcedure
    .input(
      z.object({
        characterId: z.string(),
        homebrewId: z.string(),
        prepared: z.boolean().default(false),
        alwaysPrepared: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const character = await prisma.character.findUnique({
        where: { id: input.characterId },
      });

      if (!character) {
        throw new NotFoundError('character', input.characterId);
      }

      if (character.userId !== ctx.session.user.id) {
        throw ForbiddenError.forPermission('edit', 'Character');
      }

      const homebrew = await prisma.homebrewContent.findUnique({
        where: { id: input.homebrewId },
      });

      if (!homebrew) {
        throw new NotFoundError('homebrew', input.homebrewId);
      }

      if (homebrew.type !== 'spell') {
        throw new ValidationError('Only spells can be added to spellbook');
      }

      return prisma.characterSpell.upsert({
        where: {
          characterId_homebrewId: {
            characterId: input.characterId,
            homebrewId: input.homebrewId,
          },
        },
        update: {
          prepared: input.prepared,
          alwaysPrepared: input.alwaysPrepared,
        },
        create: {
          characterId: input.characterId,
          homebrewId: input.homebrewId,
          prepared: input.prepared,
          alwaysPrepared: input.alwaysPrepared,
        },
        include: {
          homebrew: true,
        },
      });
    }),

  /**
   * Add homebrew feat to character
   */
  addHomebrewFeat: protectedProcedure
    .input(
      z.object({
        characterId: z.string(),
        homebrewId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const character = await prisma.character.findUnique({
        where: { id: input.characterId },
      });

      if (!character) {
        throw new NotFoundError('character', input.characterId);
      }

      if (character.userId !== ctx.session.user.id) {
        throw ForbiddenError.forPermission('edit', 'Character');
      }

      const homebrew = await prisma.homebrewContent.findUnique({
        where: { id: input.homebrewId },
      });

      if (!homebrew) {
        throw new NotFoundError('homebrew', input.homebrewId);
      }

      if (homebrew.type !== 'feat') {
        throw new ValidationError('Only feats can be added to character');
      }

      return prisma.characterFeat.create({
        data: {
          characterId: input.characterId,
          homebrewId: input.homebrewId,
        },
        include: {
          homebrew: true,
        },
      });
    }),

  /**
   * Remove homebrew item from character
   */
  removeHomebrewItem: protectedProcedure
    .input(
      z.object({
        characterId: z.string(),
        homebrewId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const character = await prisma.character.findUnique({
        where: { id: input.characterId },
      });

      if (!character || character.userId !== ctx.session.user.id) {
        throw ForbiddenError.forPermission('edit', 'Character');
      }

      await prisma.characterItem.delete({
        where: {
          characterId_homebrewId: {
            characterId: input.characterId,
            homebrewId: input.homebrewId,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Remove homebrew spell from character
   */
  removeHomebrewSpell: protectedProcedure
    .input(
      z.object({
        characterId: z.string(),
        homebrewId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const character = await prisma.character.findUnique({
        where: { id: input.characterId },
      });

      if (!character || character.userId !== ctx.session.user.id) {
        throw ForbiddenError.forPermission('edit', 'Character');
      }

      await prisma.characterSpell.delete({
        where: {
          characterId_homebrewId: {
            characterId: input.characterId,
            homebrewId: input.homebrewId,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Remove homebrew feat from character
   */
  removeHomebrewFeat: protectedProcedure
    .input(
      z.object({
        characterId: z.string(),
        homebrewId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const character = await prisma.character.findUnique({
        where: { id: input.characterId },
      });

      if (!character || character.userId !== ctx.session.user.id) {
        throw ForbiddenError.forPermission('edit', 'Character');
      }

      await prisma.characterFeat.delete({
        where: {
          characterId_homebrewId: {
            characterId: input.characterId,
            homebrewId: input.homebrewId,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Get character with homebrew content
   */
  getCharacterWithHomebrew: protectedProcedure
    .input(z.object({ characterId: z.string() }))
    .query(async ({ input, ctx }) => {
      const character = await prisma.character.findUnique({
        where: { id: input.characterId },
        include: {
          homebrewItems: {
            include: {
              homebrew: true,
            },
          },
          homebrewSpells: {
            include: {
              homebrew: true,
            },
          },
          homebrewFeats: {
            include: {
              homebrew: true,
            },
          },
        },
      });

      if (!character) {
        throw new NotFoundError('character', input.characterId);
      }

      if (character.userId !== ctx.session.user.id) {
        throw ForbiddenError.forPermission('view', 'Character');
      }

      return character;
    }),
});
