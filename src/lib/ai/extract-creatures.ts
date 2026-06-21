/**
 * Generic, sourcebook-agnostic creature stat-block extraction.
 *
 * Reads crawled chapter markdown (bodySections) and extracts creature stat blocks
 * via chatWithAI + a Zod schema, mirroring extract-chapter-entities.ts. The
 * produced `data` blob matches the shape the v3 Compendium statblock adapter and
 * `srdMonsterToRow` use, so extracted book-unique creatures render identically to
 * SRD monsters once seeded.
 *
 * SRD creatures are skipped (Phase 1 already surfaces the 322 SRD monsters
 * globally) — this captures only the book-UNIQUE creatures.
 */
import { z } from 'zod';
import { chatWithAI } from './chat';
import { getAllMonsters, parseCr } from '@/lib/srd/monsters';
import type { ChapterSection } from '@/lib/ddb-sourcebook';

const AbilitiesSchema = z
  .object({
    str: z.number(),
    dex: z.number(),
    con: z.number(),
    int: z.number(),
    wis: z.number(),
    cha: z.number(),
  })
  .partial();

const NamedDescSchema = z.object({ name: z.string(), desc: z.string().default('') });

export const CreatureStatBlockSchema = z.object({
  name: z.string(),
  size: z.string().optional(),
  type: z.string().optional(),
  alignment: z.string().optional(),
  ac: z.number().optional(),
  acNote: z.string().optional(),
  hp: z.number().optional(),
  hpDice: z.string().optional(),
  speed: z.string().optional(),
  abilities: AbilitiesSchema.optional(),
  savingThrows: z.string().optional(),
  skills: z.string().optional(),
  damageVulnerabilities: z.string().optional(),
  damageResistances: z.string().optional(),
  damageImmunities: z.string().optional(),
  conditionImmunities: z.string().optional(),
  senses: z.string().optional(),
  languages: z.string().optional(),
  // CR may come back as a number (4) or fractional string ("1/4").
  cr: z.union([z.number(), z.string()]).optional(),
  xp: z.number().optional(),
  traits: z.array(NamedDescSchema).default([]),
  actions: z.array(NamedDescSchema).default([]),
  reactions: z.array(NamedDescSchema).default([]),
  legendaryActions: z.array(NamedDescSchema).default([]),
});

export const CreatureExtractionSchema = z.object({
  creatures: z.array(CreatureStatBlockSchema).default([]),
});

export type ExtractedCreature = z.infer<typeof CreatureStatBlockSchema>;
export type CreatureExtraction = z.infer<typeof CreatureExtractionSchema>;

// ---- pure helpers (unit-tested) ------------------------------------------------

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/['’]s$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SRD_NAME_SET: Set<string> = new Set(getAllMonsters().map((m) => normalizeName(m.name)));

/** True if this creature is in the SRD bestiary (already surfaced globally — skip it). */
export function isSrdCreatureName(name: string): boolean {
  return SRD_NAME_SET.has(normalizeName(name));
}

function defence(value: string | undefined): string[] | undefined {
  return value && value.trim() ? [value] : undefined;
}

/** Map an extracted creature into the Compendium `data` blob (adaptStatBlock shape). */
export function creatureToHomebrewData(c: ExtractedCreature): Record<string, unknown> {
  const data: Record<string, unknown> = {
    size: c.size,
    type: c.type,
    alignment: c.alignment,
    cr: c.cr !== undefined ? parseCr(String(c.cr)) : undefined,
    xp: c.xp,
    ac: c.ac,
    acNote: c.acNote || undefined,
    hp: c.hp,
    hpDice: c.hpDice || undefined,
    speed: c.speed,
    abilities: c.abilities,
    savingThrows: c.savingThrows || undefined,
    skills: c.skills || undefined,
    damageVulnerabilities: defence(c.damageVulnerabilities),
    damageResistances: defence(c.damageResistances),
    damageImmunities: defence(c.damageImmunities),
    conditionImmunities: defence(c.conditionImmunities),
    senses: c.senses || undefined,
    languages: c.languages || undefined,
    actions: c.actions.map((a) => ({ name: a.name, description: a.desc })),
    traits: c.traits.map((a) => ({ name: a.name, description: a.desc })),
    reactions: c.reactions.map((a) => ({ name: a.name, description: a.desc })),
    legendaryActions: c.legendaryActions.map((a) => ({ name: a.name, description: a.desc })),
  };
  // Drop undefined keys so the stored blob stays clean.
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
  return data;
}

/** A creature is "more complete" if its stat block carries more filled fields. */
function completeness(c: ExtractedCreature): number {
  let n = 0;
  if (c.ac !== undefined) n++;
  if (c.hp !== undefined) n++;
  if (c.abilities) n++;
  if (c.cr !== undefined) n++;
  n += c.actions.length + c.traits.length + c.legendaryActions.length;
  return n;
}

/** Dedupe by normalised name, keeping the most complete stat block. */
export function dedupeCreaturesByName(creatures: ExtractedCreature[]): ExtractedCreature[] {
  const map = new Map<string, ExtractedCreature>();
  for (const c of creatures) {
    if (!c.name?.trim()) continue;
    const key = normalizeName(c.name);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || completeness(c) > completeness(existing)) map.set(key, c);
  }
  return [...map.values()];
}

// ---- AI extraction (I/O boundary) ----------------------------------------------

const MAX_SECTION_CHARS = 9000;

