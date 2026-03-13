import { chatWithAI } from './chat';

function parseJson<T>(text: string, fallback: T): T {
  const match = text.match(/```json\n?([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  try {
    return JSON.parse(match ? match[1] : text) as T;
  } catch {
    return fallback;
  }
}

export interface ExtractedNpc {
  name: string;
  description: string;
  faction?: string;
  role?: string;
  alignment?: string;
  secrets?: string;
  stats?: Record<string, unknown>;
  tags: string[];
}

export async function extractNpc(markdown: string, userGeminiKey?: string, userId?: string): Promise<ExtractedNpc> {
  const prompt = `Extract this D&D NPC from the markdown. Return ONLY valid JSON with these fields:
{
  "name": "full NPC name",
  "description": "personality, appearance, background, motivations — preserve all key narrative details",
  "alignment": "alignment string e.g. Lawful Good",
  "faction": "faction or group name if mentioned",
  "role": "their role or title",
  "secrets": "any secrets or hidden information",
  "stats": { "hp": number, "ac": number, "speed": number, "str": number, "dex": number, "con": number, "int": number, "wis": number, "cha": number, "cr": "string" },
  "tags": ["array", "of", "relevant", "tags"]
}

Stats are often in a markdown table like:
| **Hit Points** | 142 |
| **Armor Class** | 18 |
| **STR** | **DEX** | ... |
| 16 (+3) | 14 (+2) | ... |
Extract the numeric values from these tables. If a stat is missing or unclear, use 0.

Markdown:
${markdown.slice(0, 5000)}`;

  const raw = await chatWithAI([{ role: 'user', content: prompt }], { userGeminiKey, userId });
  return parseJson<ExtractedNpc>(raw, {
    name: 'Unknown NPC',
    description: markdown.slice(0, 500),
    tags: [],
  });
}

export interface ExtractedCharacter {
  name: string;
  race?: string;
  class?: string;
  subclass?: string;
  level: number;
  abilityScores?: Record<string, number>;
  hitPoints?: { max: number; current: number; temp: number };
  armorClass?: number;
  backstory?: string;
  personalityTraits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
}

export async function extractCharacter(markdown: string, userGeminiKey?: string, userId?: string): Promise<ExtractedCharacter> {
  const prompt = `Extract this D&D player character from the markdown. Return ONLY valid JSON:
{
  "name": "string",
  "race": "string",
  "class": "string",
  "subclass": "string or null",
  "level": number,
  "abilityScores": { "str": number, "dex": number, "con": number, "int": number, "wis": number, "cha": number },
  "hitPoints": { "max": number, "current": number, "temp": 0 },
  "armorClass": number,
  "backstory": "string",
  "personalityTraits": "string",
  "ideals": "string",
  "bonds": "string",
  "flaws": "string"
}

Stats and level are often in markdown tables:
| **Level** | 9 |       → level = 9
| **Hit Points** | 67 |  → hitPoints.max = 67
| **Armor Class** | 15 | → armorClass = 15
| **STR** | **DEX** | **CON** | **INT** | **WIS** | **CHA** |
| 11 (+0) | 17 (+3) | 16 (+3) | 14 (+2) | 16 (+3) | 17 (+3) |  → extract numeric values before the (+n)

Parse the class and subclass from the header italic line e.g. "_Wood Half-Elf Ranger / Fighter (Horizon Walker), Neutral Good_"

Markdown:
${markdown.slice(0, 4000)}`;

  const raw = await chatWithAI([{ role: 'user', content: prompt }], { userGeminiKey, userId });
  return parseJson<ExtractedCharacter>(raw, {
    name: 'Unknown Character',
    level: 1,
  });
}

export interface ExtractedSession {
  title: string;
  sessionNumber?: number;
  date?: string;
  quickNotes?: string;
  prepData?: Record<string, unknown>;
}

export async function extractSession(
  markdown: string,
  mode: 'planning' | 'completed',
  userGeminiKey?: string,
  userId?: string
): Promise<ExtractedSession> {
  if (mode === 'planning') {
    const prompt = `Extract this D&D session prep document. Return ONLY valid JSON:
{
  "title": "string",
  "sessionNumber": number or null,
  "date": "ISO date string or null",
  "prepData": {
    "strongStart": "opening scene description",
    "scenes": ["scene 1", "scene 2"],
    "secrets": ["secret 1", "secret 2"],
    "clues": ["clue 1"],
    "fantasticLocations": ["location 1"],
    "notableNPCs": ["npc name 1"],
    "monsters": ["monster 1"],
    "magic": ["item 1"]
  }
}

Markdown:
${markdown.slice(0, 5000)}`;

    const raw = await chatWithAI([{ role: 'user', content: prompt }], { userGeminiKey, userId });
    return parseJson<ExtractedSession>(raw, { title: 'Untitled Session' });
  } else {
    const prompt = `Extract this D&D session notes document. Return ONLY valid JSON:
{
  "title": "string",
  "sessionNumber": number or null,
  "date": "ISO date string or null",
  "quickNotes": "comprehensive summary of what happened — key events, outcomes, NPC interactions, and player decisions. Preserve narrative details."
}

The date is often in frontmatter (date: 2025-11-19) or in a table "| **Session Date** | Nov 19, 2025 |".
The session number may be in the filename or title e.g. "Session 5" or in a table "| **Session** | 5 |".

Markdown:
${markdown.slice(0, 5000)}`;

    const raw = await chatWithAI([{ role: 'user', content: prompt }], { userGeminiKey, userId });
    return parseJson<ExtractedSession>(raw, { title: 'Untitled Session' });
  }
}

export interface ExtractedHomebrew {
  name: string;
  description: string;
  properties?: Record<string, unknown>;
}

const HOMEBREW_TYPE_HINTS: Record<string, string> = {
  faction: `{
  "name": "faction name",
  "description": "goals, values, and overview",
  "properties": {
    "alignment": "string",
    "goals": ["goal 1", "goal 2"],
    "resources": "string",
    "notableMembers": ["name 1", "name 2"],
    "influenceAreas": ["region 1"],
    "relationships": { "factionName": "allied/hostile/neutral" }
  }
}`,
  location: `{
  "name": "location name",
  "description": "full description including atmosphere and significance",
  "properties": {
    "region": "string",
    "terrain": "string",
    "population": "string or number",
    "government": "string",
    "notableNPCs": ["name 1"],
    "notableLocations": ["sub-location 1"],
    "cosmicSignificance": "string or null"
  }
}`,
  item: `{
  "name": "item name",
  "description": "full description",
  "properties": {
    "type": "weapon/armor/wondrous/etc",
    "rarity": "common/uncommon/rare/very rare/legendary/artifact",
    "requiresAttunement": true or false,
    "effects": ["effect 1"],
    "charges": number or null
  }
}`,
  race: `{
  "name": "race name",
  "description": "lore and appearance",
  "properties": {
    "abilityScoreIncreases": { "str": 0, "dex": 0, "con": 0, "int": 0, "wis": 0, "cha": 0 },
    "size": "Small/Medium/Large",
    "speed": number,
    "traits": ["trait name: description"]
  }
}`,
  rule: `{
  "name": "rule or system name",
  "description": "full explanation of how this rule works",
  "properties": {
    "category": "combat/exploration/social/magic/etc",
    "mechanics": ["mechanic 1"]
  }
}`,
  adventure: `{
  "name": "adventure title",
  "description": "premise, hook, and overview",
  "properties": {
    "level": "recommended player level range",
    "theme": "string",
    "locations": ["location 1"],
    "mainNPCs": ["npc 1"],
    "objectives": ["objective 1"]
  }
}`,
};

export async function extractHomebrew(
  markdown: string,
  contentType: string,
  userGeminiKey?: string,
  userId?: string
): Promise<ExtractedHomebrew> {
  const schema = HOMEBREW_TYPE_HINTS[contentType] ?? `{
  "name": "string",
  "description": "full description preserving all important details",
  "properties": { "any": "relevant structured fields for this type" }
}`;

  const prompt = `Extract this D&D ${contentType} from the markdown. Return ONLY valid JSON matching this schema:
${schema}

Markdown:
${markdown.slice(0, 4000)}`;

  const raw = await chatWithAI([{ role: 'user', content: prompt }], { userGeminiKey, userId });
  return parseJson<ExtractedHomebrew>(raw, {
    name: 'Untitled',
    description: markdown.slice(0, 500),
  });
}
