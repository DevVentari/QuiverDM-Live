import { z } from 'zod';

// ---------------------------------------------------------------------------
// Per-step item schemas
// ---------------------------------------------------------------------------

export const CharacterNoteSchema = z.object({
  characterId: z.string(),
  name: z.string(),
  goals: z.string().default(''),
  notes: z.string().default(''),
});

export const SceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(''),
  location: z.string().optional(),
  readAloud: z.string().default(''),
  order: z.number().int().default(0),
  linkedNpcIds: z.array(z.string()).default([]),
  linkedSecretIds: z.array(z.string()).default([]),
  linkedMonsterNames: z.array(z.string()).default([]),
  sourceId: z.string().optional(),
});

export const SecretSchema = z.object({
  id: z.string(),
  text: z.string(),
  linkedTo: z.string().optional(),
});

export const PrepNpcSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  npcId: z.string().optional(),
  name: z.string(),
  role: z.string().optional(),
  motivation: z.string().optional(),
  isNew: z.boolean().optional(),
});

export const MonsterSchema = z.object({
  name: z.string(),
  cr: z.string().optional(),
  source: z.string(), // 'srd' | 'homebrew' | 'custom'
  sourceId: z.string().optional(),
  count: z.number().int().min(1).default(1),
});

export const RewardSchema = z.object({
  name: z.string(),
  rarity: z.string().optional(),
  source: z.string(), // 'homebrew' | 'custom'
  sourceId: z.string().optional(),
  notes: z.string().optional(),
});

export const LooseThreadSchema = z.object({
  id: z.string(),
  text: z.string(),
  fromSessionId: z.string().optional(),
  fromSessionTitle: z.string().optional(),
});

export const ImportedNoteSchema = z.object({
  url: z.string().optional(),
  extractedAt: z.string(),
  sectionCounts: z.record(z.string(), z.number()),
});

// ---------------------------------------------------------------------------
// Full SessionPrepData schema
// ---------------------------------------------------------------------------

export const SessionPrepDataSchema = z.object({
  currentStep: z.number().int().min(0).max(7).default(0),
  lastSavedAt: z.string().optional(),

  // Step 1: Review Characters
  characterNotes: z.array(CharacterNoteSchema).default([]),

  // Step 2: Strong Start
  strongStart: z.string().default(''),

  // Step 3: Potential Scenes
  scenes: z.array(SceneSchema).default([]),

  // Step 4: Secrets & Clues
  secretsAndClues: z.array(SecretSchema).default([]),

  // Step 5: NPCs
  npcs: z.array(PrepNpcSchema).default([]),

  // Step 6: Monsters
  monsters: z.array(MonsterSchema).default([]),

  // Step 7: Rewards
  rewards: z.array(RewardSchema).default([]),

  // Step 8: Loose Threads
  looseThreads: z.array(LooseThreadSchema).default([]),

  // Imported Notes
  importedNotes: z.array(ImportedNoteSchema).optional().default([]),
});

export type SessionPrepData = z.infer<typeof SessionPrepDataSchema>;
export type CharacterNote = z.infer<typeof CharacterNoteSchema>;
export type PrepScene = z.infer<typeof SceneSchema>;
export type PrepSecret = z.infer<typeof SecretSchema>;
export type PrepNpc = z.infer<typeof PrepNpcSchema>;
export type PrepMonster = z.infer<typeof MonsterSchema>;
export type PrepReward = z.infer<typeof RewardSchema>;
export type PrepLooseThread = z.infer<typeof LooseThreadSchema>;
export type ImportedNote = z.infer<typeof ImportedNoteSchema>;

// ---------------------------------------------------------------------------
// Default empty prep data
// ---------------------------------------------------------------------------

export function emptyPrepData(): SessionPrepData {
  return SessionPrepDataSchema.parse({});
}
