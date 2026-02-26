/**
 * AI-powered custom section detection for homebrew content.
 * Identifies DM-specific named sections (e.g. Curse, History, Adventure Hooks)
 * that don't belong to the standard schema for a given homebrew type.
 *
 * Fire-and-forget safe: never throws, returns [] on any error.
 */

export interface CustomSection {
  label: string;
  content: string;
}

// Fields considered "standard" per type - AI skips these
const STANDARD_FIELDS: Record<string, Set<string>> = {
  item: new Set([
    'description', 'text', 'type', 'item_type', 'rarity',
    'requires_attunement', 'attunement', 'weight', 'value', 'cost',
    'damage', 'damage_type', 'properties', 'imagePromptHint', 'customSections',
  ]),
  spell: new Set([
    'description', 'text', 'level', 'spell_level', 'school',
    'casting_time', 'castingTime', 'range', 'components', 'duration',
    'concentration', 'ritual', 'higher_levels', 'classes',
    'imagePromptHint', 'customSections',
  ]),
  creature: new Set([
    'description', 'text', 'challenge_rating', 'cr', 'creature_type', 'type',
    'size', 'alignment', 'armor_class', 'ac', 'hit_points', 'hp', 'speed',
    'ability_scores', 'abilityScores', 'actions', 'legendary_actions',
    'reactions', 'special_abilities', 'traits', 'senses', 'languages', 'skills',
    'imagePromptHint', 'customSections',
  ]),
};

const ALWAYS_SKIP = new Set([
  'id', 'userId', 'createdAt', 'updatedAt', 'searchText',
  'images', 'tags', 'imagePromptHint', 'customSections',
]);

function getNonStandardFields(
  type: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const standardForType = STANDARD_FIELDS[type] ?? new Set<string>();
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (ALWAYS_SKIP.has(key)) continue;
    if (standardForType.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    result[key] = value;
  }

  return result;
}

function buildPrompt(type: string, nonStandardFields: Record<string, unknown>): string {
  return `You are analyzing D&D homebrew content of type "${type}".

The following fields were found that are NOT part of the standard ${type} schema:
${JSON.stringify(nonStandardFields, null, 2)}

Identify named sections a DM might have added (e.g. "Curse", "History", "DM Notes", "Adventure Hooks", "Loot Table", "Variant Rules").
For each section, produce a human-readable label and the content as a clean plain text string.

Return ONLY a JSON array, no explanation, no code fences:
[
  { "label": "Curse", "content": "The wearer cannot remove the mask..." },
  { "label": "History", "content": "Forged in the Abyss by..." }
]

If no named sections can be identified, return an empty array: []`;
}

function parseResponse(text: string): CustomSection[] {
  let cleaned = text.trim();

  // Strip code fences
  const fenceMatch = cleaned.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  // Remove trailing commas before ] or }
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: any) => typeof s?.label === 'string' && typeof s?.content === 'string'
    );
  } catch {
    return [];
  }
}

export async function detectCustomSections(
  type: string,
  data: Record<string, unknown>
): Promise<CustomSection[]> {
  try {
    const nonStandardFields = getNonStandardFields(type, data);
    if (Object.keys(nonStandardFields).length === 0) return [];

    const prompt = buildPrompt(type, nonStandardFields);

    // Use Ollama - same base URL pattern as existing AI code
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL ?? 'llama3.2';

    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) return [];

    const result = await response.json();
    return parseResponse(result.response ?? '');
  } catch {
    // Fire-and-forget safe: always return [] on any error
    return [];
  }
}
