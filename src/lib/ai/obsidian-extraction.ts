import { callGemini } from './gemini';

interface ExtractionOpts {
  userGeminiKey?: string;
  userId?: string;
}

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
  secrets?: string;
  stats?: Record<string, unknown>;
  tags: string[];
}

export async function extractNpc(markdown: string, userGeminiKey?: string, userId?: string): Promise<ExtractedNpc> {
  const prompt = `Extract this D&D NPC from the markdown. Return ONLY valid JSON with these fields:
{
  "name": "string",
  "description": "personality, appearance, background (2-3 sentences)",
  "faction": "faction or group name if mentioned",
  "role": "their role or title",
  "secrets": "any secrets or hidden info",
  "stats": { "hp": number, "ac": number, "speed": number, "str": number, "dex": number, "con": number, "int": number, "wis": number, "cha": number, "cr": "string" },
  "tags": ["array", "of", "relevant", "tags"]
}

Markdown:
${markdown.slice(0, 3000)}`;

  const raw = await callGemini(prompt, userGeminiKey, userId ? { userId, feature: 'obsidian_import' } : undefined);
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

Markdown:
${markdown.slice(0, 3000)}`;

  const raw = await callGemini(prompt, userGeminiKey, userId ? { userId, feature: 'obsidian_import' } : undefined);
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
${markdown.slice(0, 4000)}`;

    const raw = await callGemini(prompt, userGeminiKey, userId ? { userId, feature: 'obsidian_import' } : undefined);
    return parseJson<ExtractedSession>(raw, { title: 'Untitled Session' });
  } else {
    const prompt = `Extract this D&D session notes document. Return ONLY valid JSON:
{
  "title": "string",
  "sessionNumber": number or null,
  "date": "ISO date string or null",
  "quickNotes": "summary of what happened, preserving key events and outcomes"
}

Markdown:
${markdown.slice(0, 4000)}`;

    const raw = await callGemini(prompt, userGeminiKey, userId ? { userId, feature: 'obsidian_import' } : undefined);
    return parseJson<ExtractedSession>(raw, { title: 'Untitled Session' });
  }
}

export interface ExtractedHomebrew {
  name: string;
  description: string;
  properties?: Record<string, unknown>;
}

export async function extractHomebrew(
  markdown: string,
  contentType: string,
  userGeminiKey?: string,
  userId?: string
): Promise<ExtractedHomebrew> {
  const prompt = `Extract this D&D ${contentType} from the markdown. Return ONLY valid JSON:
{
  "name": "string",
  "description": "full description preserving all important details",
  "properties": { "any": "relevant structured fields for this type" }
}

Markdown:
${markdown.slice(0, 3000)}`;

  const raw = await callGemini(prompt, userGeminiKey, userId ? { userId, feature: 'obsidian_import' } : undefined);
  return parseJson<ExtractedHomebrew>(raw, {
    name: 'Untitled',
    description: markdown.slice(0, 500),
  });
}
