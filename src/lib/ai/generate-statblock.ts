/**
 * AI statblock generation for the homebrew creator. Turns a short concept prompt
 * into a structured statblock the DM can review and edit before saving. Uses the
 * multi-provider chatWithAI (falls back through AI_PROVIDER_ORDER) and parses the
 * model's JSON defensively — the result is validated, never trusted raw.
 */
import { z } from 'zod';
import { chatWithAI, type ChatMessage } from './chat';

export type StatblockType = 'creature' | 'item' | 'spell';

const abilitySchema = z
  .object({
    str: z.number().int().min(1).max(30).optional(),
    dex: z.number().int().min(1).max(30).optional(),
    con: z.number().int().min(1).max(30).optional(),
    int: z.number().int().min(1).max(30).optional(),
    wis: z.number().int().min(1).max(30).optional(),
    cha: z.number().int().min(1).max(30).optional(),
  })
  .partial();

// Coerce loose model output (strings, "13 (+1)") into clean fields.
const looseNumber = z.preprocess((v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const m = v.match(/-?\d+/);
    if (m) return Number(m[0]);
  }
  return undefined;
}, z.number().optional());

const statblockSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().default(''),
  size: z.string().max(40).optional(),
  creatureType: z.string().max(60).optional(),
  cr: z.union([z.string(), z.number()]).optional(),
  ac: looseNumber,
  hp: looseNumber,
  speed: z.string().max(80).optional(),
  abilities: abilitySchema.optional(),
});

export interface GeneratedStatblock {
  name: string;
  description: string;
  size?: string;
  creatureType?: string;
  cr?: string;
  ac?: number;
  hp?: number;
  speed?: string;
  abilities?: { str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number };
}

const SYSTEM_PROMPT = `You are a Dungeons & Dragons 5e homebrew assistant. Given a short concept, produce a single balanced statblock as STRICT JSON — no prose, no markdown fences.

For a "creature" return:
{ "name": string, "description": string (2-3 sentences of flavour), "size": one of Tiny|Small|Medium|Large|Huge|Gargantuan, "creatureType": e.g. undead, fiend, beast, "cr": string like "4" or "1/2", "ac": integer, "hp": integer, "speed": string like "30 ft., fly 40 ft.", "abilities": { "str": int, "dex": int, "con": int, "int": int, "wis": int, "cha": int } }

For an "item" return: { "name": string, "description": string (what it is, rarity, and what it does) }
For a "spell" return: { "name": string, "description": string (level, school, casting time, range, and effect) }

Keep the statblock plausible and balanced for its CR/level. Return ONLY the JSON object.`;

/** Pull the first JSON object out of a model response, tolerating code fences. */
function extractJson(raw: string): unknown {
  const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('The Heartflame returned nothing usable. Try a clearer prompt.');
  return JSON.parse(match[0]);
}

export async function generateStatblock(
  input: { prompt: string; type: StatblockType },
  options: { userId?: string } = {},
): Promise<GeneratedStatblock> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Type: ${input.type}\nConcept: ${input.prompt.trim()}` },
  ];

  const raw = await chatWithAI(messages, { temperature: 0.6, userId: options.userId });

  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    throw new Error('The generated statblock could not be read. Try again or rephrase.');
  }

  const result = statblockSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('The generated statblock was malformed. Try again or rephrase.');
  }

  const v = result.data;
  return {
    name: v.name,
    description: v.description ?? '',
    size: v.size,
    creatureType: v.creatureType,
    cr: v.cr != null ? String(v.cr) : undefined,
    ac: v.ac,
    hp: v.hp,
    speed: v.speed,
    abilities: v.abilities,
  };
}
