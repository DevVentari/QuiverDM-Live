export const VALID_EVENT_TYPES = [
  'damage', 'healing', 'condition_applied', 'condition_removed',
  'spell_cast', 'spell_applied', 'spell_expired',
  'spell_slot_used', 'resource_used',
  'death_save_success', 'death_save_failed',
  'inspiration_gained', 'short_rest', 'long_rest',
] as const;

export type SessionEventType = (typeof VALID_EVENT_TYPES)[number];

export interface ExtractedSessionEvent {
  eventType: SessionEventType;
  characterName: string | null;
  eventData: Record<string, unknown>;
  confidence: number;
}

export const SESSION_EVENT_EXTRACTION_PROMPT = `You are a D&D 5e mechanical event extractor. Read the transcript excerpt and return ONLY a JSON array of mechanical events that occurred.

Each event must have this shape:
{
  "eventType": one of: damage | healing | condition_applied | condition_removed | spell_cast | spell_applied | spell_expired | spell_slot_used | resource_used | death_save_success | death_save_failed | inspiration_gained | short_rest | long_rest,
  "characterName": "name of the character this happened to, or null if it affects all",
  "eventData": {
    // For damage: { "amount": 14, "damageType": "slashing" }
    // For healing: { "amount": 8 }
    // For condition_applied/removed: { "condition": "Poisoned" }
    // For spell_applied: { "spellName": "Bless", "casterName": "Bram", "concentration": true, "duration": "1 minute", "targets": ["Aeryn", "Kira"] }
    // For spell_slot_used: { "level": 2 }
    // For death_save_success/failed: {}
    // For short_rest/long_rest: {}
  },
  "confidence": 0.0-1.0
}

Rules:
- Only extract clear mechanical events. Skip roleplay/narrative.
- confidence >= 0.9: very clear event
- confidence 0.6-0.89: probable but ambiguous
- Do NOT include events with confidence < 0.6
- Return [] if no mechanical events found
- Return ONLY the JSON array, no explanation

Transcript:
`;

export function parseEventExtractionResponse(raw: string): ExtractedSessionEvent[] {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return (parsed as unknown[]).filter((e): e is ExtractedSessionEvent => {
    return (
      typeof e === 'object' && e !== null &&
      VALID_EVENT_TYPES.includes((e as any).eventType) &&
      typeof (e as any).confidence === 'number'
    );
  });
}
