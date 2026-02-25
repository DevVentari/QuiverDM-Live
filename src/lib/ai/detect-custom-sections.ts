export interface CustomSection { label: string; content: string; }

const STANDARD_FIELDS: Record<string, Set<string>> = {
  item: new Set(['description','text','type','item_type','rarity','requires_attunement','attunement','weight','value','cost','damage','damage_type','properties','imagePromptHint','customSections']),
  spell: new Set(['description','text','level','spell_level','school','casting_time','castingTime','range','components','duration','concentration','ritual','higher_levels','classes','imagePromptHint','customSections']),
  creature: new Set(['description','text','challenge_rating','cr','creature_type','type','size','alignment','armor_class','ac','hit_points','hp','speed','ability_scores','abilityScores','actions','legendary_actions','reactions','special_abilities','traits','senses','languages','skills','imagePromptHint','customSections']),
};
const ALWAYS_SKIP = new Set(['id','userId','createdAt','updatedAt','searchText','images','tags','imagePromptHint','customSections']);

function getNonStandardFields(type: string, data: Record<string, unknown>): Record<string, unknown> {
  const std = STANDARD_FIELDS[type] ?? new Set<string>();
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (ALWAYS_SKIP.has(key) || std.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    result[key] = value;
  }
  return result;
}

function buildPrompt(type: string, fields: Record<string, unknown>): string {
  return `You are analyzing D&D homebrew content of type "${type}".
The following fields are NOT part of the standard ${type} schema:
${JSON.stringify(fields, null, 2)}
Identify named sections a DM might have added (e.g. "Curse", "History", "DM Notes", "Adventure Hooks").
Return ONLY a JSON array, no explanation, no code fences:
[{ "label": "Curse", "content": "..." }]
If none, return: []`;
}

function parseResponse(text: string): CustomSection[] {
  let cleaned = text.trim();
  const fence = cleaned.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fence) cleaned = fence[1].trim();
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s: unknown) => typeof (s as any)?.label === 'string' && typeof (s as any)?.content === 'string');
  } catch { return []; }
}

export async function detectCustomSections(type: string, data: Record<string, unknown>): Promise<CustomSection[]> {
  try {
    const fields = getNonStandardFields(type, data);
    if (Object.keys(fields).length === 0) return [];
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL ?? 'llama3.2';
    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: buildPrompt(type, fields), stream: false }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return [];
    const result = await response.json() as { response?: string };
    return parseResponse(result.response ?? '');
  } catch { return []; }
}