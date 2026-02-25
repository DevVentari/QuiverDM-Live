/**
 * Zod Schemas for D&D Content Validation
 *
 * Defines strict schemas for different types of D&D content
 * to ensure Ollama returns properly structured, type-safe data
 */

import { z } from 'zod';

/**
 * Common schemas used across multiple content types
 */
export const DiceRollSchema = z.object({
  count: z.number().int().positive(),
  sides: z.number().int().positive(),
  modifier: z.number().int().optional(),
  type: z.string().optional(), // e.g., "fire", "slashing", "healing"
});

export const AbilityScoresSchema = z.object({
  strength: z.number().int().min(1).max(30),
  dexterity: z.number().int().min(1).max(30),
  constitution: z.number().int().min(1).max(30),
  intelligence: z.number().int().min(1).max(30),
  wisdom: z.number().int().min(1).max(30),
  charisma: z.number().int().min(1).max(30),
});

export const DamageTypeSchema = z.enum([
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
  'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'
]);

export const ConditionSchema = z.enum([
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled',
  'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
  'prone', 'restrained', 'stunned', 'unconscious', 'exhaustion'
]);

/**
 * Spell Schema
 */
export const SpellSchema = z.object({
  name: z.string(),
  level: z.number().int().min(0).max(9), // 0 = cantrip
  school: z.enum([
    'abjuration', 'conjuration', 'divination', 'enchantment',
    'evocation', 'illusion', 'necromancy', 'transmutation'
  ]),
  castingTime: z.string(), // e.g., "1 action", "1 bonus action", "1 minute"
  range: z.string(), // e.g., "60 feet", "Self", "Touch"
  components: z.object({
    verbal: z.boolean(),
    somatic: z.boolean(),
    material: z.boolean(),
    materialDescription: z.string().optional(),
  }),
  duration: z.string(), // e.g., "Instantaneous", "Concentration, up to 1 minute"
  isRitual: z.boolean().optional(),
  requiresConcentration: z.boolean(),
  description: z.string(),
  higherLevels: z.string().optional(),
  damage: z.array(DiceRollSchema).optional(),
  savingThrow: z.object({
    ability: z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']),
    description: z.string(),
  }).optional(),
  attackType: z.enum(['melee', 'ranged', 'none']).optional(),
  classes: z.array(z.string()).optional(),
  source: z.string().optional(),
  imagePromptHint: z.string().optional(), // Visual description for AI image generation
});

export type Spell = z.infer<typeof SpellSchema>;

/**
 * Magic Item Schema
 */
export const MagicItemSchema = z.object({
  name: z.string(),
  type: z.enum([
    'weapon', 'armor', 'potion', 'ring', 'rod', 'scroll', 'staff',
    'wand', 'wondrous item', 'other'
  ]),
  rarity: z.enum(['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']),
  requiresAttunement: z.boolean(),
  attunementRequirements: z.string().optional(),
  description: z.string(),
  properties: z.array(z.string()).optional(),
  damage: z.array(DiceRollSchema).optional(),
  armorClass: z.number().int().optional(),
  bonuses: z.object({
    attackBonus: z.number().int().optional(),
    damageBonus: z.number().int().optional(),
    acBonus: z.number().int().optional(),
    savingThrowBonus: z.number().int().optional(),
  }).optional(),
  charges: z.object({
    maximum: z.number().int().positive(),
    recharge: z.string(), // e.g., "1d6 at dawn", "all at dawn"
  }).optional(),
  weight: z.number().optional(),
  value: z.object({
    amount: z.number(),
    currency: z.enum(['cp', 'sp', 'ep', 'gp', 'pp']),
  }).optional(),
  source: z.string().optional(),
  imagePromptHint: z.string().optional(), // Visual description for AI image generation
});

export type MagicItem = z.infer<typeof MagicItemSchema>;

/**
 * Item Effect Schemas
 */
export const ItemEffectMechanicSchema = z.object({
  type: z.enum([
    'advantage', 'damage_bypass', 'ac_bonus', 'attack_bonus',
    'ability_bonus', 'resistance', 'immunity', 'custom',
  ]),
  target: z.string().optional(),
  value: z.number().optional(),
  condition: z.string().optional(),
});

export const ItemEffectSchema = z.object({
  name: z.string(),
  description: z.string(),
  mechanic: ItemEffectMechanicSchema.optional(),
});

export type ItemEffect = z.infer<typeof ItemEffectSchema>;

/**
 * Monster/Creature Schema
 */
