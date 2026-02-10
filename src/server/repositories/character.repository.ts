/**
 * Character Repository
 *
 * Data access layer for character-related database operations.
 * Contains no business logic - only database queries.
 */

import { prisma } from '@/lib/prisma';
import { CharacterStatus } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

export interface CreateCharacterInput {
  userId: string;
  name: string;
  race?: string;
  class?: string;
  subclass?: string;
  level?: number;
  background?: string;
  portraitUrl?: string;
  isPortable?: boolean;
  abilityScores?: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  hitPoints?: {
    current: number;
    max: number;
    temp?: number;
  };
  armorClass?: number;
  speed?: number;
  backstory?: string;
  personalityTraits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
}

export interface UpdateCharacterInput {
  name?: string;
  race?: string;
  class?: string;
  subclass?: string;
  level?: number;
  background?: string;
  portraitUrl?: string | null;
  isPortable?: boolean;
  abilityScores?: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  hitPoints?: {
    current: number;
    max: number;
    temp?: number;
  };
  armorClass?: number | null;
  speed?: number | null;
  proficiencyBonus?: number;
  features?: any;
  proficiencies?: any;
  inventory?: any;
  spellcasting?: any;
  currency?: {
    cp?: number;
    sp?: number;
    ep?: number;
    gp?: number;
    pp?: number;
  };
  backstory?: string | null;
  personalityTraits?: string | null;
  ideals?: string | null;
  bonds?: string | null;
  flaws?: string | null;
  notes?: string | null;
}

// =============================================================================
// Repository Functions
// =============================================================================

/**
 * Find all characters owned by a user
 */
export async function findByUserId(userId: string) {
  return prisma.character.findMany({
    where: { userId },
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
}

/**
 * Find a character by ID
 */
export async function findById(id: string) {
  return prisma.character.findUnique({
    where: { id },
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
}

/**
 * Find a character by ID with minimal data (for ownership check)
 */
export async function findOwnership(id: string) {
  return prisma.character.findUnique({
    where: { id },
    select: { userId: true, isPortable: true },
  });
}

/**
 * Create a new character
 */
export async function create(input: CreateCharacterInput) {
  return prisma.character.create({
    data: {
      userId: input.userId,
      name: input.name,
      race: input.race,
      class: input.class,
      subclass: input.subclass,
      level: input.level ?? 1,
      background: input.background,
      portraitUrl: input.portraitUrl,
      isPortable: input.isPortable ?? true,
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
}

/**
 * Update a character
 */
export async function update(id: string, data: UpdateCharacterInput) {
  return prisma.character.update({
    where: { id },
    data,
  });
}

/**
 * Delete a character
 */
export async function remove(id: string) {
  return prisma.character.delete({
    where: { id },
  });
}

// =============================================================================
// Campaign Character Functions
// =============================================================================

/**
 * Find all characters in a campaign
 */
export async function findByCampaignId(
  campaignId: string,
  statuses: CharacterStatus[] = [CharacterStatus.ACTIVE, CharacterStatus.PENDING]
) {
  return prisma.campaignCharacter.findMany({
    where: {
      campaignId,
      status: { in: statuses },
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
          abilityScores: true,
          hitPoints: true,
          armorClass: true,
        },
      },
    },
    orderBy: [
      { status: 'asc' },
      { character: { name: 'asc' } },
    ],
  });
}

/**
 * Find a campaign character by ID
 */
export async function findCampaignCharacter(id: string) {
  return prisma.campaignCharacter.findUnique({
    where: { id },
    include: {
      character: { select: { userId: true } },
    },
  });
}

/**
 * Find a campaign character by campaign and character IDs
 */
export async function findCampaignCharacterByIds(campaignId: string, characterId: string) {
  return prisma.campaignCharacter.findUnique({
    where: {
      campaignId_characterId: {
        campaignId,
        characterId,
      },
    },
  });
}

/**
 * Check if a non-portable character is in another campaign
 */
export async function findActiveInOtherCampaign(characterId: string) {
  return prisma.campaignCharacter.findFirst({
    where: {
      characterId,
      status: { in: [CharacterStatus.ACTIVE, CharacterStatus.PENDING] },
    },
  });
}

/**
 * Add a character to a campaign
 */
export async function addToCampaign(campaignId: string, characterId: string) {
  return prisma.campaignCharacter.create({
    data: {
      campaignId,
      characterId,
      status: CharacterStatus.PENDING,
    },
    include: {
      campaign: { select: { name: true } },
      character: { select: { name: true } },
    },
  });
}

/**
 * Update a campaign character status
 */
export async function updateCampaignCharacter(
  id: string,
  data: {
    status?: CharacterStatus;
    dmNotes?: string;
    isActive?: boolean;
  }
) {
  return prisma.campaignCharacter.update({
    where: { id },
    data,
  });
}

/**
 * Remove a character from a campaign
 */
export async function removeFromCampaign(id: string) {
  return prisma.campaignCharacter.delete({
    where: { id },
  });
}

// Export all functions as a repository object
export const characterRepository = {
  findByUserId,
  findById,
  findOwnership,
  create,
  update,
  remove,
  findByCampaignId,
  findCampaignCharacter,
  findCampaignCharacterByIds,
  findActiveInOtherCampaign,
  addToCampaign,
  updateCampaignCharacter,
  removeFromCampaign,
};
