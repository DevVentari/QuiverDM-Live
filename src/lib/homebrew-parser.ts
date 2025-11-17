/**
 * Homebrew Content Parser
 *
 * Extracts D&D homebrew content (spells, monsters, items, etc.) from markdown
 * using Ollama for intelligent parsing
 */

import { extractStructuredData, isOllamaAvailable } from './ollama';

type HomebrewContentType = 'item' | 'creature' | 'spell' | 'location' | 'subclass' | 'feat' | 'rule' | 'race' | 'class' | 'background' | 'character';

export interface ParsedHomebrewItem {
  name: string;
  type: HomebrewContentType;
  description: string;
  data: Record<string, any>;
  sourceSection?: string; // Which section of markdown this came from
}

export interface ParseResult {
  items: ParsedHomebrewItem[];
  totalFound: number;
  parsingMethod: 'ollama' | 'regex' | 'manual';
  warnings?: string[];
}

/**
 * Main parsing function - attempts Ollama first, falls back to regex
 */
export async function parseHomebrewMarkdown(
  markdown: string,
  preferredTypes?: HomebrewContentType[]
): Promise<ParseResult> {
  const ollamaAvailable = await isOllamaAvailable();

  if (ollamaAvailable) {
    console.log('[HomebrewParser] Using Ollama for intelligent parsing');
    try {
      return await parseWithOllama(markdown, preferredTypes);
    } catch (error) {
      console.warn('[HomebrewParser] Ollama parsing failed, falling back to regex:', error);
      return parseWithRegex(markdown, preferredTypes);
    }
  } else {
    console.log('[HomebrewParser] Ollama not available, using regex parsing');
    return parseWithRegex(markdown, preferredTypes);
  }
}

/**
 * Parse markdown using Ollama for intelligent extraction
 */
async function parseWithOllama(
  markdown: string,
  preferredTypes?: HomebrewContentType[]
): Promise<ParseResult> {
  const typesHint = preferredTypes
    ? `Focus on these types: ${preferredTypes.join(', ')}`
    : 'Extract all D&D homebrew content types';

  const schemaPrompt = `
Extract all D&D 5e homebrew content from the provided markdown. ${typesHint}.

Return a JSON array of items, where each item has:
- name: string (the item/spell/monster name)
- type: one of [SPELL, MONSTER, MAGIC_ITEM, FEAT, CLASS, RACE, BACKGROUND, OTHER]
- description: string (full description/text)
- data: object with type-specific properties

For SPELL type, include in data:
- level: number (0-9)
- school: string
- castingTime: string
- range: string
- components: string
- duration: string

For MONSTER type, include in data:
- cr: string (challenge rating)
- type: string (creature type)
- size: string
- ac: number
- hp: string
- speed: string

For MAGIC_ITEM type, include in data:
- rarity: string
- requiresAttunement: boolean
- itemType: string (weapon, armor, wondrous, etc.)

Return ONLY the JSON array, no other text.
`;

  interface OllamaExtractedItem {
    name: string;
    type: string;
    description: string;
    data: Record<string, any>;
  }

  const extracted = await extractStructuredData<OllamaExtractedItem[]>(
    markdown,
    schemaPrompt,
    {
      model: 'llama3.2', // Good balance of speed and quality
      temperature: 0.1, // Low for consistent extraction
    }
  );

  const items: ParsedHomebrewItem[] = extracted.map((item) => ({
    ...item,
    type: normalizeType(item.type),
  }));

  return {
    items,
    totalFound: items.length,
    parsingMethod: 'ollama',
  };
}

/**
 * Fallback regex-based parsing for when Ollama isn't available
 */
