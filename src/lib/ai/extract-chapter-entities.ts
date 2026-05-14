import { z } from 'zod';
import { chatWithAI } from './chat';
import type { ChapterSection } from '@/lib/ddb-sourcebook';

// Loose enums: gpt-4o-mini regularly invents adjacent values ("road", "location", "ruin").
// Catch-fall to 'other' instead of failing the whole section.
const LocationTypeEnum = z.enum(['settlement', 'dungeon', 'region', 'building', 'natural', 'other']).catch('other');
const ItemTypeEnum = z.enum(['weapon', 'armor', 'wondrous', 'potion', 'scroll', 'ring', 'rod', 'staff', 'wand', 'other']).catch('other');
const RarityEnum = z.enum(['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']).catch('common');
const DifficultyEnum = z.enum(['trivial', 'easy', 'medium', 'hard', 'deadly']).catch('medium');

export const NpcSchema = z.object({
  name: z.string(),
  role: z.string().optional(),
  description: z.string().default(''),
  location: z.string().optional(),
});
export const LocationSchema = z.object({
  name: z.string(),
  type: LocationTypeEnum.optional(),
  description: z.string().default(''),
  notable: z.string().optional(),
});
export const ItemSchema = z.object({
  name: z.string(),
  type: ItemTypeEnum.optional(),
  rarity: RarityEnum.optional(),
  description: z.string().default(''),
});
export const EncounterSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  monsters: z.array(z.string()).optional(),
  difficulty: DifficultyEnum.optional(),
});
export const SpellSchema = z.object({
  name: z.string(),
  level: z.number().int().min(0).max(9),
  school: z.string(),
  castingTime: z.string(),
  range: z.string(),
  components: z.string(),
  duration: z.string(),
  description: z.string().default(''),
  higherLevels: z.string().optional(),
  classes: z.array(z.string()).optional(),
});
export const FeatSchema = z.object({
  name: z.string(),
  prerequisite: z.string().optional(),
  description: z.string().default(''),
  benefits: z.array(z.string()).default([]),
});
export const ChapterExtractionSchema = z.object({
  npcs: z.array(NpcSchema).default([]),
  locations: z.array(LocationSchema).default([]),
  items: z.array(ItemSchema).default([]),
  encounters: z.array(EncounterSchema).default([]),
  spells: z.array(SpellSchema).default([]),
  feats: z.array(FeatSchema).default([]),
});

export type ChapterExtraction = z.infer<typeof ChapterExtractionSchema>;
export type ExtractedNpc = z.infer<typeof NpcSchema>;
export type ExtractedLocation = z.infer<typeof LocationSchema>;
export type ExtractedItem = z.infer<typeof ItemSchema>;
export type ExtractedEncounter = z.infer<typeof EncounterSchema>;
export type ExtractedSpell = z.infer<typeof SpellSchema>;
export type ExtractedFeat = z.infer<typeof FeatSchema>;

export interface SectionAttempt {
  sectionHeading: string;
  sectionLength: number;
  prompt: string;
  rawResponse: string;
  parsed: ChapterExtraction | null;
  parseError?: string;
  durationMs: number;
}

export interface ChapterExtractionResult {
  attempts: SectionAttempt[];
  merged: ChapterExtraction;
}

const MAX_SECTION_CHARS = 8000;

// Static system prompt — never changes across sections, eligible for prompt caching.
export const EXTRACTION_SYSTEM_PROMPT = `You are extracting structured information from a D&D 5e adventure chapter.

Return ONLY a single JSON object (no commentary, no markdown fences) with exactly this shape. Omit empty arrays only if the section truly has none.

{
  "npcs": [
    { "name": string, "role"?: string, "description": string, "location"?: string }
  ],
  "locations": [
    { "name": string, "type"?: "settlement"|"dungeon"|"region"|"building"|"natural"|"other", "description": string, "notable"?: string }
  ],
  "items": [
    { "name": string, "type"?: "weapon"|"armor"|"wondrous"|"potion"|"scroll"|"ring"|"rod"|"staff"|"wand"|"other", "rarity"?: "common"|"uncommon"|"rare"|"very rare"|"legendary"|"artifact", "description": string }
  ],
  "encounters": [
    { "name": string, "description": string, "monsters"?: [string], "difficulty"?: "trivial"|"easy"|"medium"|"hard"|"deadly" }
  ],
  "spells": [
    { "name": string, "level": 0-9, "school": string, "castingTime": string, "range": string, "components": string, "duration": string, "description": string, "higherLevels"?: string, "classes"?: [string] }
  ],
  "feats": [
    { "name": string, "prerequisite"?: string, "description": string, "benefits"?: [string] }
  ]
}

Rules:
- Only include things named in the section text. No inventions.
- "npcs" = in-fiction named people/creatures with personality, role, or significance. Skip generic mooks ("guards", "commoners") unless individually named. NEVER include real-world people: authors, designers, editors, playtesters, artists, anyone in credits/acknowledgments/dedications. If the section is a credits page or thank-you list, return empty arrays.
- "items" = magic items, artifacts, named treasure. Skip mundane gear.
- "encounters" = combat or scripted events with named monsters/foes. Skip pure exploration descriptions.
- "locations" = named places with their own identity (a tavern, a region, a dungeon room with a name). Skip generic features ("a forest", "the road").
- "spells" = named magical spells with a level, school, and effect description. Skip cantrips that are just flavor (no game effect).
- "feats" = D&D 5e feats with a name and benefit description. Skip racial features that aren't formally tagged as feats.
- Keep descriptions concise (1-2 sentences) but specific to what the text says.`;

