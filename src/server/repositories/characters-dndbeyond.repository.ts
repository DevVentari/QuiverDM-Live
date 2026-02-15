/**
 * Characters D&D Beyond Repository
 *
 * Data access layer for D&D Beyond character import/sync operations.
 * Contains no business logic - only database queries.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { MappedCharacterData } from '@/lib/dndbeyond-character-mapper';

/** Convert null to Prisma.JsonNull for Json fields */
function jsonField(value: unknown) {
  return value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

// =============================================================================
// Repository Functions
// =============================================================================

/**
 * Find a character by its D&D Beyond ID (unique field)
 */
async function findByDndBeyondId(dndBeyondId: string) {
  return prisma.character.findUnique({
    where: { dndBeyondId },
    include: {
      campaignCharacters: {
        include: {
          campaign: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
}

/**
 * Find a character by D&D Beyond URL for a specific user
 */
async function findByDndBeyondUrl(userId: string, url: string) {
  return prisma.character.findFirst({
    where: { userId, dndBeyondUrl: url },
  });
}

/**
 * Create a Character from D&D Beyond import data
 */
async function createFromImport(userId: string, data: MappedCharacterData) {
  return prisma.character.create({
    data: {
      userId,
      name: data.name,
      race: data.race,
      class: data.class,
      subclass: data.subclass,
      level: data.level,
      background: data.background,
      portraitUrl: data.portraitUrl,
      isPortable: true,
      abilityScores: jsonField(data.abilityScores),
      hitPoints: jsonField(data.hitPoints),
      armorClass: data.armorClass,
      speed: data.speed,
      proficiencyBonus: data.proficiencyBonus,
      features: jsonField(data.features),
      proficiencies: jsonField(data.proficiencies),
      inventory: jsonField(data.inventory),
      spellcasting: jsonField(data.spellcasting),
      currency: jsonField(data.currency),
      backstory: data.backstory,
      personalityTraits: data.personalityTraits,
      ideals: data.ideals,
      bonds: data.bonds,
      flaws: data.flaws,
      languages: jsonField(data.languages),
      senses: jsonField(data.senses),
      resistances: jsonField(data.resistances),
      hitDice: jsonField(data.hitDice),
      savingThrows: jsonField(data.savingThrows),
      classes: jsonField(data.classes),
      appearance: jsonField(data.appearance),
      dndBeyondId: data.dndBeyondId,
      dndBeyondUrl: data.dndBeyondUrl,
      lastSyncedAt: new Date(),
      rawData: jsonField(data.rawData),
    },
    include: {
      campaignCharacters: {
        include: {
          campaign: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
}

/**
 * Update an existing Character from a D&D Beyond re-sync
 */
async function updateFromSync(characterId: string, data: MappedCharacterData) {
  return prisma.character.update({
    where: { id: characterId },
    data: {
      name: data.name,
      race: data.race,
      class: data.class,
      subclass: data.subclass,
      level: data.level,
      background: data.background,
      portraitUrl: data.portraitUrl,
      abilityScores: jsonField(data.abilityScores),
      hitPoints: jsonField(data.hitPoints),
      armorClass: data.armorClass,
      speed: data.speed,
      proficiencyBonus: data.proficiencyBonus,
      features: jsonField(data.features),
      proficiencies: jsonField(data.proficiencies),
      inventory: jsonField(data.inventory),
      spellcasting: jsonField(data.spellcasting),
      currency: jsonField(data.currency),
      backstory: data.backstory,
      personalityTraits: data.personalityTraits,
      ideals: data.ideals,
      bonds: data.bonds,
      flaws: data.flaws,
      languages: jsonField(data.languages),
      senses: jsonField(data.senses),
      resistances: jsonField(data.resistances),
      hitDice: jsonField(data.hitDice),
      savingThrows: jsonField(data.savingThrows),
      classes: jsonField(data.classes),
      appearance: jsonField(data.appearance),
      lastSyncedAt: new Date(),
      rawData: jsonField(data.rawData),
    },
    include: {
      campaignCharacters: {
        include: {
          campaign: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
}

/**
 * Find all characters linked to D&D Beyond for a user
 */
async function findDndBeyondLinked(userId: string) {
  return prisma.character.findMany({
    where: {
      userId,
      dndBeyondId: { not: null },
    },
    include: {
      campaignCharacters: {
        include: {
          campaign: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: { lastSyncedAt: 'desc' },
  });
}

// =============================================================================
// Export
// =============================================================================

export const charactersDndbeyondRepository = {
  findByDndBeyondId,
  findByDndBeyondUrl,
  createFromImport,
  updateFromSync,
  findDndBeyondLinked,
};