function parseWithRegex(
  markdown: string,
  preferredTypes?: HomebrewContentType[]
): ParseResult {
  const items: ParsedHomebrewItem[] = [];
  const warnings: string[] = [];

  // Split into sections by headers
  const sections = markdown.split(/^#{1,3}\s+/m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split('\n');
    const title = lines[0]?.trim();

    if (!title) continue;

    // Try to detect content type from section
    const detectedType = detectTypeFromSection(section, title);

    if (detectedType && (!preferredTypes || preferredTypes.includes(detectedType))) {
      const item = parseSection(section, title, detectedType);
      if (item) {
        items.push(item);
      } else {
        warnings.push(`Could not parse section: ${title}`);
      }
    }
  }

  return {
    items,
    totalFound: items.length,
    parsingMethod: 'regex',
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Detect homebrew type from section content
 */
function detectTypeFromSection(section: string, title: string): HomebrewContentType | null {
  const lower = section.toLowerCase();
  const titleLower = title.toLowerCase();

  // Spell indicators
  if (
    lower.includes('level') &&
    (lower.includes('spell') ||
      lower.includes('casting time') ||
      lower.includes('components') ||
      /\d+(st|nd|rd|th)-level/.test(lower))
  ) {
    return 'spell';
  }

  // Monster indicators
  if (
    (lower.includes('armor class') || lower.includes('hit points')) &&
    (lower.includes('challenge') || lower.includes('cr '))
  ) {
    return 'creature';
  }

  // Magic item indicators
  if (
    (lower.includes('rarity') || lower.includes('requires attunement')) &&
    (lower.includes('weapon') ||
      lower.includes('armor') ||
      lower.includes('wondrous') ||
      titleLower.includes('of '))
  ) {
    return 'item';
  }

  // Feat indicators
  if (lower.includes('prerequisite') || titleLower.includes('feat')) {
    return 'feat';
  }

  return null;
}

/**
 * Parse a section into a homebrew item
 */
function parseSection(
  section: string,
  title: string,
  type: HomebrewContentType
): ParsedHomebrewItem | null {
  const lines = section.split('\n').slice(1); // Skip title line
  const description = lines.join('\n').trim();

  const data: Record<string, any> = {};

  switch (type) {
    case 'spell':
      data.level = extractSpellLevel(section);
      data.school = extractField(section, /school[:\s]+(\w+)/i);
      data.castingTime = extractField(section, /casting time[:\s]+([^\n]+)/i);
      data.range = extractField(section, /range[:\s]+([^\n]+)/i);
      data.components = extractField(section, /components[:\s]+([^\n]+)/i);
      data.duration = extractField(section, /duration[:\s]+([^\n]+)/i);
      break;

    case 'creature':
      data.cr = extractField(section, /challenge[:\s]+([^\n]+)/i) || extractField(section, /cr[:\s]+([^\n]+)/i);
      data.type = extractField(section, /type[:\s]+([^\n]+)/i);
      data.size = extractField(section, /size[:\s]+([^\n]+)/i);
      data.ac = extractNumber(section, /armor class[:\s]+(\d+)/i) || extractNumber(section, /ac[:\s]+(\d+)/i);
      data.hp = extractField(section, /hit points[:\s]+([^\n]+)/i) || extractField(section, /hp[:\s]+([^\n]+)/i);
      data.speed = extractField(section, /speed[:\s]+([^\n]+)/i);
      break;

    case 'item':
      data.rarity = extractField(section, /rarity[:\s]+([^\n]+)/i);
      data.requiresAttunement = section.toLowerCase().includes('requires attunement');
      data.itemType = extractField(section, /(weapon|armor|wondrous|potion|scroll|ring|rod|staff|wand)/i);
      break;
  }

  return {
    name: title,
    type,
    description,
    data,
    sourceSection: section.substring(0, 100) + '...',
  };
}

/**
 * Helper: Extract spell level from text
 */
function extractSpellLevel(text: string): number {
  const match = text.match(/(\d+)(st|nd|rd|th)-level/i);
  if (match) return parseInt(match[1]);

  if (text.toLowerCase().includes('cantrip')) return 0;

  return 1; // Default
}

/**
 * Helper: Extract field using regex
 */
function extractField(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[1]?.trim();
}

/**
 * Helper: Extract number using regex
 */
function extractNumber(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  return match ? parseInt(match[1]) : undefined;
}

/**
 * Normalize type string to HomebrewContentType enum
 */
function normalizeType(typeStr: string): HomebrewContentType {
  const lower = typeStr.toLowerCase().replace(/\s+/g, '_');

  const typeMap: Record<string, HomebrewContentType> = {
    'spell': 'spell',
    'monster': 'creature',
    'creature': 'creature',
    'magic_item': 'item',
    'item': 'item',
    'feat': 'feat',
    'class': 'class',
    'race': 'race',
    'background': 'background',
    'subclass': 'subclass',
    'rule': 'rule',
    'location': 'location',
    'character': 'character',
  };

  return typeMap[lower] || 'item';
}
