import { chatWithAI } from '@/lib/ai/chat';

export type ExtractedEntityType =
  | 'location' | 'npc' | 'item' | 'creature'
  | 'faction' | 'lore' | 'timeline' | 'spell' | 'race';

export type ExtractedEntity = {
  type: ExtractedEntityType;
  name: string;
  description?: string;
  data?: Record<string, unknown>;
  tags?: string[];
};

const MAX_CONTENT_LENGTH = 50_000;

const VALID_ENTITY_TYPES = new Set<string>([
  'location', 'npc', 'item', 'creature', 'faction', 'lore', 'timeline', 'spell', 'race',
]);

const SYSTEM_PROMPT = `You are a D&D world content extractor. Extract named entities from the provided markdown and return a JSON array.

Each entity must have:
- type: "location" | "npc" | "item" | "creature" | "faction" | "lore" | "timeline" | "spell" | "race"
- name: string (entity name, never a section header)
- description: string (1–3 sentences)
- data: object with type-specific fields:
  - location: { region?: string, terrain?: string, notable_features?: string }
  - npc: { role?: string, alignment?: string, personality?: string }
  - item: { rarity_type?: string, properties?: string[] }
  - creature: { type_alignment?: string, traits?: {name:string,description:string}[], actions?: {name:string,description:string}[] }
  - faction: { goals?: string, allegiances?: string }
  - spell: { level?: number, school?: string, casting_time?: string, range?: string, duration?: string }
  - race: { traits?: {name:string,description:string}[], subraces?: string[] }
  - lore/timeline: {}
- tags: string[]

Return ONLY a valid JSON array. No markdown fences, no prose.
Skip: section headers without substance, table-of-contents entries, navigation text.`;

export async function extractEntitiesFromMarkdown({
  content,
  hint,
}: {
  content: string;
  hint?: string;
}): Promise<ExtractedEntity[]> {
  try {
    const truncated = content.slice(0, MAX_CONTENT_LENGTH);
    const hintLine = hint
      ? `\nThis file primarily contains: ${hint}. Prioritise those, but extract all other entity types too.\n`
      : '';

    const raw = await chatWithAI([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Extract all entities from this markdown:${hintLine}\n\n${truncated}` },
    ]);

    const json = (raw ?? '').trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ExtractedEntity =>
        typeof e.name === 'string' &&
        e.name.trim() !== '' &&
        VALID_ENTITY_TYPES.has(e.type),
    );
  } catch {
    return [];
  }
}
