export interface BrainExtractionInput {
  summary: string;
  highlights?: Array<{ type: string; text: string }>;
  existingEntities: Array<{ id: string; name: string; type: string }>;
}

export interface ExtractedEntity {
  name: string;
  type: 'NPC' | 'PC' | 'FACTION' | 'LOCATION' | 'ITEM' | 'EVENT' | 'ARC' | 'THREAT' | 'SECRET' | 'CUSTOM';
  description?: string;
  properties?: Record<string, string>;
  status?: 'active' | 'dormant' | 'destroyed' | 'resolved';
}

export interface ExtractedRelationship {
  fromEntityName: string;
  toEntityName: string;
  type: string;
  strength: number;
  description?: string;
}

export interface ExtractedHook {
  text: string;
  urgency: 'low' | 'medium' | 'high';
  linkedEntityNames: string[];
}

export interface PressureShifts {
  political?: number;
  supernatural?: number;
  economic?: number;
  cosmic?: number;
  social?: number;
}

export interface BrainExtractionResult {
  newEntities: ExtractedEntity[];
  entityUpdates: Array<{ name: string; type: string; properties?: Record<string, string>; status?: string }>;
  relationships: ExtractedRelationship[];
  newHooks: ExtractedHook[];
  pressureShifts: PressureShifts;
}

export function buildBrainExtractionPrompt(input: BrainExtractionInput): string {
  const existingList = input.existingEntities.length > 0
    ? input.existingEntities.map(e => `- ${e.name} (${e.type})`).join('\n')
    : '(none yet)';

  const highlightText = input.highlights && input.highlights.length > 0
    ? `\nKey moments:\n${input.highlights.map(h => `- [${h.type}] ${h.text}`).join('\n')}`
    : '';

  return `You are analyzing a D&D session summary to extract world state information for the DM Brain system.

Session summary:
${input.summary}${highlightText}

Existing entities already tracked:
${existingList}

Extract the following from the session summary. Be conservative — only extract what is clearly stated or strongly implied. Do not invent entities or relationships.

Respond ONLY with valid JSON in this exact shape:
{
  "newEntities": [
    {
      "name": "entity name",
      "type": "NPC|PC|FACTION|LOCATION|ITEM|EVENT|ARC|THREAT|SECRET|CUSTOM",
      "description": "brief description",
      "properties": { "key": "value" },
      "status": "active|dormant|destroyed|resolved"
    }
  ],
  "entityUpdates": [
    {
      "name": "existing entity name",
      "type": "entity type",
      "properties": { "key": "new value" },
      "status": "new status if changed"
    }
  ],
  "relationships": [
    {
      "fromEntityName": "entity A name",
      "toEntityName": "entity B name",
      "type": "alliance|rivalry|member_of|located_in|owns|knows_about|hunts|protects|seeks",
      "strength": 0.7,
      "description": "brief description"
    }
  ],
  "newHooks": [
    {
      "text": "one sentence describing the unresolved hook",
      "urgency": "low|medium|high",
      "linkedEntityNames": ["entity name"]
    }
  ],
  "pressureShifts": {
    "political": 0.05,
    "supernatural": -0.03,
    "economic": 0,
    "cosmic": 0,
    "social": 0.02
  }
}

Rules:
- Only include entities that APPEAR in the summary. Skip newEntities if none found.
- entityUpdates only for EXISTING entities (from the list above) that changed this session.
- pressureShifts are deltas (-0.2 to +0.2), applied to current values. Use 0 for unchanged tracks.
- Keep descriptions under 100 words.
- Skip empty arrays — omit them from the response if empty.`;
}

export function parseBrainExtractionResponse(raw: string): BrainExtractionResult {
  let text = raw.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(text) as Partial<BrainExtractionResult>;
  return {
    newEntities: Array.isArray(parsed.newEntities) ? parsed.newEntities : [],
    entityUpdates: Array.isArray(parsed.entityUpdates) ? parsed.entityUpdates : [],
    relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
    newHooks: Array.isArray(parsed.newHooks) ? parsed.newHooks : [],
    pressureShifts: parsed.pressureShifts && typeof parsed.pressureShifts === 'object' ? parsed.pressureShifts : {},
  };
}