export const CREATURE_EXTRACTION_SYSTEM_PROMPT = `You are extracting D&D 5e creature/monster STAT BLOCKS from a sourcebook chapter.

Return ONLY a single JSON object (no commentary, no markdown fences) with this exact shape:

{
  "creatures": [
    {
      "name": string,
      "size"?: string,
      "type"?: string,                // creature type: aberration, beast, celestial, construct, dragon, elemental, fey, fiend, giant, humanoid, monstrosity, ooze, plant, undead
      "alignment"?: string,
      "ac"?: number,
      "acNote"?: string,              // e.g. "natural armor", "plate"
      "hp"?: number,
      "hpDice"?: string,              // e.g. "17d8 + 68"
      "speed"?: string,               // e.g. "30 ft., fly 60 ft."
      "abilities"?: { "str": number, "dex": number, "con": number, "int": number, "wis": number, "cha": number },
      "savingThrows"?: string,
      "skills"?: string,
      "damageVulnerabilities"?: string,
      "damageResistances"?: string,
      "damageImmunities"?: string,
      "conditionImmunities"?: string,
      "senses"?: string,
      "languages"?: string,
      "cr"?: number | string,         // challenge rating, e.g. 15 or "1/4"
      "xp"?: number,
      "traits"?: [{ "name": string, "desc": string }],
      "actions"?: [{ "name": string, "desc": string }],
      "reactions"?: [{ "name": string, "desc": string }],
      "legendaryActions"?: [{ "name": string, "desc": string }]
    }
  ]
}

Rules:
- ONLY extract creatures that have an actual STAT BLOCK in the text (AC, HP, ability scores, actions). Do NOT invent stats. Do NOT include creatures merely mentioned by name without a stat block.
- Copy values exactly as written. Keep action/trait descriptions complete (full text), not summarised.
- If a section has no stat blocks, return {"creatures": []}.`;

function buildUserMessage(chapterSlug: string, section: ChapterSection): string {
  return `Chapter: ${chapterSlug}\nSection: ${section.heading}\n\nSection text:\n${section.text}`;
}

function tryParse(raw: string): ExtractedCreature[] {
  const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const cleaned = match[0].replace(/,(\s*[}\]])/g, '');
    const obj = JSON.parse(cleaned);
    const result = CreatureExtractionSchema.safeParse(obj);
    return result.success ? result.data.creatures : [];
  } catch {
    return [];
  }
}

/**
 * Cheap pre-filter: a real 5e stat block always carries both an "Armor Class" and
 * a "Hit Points" line. Prose chapters don't. Skipping chunks that lack both means
 * we never spend LLM tokens on text that has no creature to extract — this is what
 * lets us scan EVERY chapter (catching inline stat blocks) at near-zero extra cost.
 */
export function chunkHasStatBlock(text: string): boolean {
  return /armor class/i.test(text) && /hit points/i.test(text);
}

export function chunkSection(section: ChapterSection): ChapterSection[] {
  if (section.text.length <= MAX_SECTION_CHARS) return [section];
  const paragraphs = section.text.split(/\n\n+/);
  const chunks: ChapterSection[] = [];
  let buf = '';
  let i = 1;
  for (const p of paragraphs) {
    if (buf.length + p.length + 2 > MAX_SECTION_CHARS && buf.length > 0) {
      chunks.push({ heading: `${section.heading} (part ${i++})`, text: buf.trim() });
      buf = '';
    }
    buf += (buf ? '\n\n' : '') + p;
  }
  if (buf.trim()) chunks.push({ heading: `${section.heading} (part ${i})`, text: buf.trim() });
  return chunks;
}

export interface CreatureExtractionResult {
  creatures: ExtractedCreature[];
  chunksProcessed: number;
  chunksFailed: number;
  /** Chunks skipped by the stat-block pre-filter (no LLM tokens spent on them). */
  chunksSkipped: number;
}

/**
 * Extract book-unique creatures from a chapter's sections. SRD creatures are
 * dropped. Fire-and-forget safe per chunk — a failed chunk doesn't abort the run.
 * Chunks with no stat-block markers are skipped before any LLM call (token-efficient).
 */
export async function extractCreaturesFromSections(
  chapterSlug: string,
  sections: ChapterSection[],
  opts: { provider?: string; delayMs?: number } = {},
): Promise<CreatureExtractionResult> {
  const allChunks = sections.flatMap(chunkSection).filter((c) => c.text.length >= 200);
  // Only spend tokens on chunks that actually contain a stat block.
  const chunks = allChunks.filter((c) => chunkHasStatBlock(c.text));
  const chunksSkipped = allChunks.length - chunks.length;
  const all: ExtractedCreature[] = [];
  let chunksFailed = 0;

  for (let idx = 0; idx < chunks.length; idx++) {
    const section = chunks[idx];
    // Pace requests to respect a provider's tokens-per-minute limit (e.g. groq
    // free tier is 12k TPM — a delay keeps a multi-chunk chapter from 429-ing).
    if (opts.delayMs && idx > 0) await new Promise((r) => setTimeout(r, opts.delayMs));
    const messages = [
      { role: 'system' as const, content: CREATURE_EXTRACTION_SYSTEM_PROMPT },
      { role: 'user' as const, content: buildUserMessage(chapterSlug, section) },
    ];
    // One retry: the provider fallback chain can transiently bottom out (e.g. an
    // Ollama headers-timeout) on a single chunk; a retry usually lands on a healthy provider.
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      try {
        const raw = await chatWithAI(messages, { temperature: 0.1, forceProvider: opts.provider });
        all.push(...tryParse(raw));
        ok = true;
      } catch {
        /* retry */
      }
    }
    if (!ok) chunksFailed++;
  }

  const unique = dedupeCreaturesByName(all).filter((c) => !isSrdCreatureName(c.name));
  return { creatures: unique, chunksProcessed: chunks.length, chunksFailed, chunksSkipped };
}