export const MonsterSchema = z.object({
  name: z.string(),
  size: z.enum(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']),
  type: z.string(), // e.g., "humanoid (goblinoid)", "dragon", "undead"
  alignment: z.string(), // e.g., "lawful evil", "unaligned", "any alignment"
  armorClass: z.number().int().positive(),
  hitPoints: z.object({
    average: z.number().int().positive(),
    dice: DiceRollSchema,
  }),
  speed: z.object({
    walk: z.number().int().nonnegative().optional(),
    fly: z.number().int().nonnegative().optional(),
    swim: z.number().int().nonnegative().optional(),
    climb: z.number().int().nonnegative().optional(),
    burrow: z.number().int().nonnegative().optional(),
    hover: z.boolean().optional(),
  }),
  abilityScores: AbilityScoresSchema,
  savingThrows: z.record(z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']), z.number().int()).optional(),
  skills: z.record(z.string(), z.number().int()).optional(),
  damageResistances: z.array(DamageTypeSchema).optional(),
  damageImmunities: z.array(DamageTypeSchema).optional(),
  damageVulnerabilities: z.array(DamageTypeSchema).optional(),
  conditionImmunities: z.array(ConditionSchema).optional(),
  senses: z.object({
    darkvision: z.number().int().nonnegative().optional(),
    blindsight: z.number().int().nonnegative().optional(),
    tremorsense: z.number().int().nonnegative().optional(),
    truesight: z.number().int().nonnegative().optional(),
    passivePerception: z.number().int(),
  }),
  languages: z.array(z.string()).optional(),
  challengeRating: z.number(), // Can be fractional (0.125, 0.25, 0.5, etc.)
  experiencePoints: z.number().int().nonnegative(),
  traits: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).optional(),
  actions: z.array(z.object({
    name: z.string(),
    description: z.string(),
    attackBonus: z.number().int().optional(),
    damage: z.array(DiceRollSchema).optional(),
    reach: z.number().int().optional(),
    range: z.string().optional(),
  })),
  reactions: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).optional(),
  legendaryActions: z.object({
    count: z.number().int().positive(),
    actions: z.array(z.object({
      name: z.string(),
      cost: z.number().int().positive(),
      description: z.string(),
    })),
  }).optional(),
  lairActions: z.array(z.object({
    description: z.string(),
    initiative: z.number().int().optional(),
  })).optional(),
  source: z.string().optional(),
  imagePromptHint: z.string().optional(), // Visual description for AI image generation
});

export type Monster = z.infer<typeof MonsterSchema>;

/**
 * Class Feature Schema
 */
export const ClassFeatureSchema = z.object({
  name: z.string(),
  className: z.string(), // e.g., "Fighter", "Wizard"
  subclass: z.string().optional(),
  level: z.number().int().min(1).max(20),
  description: z.string(),
  benefits: z.array(z.string()).optional(),
  prerequisites: z.string().optional(),
  uses: z.object({
    type: z.enum(['per_short_rest', 'per_long_rest', 'per_day', 'unlimited', 'charges']),
    count: z.number().int().optional(),
    recharge: z.string().optional(),
  }).optional(),
  source: z.string().optional(),
  imagePromptHint: z.string().optional(),
});

export type ClassFeature = z.infer<typeof ClassFeatureSchema>;

/**
 * Feat Schema
 */
export const FeatSchema = z.object({
  name: z.string(),
  prerequisites: z.string().optional(),
  description: z.string(),
  benefits: z.array(z.string()),
  abilityScoreIncrease: z.object({
    options: z.array(z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'])),
    amount: z.number().int().positive(),
  }).optional(),
  source: z.string().optional(),
  imagePromptHint: z.string().optional(),
});

export type Feat = z.infer<typeof FeatSchema>;

/**
 * Race Schema
 */
export const RaceSchema = z.object({
  name: z.string(),
  subrace: z.string().optional(),
  abilityScoreIncrease: z.record(
    z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']),
    z.number().int()
  ),
  age: z.string(),
  alignment: z.string(),
  size: z.enum(['small', 'medium', 'large']),
  speed: z.number().int().positive(),
  languages: z.array(z.string()),
  traits: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })),
  source: z.string().optional(),
  imagePromptHint: z.string().optional(),
});

export type Race = z.infer<typeof RaceSchema>;

/**
 * Background Schema
 */
export const BackgroundSchema = z.object({
  name: z.string(),
  description: z.string(),
  skillProficiencies: z.array(z.string()),
  toolProficiencies: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  equipment: z.array(z.string()),
  feature: z.object({
    name: z.string(),
    description: z.string(),
  }),
  suggestedCharacteristics: z.object({
    personalityTraits: z.array(z.string()).optional(),
    ideals: z.array(z.string()).optional(),
    bonds: z.array(z.string()).optional(),
    flaws: z.array(z.string()).optional(),
  }).optional(),
  source: z.string().optional(),
  imagePromptHint: z.string().optional(),
});

export type Background = z.infer<typeof BackgroundSchema>;

/**
 * Generic homebrew content wrapper
 */
export const HomebrewContentSchema = z.object({
  type: z.enum(['spell', 'item', 'monster', 'class_feature', 'feat', 'race', 'background']),
  data: z.union([
    SpellSchema,
    MagicItemSchema,
    MonsterSchema,
    ClassFeatureSchema,
    FeatSchema,
    RaceSchema,
    BackgroundSchema,
  ]),
  extractedFrom: z.object({
    pdfId: z.string(),
    section: z.string(),
    pageNumber: z.number().int().optional(),
  }).optional(),
});

export type HomebrewContent = z.infer<typeof HomebrewContentSchema>;

/**
 * Batch extraction result
 */
export const BatchExtractionResultSchema = z.object({
  success: z.boolean(),
  items: z.array(HomebrewContentSchema),
  errors: z.array(z.object({
    section: z.string(),
    error: z.string(),
  })),
  metadata: z.object({
    totalSections: z.number().int(),
    successfulExtractions: z.number().int(),
    failedExtractions: z.number().int(),
    processingTime: z.number(), // milliseconds
  }),
});

export type BatchExtractionResult = z.infer<typeof BatchExtractionResultSchema>;