function buildUserMessage(chapterSlug: string, section: ChapterSection): string {
  return `Chapter: ${chapterSlug}
Section: ${section.heading}

Section text:
${section.text}`;
}

function tryParse(raw: string): { parsed: ChapterExtraction | null; error?: string } {
  // Strip code fences if the model added them despite instructions
  const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { parsed: null, error: 'no JSON object in response' };
  try {
    const obj = JSON.parse(jsonMatch[0]);
    const result = ChapterExtractionSchema.safeParse(obj);
    if (!result.success) return { parsed: null, error: `zod: ${result.error.issues.slice(0, 2).map(i => i.path.join('.') + ' ' + i.message).join('; ')}` };
    return { parsed: result.data };
  } catch (e) {
    return { parsed: null, error: `JSON.parse: ${(e as Error).message}` };
  }
}

function chunkSection(section: ChapterSection): ChapterSection[] {
  if (section.text.length <= MAX_SECTION_CHARS) return [section];
  // Split on paragraph boundaries, packing into chunks under MAX_SECTION_CHARS
  const paragraphs = section.text.split(/\n\n+/);
  const chunks: ChapterSection[] = [];
  let buf = '';
  let chunkIndex = 1;
  for (const p of paragraphs) {
    if (buf.length + p.length + 2 > MAX_SECTION_CHARS && buf.length > 0) {
      chunks.push({ heading: `${section.heading} (part ${chunkIndex})`, text: buf.trim() });
      chunkIndex++;
      buf = '';
    }
    buf += (buf ? '\n\n' : '') + p;
  }
  if (buf.trim()) chunks.push({ heading: `${section.heading} (part ${chunkIndex})`, text: buf.trim() });
  return chunks;
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')   // strip leading article
    .replace(/['’]s$/, '')             // strip trailing possessive
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeByName<T extends { name: string; description: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    if (!item.name?.trim()) continue;
    const key = normalizeName(item.name);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else if ((item.description?.length ?? 0) > (existing.description?.length ?? 0)) {
      map.set(key, { ...existing, ...item });
    }
  }
  return [...map.values()];
}

function mergeExtractions(parts: ChapterExtraction[]): ChapterExtraction {
  return {
    npcs: dedupeByName(parts.flatMap(p => p.npcs)),
    locations: dedupeByName(parts.flatMap(p => p.locations)),
    items: dedupeByName(parts.flatMap(p => p.items)),
    // Encounters are NOT deduped: two hobgoblin fights in different rooms
    // are legitimately different encounters even if the AI names them the same.
    encounters: parts.flatMap(p => p.encounters).filter(e => e.name?.trim()),
    spells: dedupeByName(parts.flatMap(p => p.spells)),
    feats: dedupeByName(parts.flatMap(p => p.feats)),
  };
}

export async function extractChapterEntities(
  chapterSlug: string,
  sections: ChapterSection[],
  opts: { skipAi?: boolean } = {}
): Promise<ChapterExtractionResult> {
  const attempts: SectionAttempt[] = [];
  const successful: ChapterExtraction[] = [];

  // Flatten sections into chunks (split oversized sections)
  const chunks: ChapterSection[] = sections.flatMap(chunkSection).filter(c => c.text.length >= 200);

  for (const section of chunks) {
    const userMessage = buildUserMessage(chapterSlug, section);
    const messages = [
      { role: 'system' as const, content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user' as const, content: userMessage },
    ];
    if (opts.skipAi) {
      attempts.push({
        sectionHeading: section.heading,
        sectionLength: section.text.length,
        prompt: userMessage,
        rawResponse: '',
        parsed: null,
        parseError: 'skipped',
        durationMs: 0,
      });
      continue;
    }
    const started = Date.now();
    try {
      const raw = await chatWithAI(messages, { temperature: 0.1 });
      const durationMs = Date.now() - started;
      const { parsed, error } = tryParse(raw);
      attempts.push({
        sectionHeading: section.heading,
        sectionLength: section.text.length,
        prompt: userMessage,
        rawResponse: raw,
        parsed,
        parseError: error,
        durationMs,
      });
      if (parsed) successful.push(parsed);
    } catch (e) {
      attempts.push({
        sectionHeading: section.heading,
        sectionLength: section.text.length,
        prompt: userMessage,
        rawResponse: '',
        parsed: null,
        parseError: `AI call: ${(e as Error).message}`,
        durationMs: Date.now() - started,
      });
    }
  }

  return { attempts, merged: mergeExtractions(successful) };
}
