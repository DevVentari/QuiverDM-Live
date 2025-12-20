import { router, protectedProcedure, campaignMemberProcedure, campaignDMProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { CharacterStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { verifyCampaignMembership } from '../lib/ownership';

// Zod schemas for character data
const abilityScoresSchema = z.object({
  str: z.number().min(1).max(30),
  dex: z.number().min(1).max(30),
  con: z.number().min(1).max(30),
  int: z.number().min(1).max(30),
  wis: z.number().min(1).max(30),
  cha: z.number().min(1).max(30),
}).optional();

const hitPointsSchema = z.object({
  current: z.number().min(0),
  max: z.number().min(1),
  temp: z.number().min(0).default(0),
}).optional();

const currencySchema = z.object({
  cp: z.number().min(0).default(0),
  sp: z.number().min(0).default(0),
  ep: z.number().min(0).default(0),
  gp: z.number().min(0).default(0),
  pp: z.number().min(0).default(0),
}).optional();

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
  getMyCharacters: protectedProcedure
    .query(async ({ ctx }) => {
      const characters = await prisma.character.findMany({
        where: { userId: ctx.session.user.id },
        include: {
          campaignCharacters: {
            include: {
              campaign: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return characters;
    }),

  /**
   * Get a single character by ID
   * Only the owner can view their character's full details
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const character = await prisma.character.findUnique({
        where: { id: input.id },
        include: {
          campaignCharacters: {
            include: {
              campaign: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      if (!character) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Character not found',
        });
      }

      // Only owner can view full character details
      if (character.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this character',
        });
      }

      return character;
    }),

  /**
   * Get characters in a campaign (for DMs and party members)
   */
  getCampaignCharacters: campaignMemberProcedure
    .query(async ({ input, ctx }) => {
      const campaignCharacters = await prisma.campaignCharacter.findMany({
        where: {
          campaignId: input.campaignId,
          status: { in: [CharacterStatus.ACTIVE, CharacterStatus.PENDING] },
        },
        include: {
          character: {
            select: {
              id: true,
              name: true,
              race: true,
              class: true,
              subclass: true,
              level: true,
              portraitUrl: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  image: true,
                },
              },
              // Only include full stats if DM or own character
              abilityScores: true,
              hitPoints: true,
              armorClass: true,
            },
          },
        },
        orderBy: [
          { status: 'asc' }, // PENDING first, then ACTIVE
          { character: { name: 'asc' } },
        ],
      });

      // Filter what non-DMs can see
      const isDM = ctx.membership.isOwner || ctx.membership.isCoOwner;

      return campaignCharacters.map(cc => ({
        ...cc,
        // Hide DM notes from players
        dmNotes: isDM ? cc.dmNotes : null,
        // Hide pending characters from other players (only DM and owner see them)
        ...(cc.status === CharacterStatus.PENDING && !isDM && cc.character.userId !== ctx.session.user.id
          ? { hidden: true }
          : {}),
      })).filter(cc => !('hidden' in cc));
    }),

  // ===========================================================================
  // CHARACTER MUTATIONS
  // ===========================================================================

  /**
   * Create a new character
   */
  create: protectedProcedure
    .input(z.object({
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
    }))
    .mutation(async ({ input, ctx }) => {
      const character = await prisma.character.create({
        data: {
          userId: ctx.session.user.id,
          name: input.name,
          race: input.race,
          class: input.class,
          subclass: input.subclass,
          level: input.level,
          background: input.background,
          portraitUrl: input.portraitUrl,
          isPortable: input.isPortable,
          abilityScores: input.abilityScores,
          hitPoints: input.hitPoints,
          armorClass: input.armorClass,
          speed: input.speed,
          backstory: input.backstory,
          personalityTraits: input.personalityTraits,
          ideals: input.ideals,
          bonds: input.bonds,
          flaws: input.flaws,
        },
      });

      return character;
    }),

  /**
   * Update a character
   * Only the owner can update their character
   */
  update: protectedProcedure
    .input(z.object({
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
      currency: currencySchema,
      backstory: z.string().nullable().optional(),
      personalityTraits: z.string().nullable().optional(),
      ideals: z.string().nullable().optional(),
      bonds: z.string().nullable().optional(),
      flaws: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      // Verify ownership
      const existing = await prisma.character.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Character not found',
        });
      }

      if (existing.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only edit your own characters',
        });
      }

      const character = await prisma.character.update({
        where: { id },
        data,
      });

      return character;
    }),

  /**
   * Delete a character
   * Only the owner can delete their character
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verify ownership
      const existing = await prisma.character.findUnique({
        where: { id: input.id },
        select: { userId: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Character not found',
        });
      }

      if (existing.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own characters',
        });
      }

      await prisma.character.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  // ===========================================================================
  // CAMPAIGN CHARACTER MANAGEMENT
  // ===========================================================================

  /**
   * Add a character to a campaign
   * Player submits their character to join a campaign
   */
  addToCampaign: protectedProcedure
    .input(z.object({
      characterId: z.string(),
      campaignId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify user owns the character
      const character = await prisma.character.findUnique({
        where: { id: input.characterId },
        select: { userId: true, isPortable: true },
      });

      if (!character) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Character not found',
        });
      }

      if (character.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only add your own characters to campaigns',
        });
      }

      // Verify user is a member of the campaign
      await verifyCampaignMembership(input.campaignId, ctx.session.user.id);

      // Check if character is already in this campaign
      const existing = await prisma.campaignCharacter.findUnique({
        where: {
          campaignId_characterId: {
            campaignId: input.campaignId,
            characterId: input.characterId,
          },
        },
      });

      if (existing) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Character is already in this campaign',
        });
      }

      // If character is not portable, check if it's in another campaign
      if (!character.isPortable) {
        const otherCampaign = await prisma.campaignCharacter.findFirst({
          where: {
            characterId: input.characterId,
            status: { in: [CharacterStatus.ACTIVE, CharacterStatus.PENDING] },
          },
        });

        if (otherCampaign) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'This character is locked to another campaign and cannot be added here',
          });
        }
      }

      // Add character to campaign (pending approval)
      const campaignCharacter = await prisma.campaignCharacter.create({
        data: {
          campaignId: input.campaignId,
          characterId: input.characterId,
          status: CharacterStatus.PENDING,
        },
        include: {
          campaign: { select: { name: true } },
          character: { select: { name: true } },
        },
      });

      return campaignCharacter;
    }),

  /**
   * Approve a character for a campaign (DM only)
   */
  approveCharacter: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      campaignCharacterId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const campaignCharacter = await prisma.campaignCharacter.findUnique({
        where: { id: input.campaignCharacterId },
      });

      if (!campaignCharacter || campaignCharacter.campaignId !== input.campaignId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Character not found in this campaign',
        });
      }

      if (campaignCharacter.status !== CharacterStatus.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Character is not pending approval',
        });
      }

      const updated = await prisma.campaignCharacter.update({
        where: { id: input.campaignCharacterId },
        data: { status: CharacterStatus.ACTIVE },
      });

      return updated;
    }),

  /**
   * Update character status in campaign (DM only)
   */
  updateCampaignStatus: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      campaignCharacterId: z.string(),
      status: z.nativeEnum(CharacterStatus),
      dmNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const campaignCharacter = await prisma.campaignCharacter.findUnique({
        where: { id: input.campaignCharacterId },
      });

      if (!campaignCharacter || campaignCharacter.campaignId !== input.campaignId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Character not found in this campaign',
        });
      }

      const updated = await prisma.campaignCharacter.update({
        where: { id: input.campaignCharacterId },
        data: {
          status: input.status,
          dmNotes: input.dmNotes,
          isActive: input.status === CharacterStatus.ACTIVE,
        },
      });

      return updated;
    }),

  /**
   * Remove a character from a campaign
   * DM can remove any character, player can remove their own
   */
  removeFromCampaign: protectedProcedure
    .input(z.object({
      campaignCharacterId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const campaignCharacter = await prisma.campaignCharacter.findUnique({
        where: { id: input.campaignCharacterId },
        include: {
          character: { select: { userId: true } },
        },
      });

      if (!campaignCharacter) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Campaign character not found',
        });
      }

      // Check if user is DM or character owner
      const membership = await verifyCampaignMembership(
        campaignCharacter.campaignId,
        ctx.session.user.id
      );

      const isDM = membership.isOwner || membership.isCoOwner;
      const isCharacterOwner = campaignCharacter.character.userId === ctx.session.user.id;

      if (!isDM && !isCharacterOwner) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to remove this character',
        });
      }

      await prisma.campaignCharacter.delete({
        where: { id: input.campaignCharacterId },
      });

      return { success: true };
    }),

  /**
   * Update DM notes for a campaign character (DM only)
   */
  updateDMNotes: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      campaignCharacterId: z.string(),
      dmNotes: z.string(),
    }))
    .mutation(async ({ input }) => {
      const campaignCharacter = await prisma.campaignCharacter.findUnique({
        where: { id: input.campaignCharacterId },
      });

      if (!campaignCharacter || campaignCharacter.campaignId !== input.campaignId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Character not found in this campaign',
        });
      }

      const updated = await prisma.campaignCharacter.update({
        where: { id: input.campaignCharacterId },
        data: { dmNotes: input.dmNotes },
      });

      return updated;
    }),
});
