/**
 * AI-powered homebrew description parser.
 * Separates narrative lore from mechanical effects in DDB item descriptions.
 *
 * Fire-and-forget safe: never throws, returns fallback on any error.
 */

import type { ItemEffect } from '@/lib/dnd-schemas';

export interface ParsedDescription {
  lore: string;
  effects: ItemEffect[];
}

const FALLBACK = (rawDescription: string): ParsedDescription => ({
  lore: rawDescription,
  effects: [],
});

function buildPrompt(name: string, type: string, rawDescription: string): string {
  return `You are parsing a D&D homebrew ${type} named "${name}".

The raw description below may contain: narrative lore, a "Stat Block:" or similar header, and bullet-pointed mechanical effects fused together.

Raw description:
${rawDescription}

Return ONLY a JSON object with exactly these two fields:
{
  "lore": "<clean narrative text only, no stat block header, no mechanical bullet points>",
  "effects": [
    {
      "name": "<short effect name>",
      "description": "<full description of this mechanical effect>",
      "mechanic": {
        "type": "<one of: advantage, damage_bypass, ac_bonus, attack_bonus, ability_bonus, resistance, immunity, custom>",
        "target": "<optional: what the bonus/effect applies to>",
        "value": <optional numeric bonus>,
        "condition": "<optional: trigger condition>"
      }
    }
  ]
}

Rules:
- "lore" must be clean narrative only — remove any "Stat Block:" header and mechanical bullet points
- Each effect in "effects" must have "name" and "description" (strings)
- "mechanic" is optional; include it only if a structured mechanic is clearly present
- "mechanic.type" must be exactly one of the 8 listed values
- "mechanic.value" must be a number if present (e.g. 2 for "+2 AC")
- If there are no mechanical effects, return "effects": []
- Return ONLY the JSON object, no explanation, no code fences`;
}

function parseResponse(text: string, rawDescription: string): ParsedDescription {
  let cleaned = text.trim();

  // Strip code fences
  const fenceMatch = cleaned.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  // Remove trailing commas before ] or }
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed !== 'object' || parsed === null) return FALLBACK(rawDescription);

    const lore = typeof parsed.lore === 'string' ? parsed.lore.trim() : rawDescription;
    const rawEffects = Array.isArray(parsed.effects) ? parsed.effects : [];

    const effects: ItemEffect[] = rawEffects
      .filter(
        (e: any) =>
          typeof e?.name === 'string' &&
          typeof e?.description === 'string'
      )
      .map((e: any): ItemEffect => {
        const effect: ItemEffect = {
          name: e.name,
          description: e.description,
        };
        if (e.mechanic && typeof e.mechanic === 'object') {
          const validTypes = [
            'advantage', 'damage_bypass', 'ac_bonus', 'attack_bonus',
            'ability_bonus', 'resistance', 'immunity', 'custom',
          ] as const;
          type MechanicType = typeof validTypes[number];
          if (validTypes.includes(e.mechanic.type as MechanicType)) {
            effect.mechanic = {
              type: e.mechanic.type as MechanicType,
              target: typeof e.mechanic.target === 'string' ? e.mechanic.target : undefined,
              value: typeof e.mechanic.value === 'number' ? e.mechanic.value : undefined,
              condition: typeof e.mechanic.condition === 'string' ? e.mechanic.condition : undefined,
            };
          }
        }
        return effect;
      });

    return { lore, effects };
  } catch {
    return FALLBACK(rawDescription);
  }
}

export async function parseHomebrewDescription(input: {
  name: string;
  type: string;
  rawDescription: string;
}): Promise<ParsedDescription> {
  try {
    const prompt = buildPrompt(input.name, input.type, input.rawDescription);

    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL ?? 'llama3.2';

    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) return FALLBACK(input.rawDescription);

    const result = await response.json();
    return parseResponse(result.response ?? '', input.rawDescription);
  } catch (err) {
    console.warn(
      '[parse-homebrew-description] Failed to parse description:',
      err instanceof Error ? err.message : 'Unknown error'
    );
    return FALLBACK(input.rawDescription);
  }
}
