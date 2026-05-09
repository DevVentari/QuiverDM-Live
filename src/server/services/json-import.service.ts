import { WorldEntityType } from '@prisma/client';

// ─── JSON envelope types ─────────────────────────────────────────────────────

interface JsonEnvelope {
  metadata: { title: string; date?: string; tags?: string[] };
  source: string;
  type: string;
  data: JsonEntry[];
}

interface JsonEntry {
  name: string;
  description?: string;
  content?: string;
  type_alignment?: string;
  mechanics?: Record<string, unknown>;
  [key: string]: unknown;
}

// ─── Output types ────────────────────────────────────────────────────────────

export interface ParsedDocument {
  title: string;
  slug: string;
  type: string;
  content: string;
  data: unknown;
  tags: string[];
  sourceFile: string;
  searchText: string;
}

export interface ParsedNpc {
  name: string;
  description: string | null;
  role: string | null;
  stats: Record<string, unknown>;
  tags: string[];
}

export interface ParsedHomebrew {
  type: string;
  name: string;
  data: Record<string, unknown>;
  tags: string[];
  searchText: string;
}

export interface ParsedEntity {
  type: WorldEntityType;
  name: string;
  description: string;
  properties: Record<string, unknown>;
}

export interface ParsedFile {
  filename: string;
  document: ParsedDocument;
  npcs: ParsedNpc[];
  homebrew: ParsedHomebrew[];
  entities: ParsedEntity[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const SKIP_NAMES = new Set([
  'bestiary of the grand harvest',
  'master item list',
  'introduction',
  'overview',
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function slugifyFilename(source: string): string {
  const basename = source.replace(/\\/g, '/').split('/').pop() ?? source;
  return basename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function isHeaderEntry(entry: JsonEntry): boolean {
  const nameLower = entry.name.toLowerCase().trim();
  if (SKIP_NAMES.has(nameLower)) return true;
  const mechanics = entry.mechanics ?? {};
  if (Object.keys(mechanics).length === 0) {
    const desc = (entry.description ?? entry.content ?? '').trim();
    if (/^#+\s/.test(desc)) return true;
  }
  return false;
}

function docTypeFromJsonType(jsonType: string, tags: string[]): string {
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  if (jsonType === 'actor') {
    return tagSet.has('monsters') || tagSet.has('bestiary') ? 'bestiary' : 'npc-collection';
  }
  const map: Record<string, string> = {
    faction: 'faction',
    location: 'location',
    item: 'item',
    race: 'race',
    adventure: 'adventure',
    lore: 'lore',
  };
  return map[jsonType] ?? jsonType;
}

function buildSearchText(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

function dataToMarkdown(data: JsonEntry[]): string {
  return data
    .map((e) => {
      const heading = `## ${e.name}`;
      const body = e.content ?? e.description ?? '';
      return `${heading}\n\n${body}`;
    })
    .join('\n\n---\n\n');
}

// ─── Core parser ─────────────────────────────────────────────────────────────

export function parseJsonFile(filename: string, raw: string): ParsedFile | null {
  let envelope: JsonEnvelope;
  try {
    envelope = JSON.parse(raw) as JsonEnvelope;
  } catch {
    return null;
  }

  if (!envelope?.metadata || !envelope?.type || !Array.isArray(envelope?.data)) {
    return null;
  }

  const { metadata, source, type: jsonType, data } = envelope;
  const tags = metadata.tags ?? [];
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  const slug = slugifyFilename(source ?? filename);
  const docType = docTypeFromJsonType(jsonType, tags);

  const document: ParsedDocument = {
    title: metadata.title,
    slug,
    type: docType,
    content: dataToMarkdown(data),
    data,
    tags,
    sourceFile: source ?? filename,
    searchText: buildSearchText([metadata.title, ...tags]),
  };

  const npcs: ParsedNpc[] = [];
  const homebrew: ParsedHomebrew[] = [];
  const entities: ParsedEntity[] = [];

  for (const entry of data) {
    if (isHeaderEntry(entry)) continue;

    const desc = (entry.description ?? entry.content ?? '').slice(0, 600);

    if (jsonType === 'actor') {
      const isNpc = tagSet.has('npc') || tagSet.has('major') || tagSet.has('minor');
      const isMonster = tagSet.has('monsters') || tagSet.has('bestiary');

      if (isNpc) {
        npcs.push({
          name: entry.name,
          description: desc || null,
          role: (entry.type_alignment as string) ?? null,
          stats: entry as Record<string, unknown>,
          tags,
        });
        entities.push({
          type: WorldEntityType.NPC,
          name: entry.name,
          description: desc,
          properties: { role: entry.type_alignment },
        });
      } else if (isMonster) {
        homebrew.push({
          type: 'creature',
          name: entry.name,
          data: entry as Record<string, unknown>,
          tags,
          searchText: buildSearchText([entry.name, ...tags, desc]),
        });
      }
      continue;
    }

    if (jsonType === 'faction') {
      entities.push({
        type: WorldEntityType.FACTION,
        name: entry.name,
        description: desc,
        properties: (entry.mechanics ?? {}) as Record<string, unknown>,
      });
      continue;
    }

    if (jsonType === 'location') {
      entities.push({
        type: WorldEntityType.LOCATION,
        name: entry.name,
        description: desc,
        properties: (entry.mechanics ?? {}) as Record<string, unknown>,
      });
      continue;
    }

    if (jsonType === 'item') {
      homebrew.push({
        type: 'item',
        name: entry.name,
        data: entry as Record<string, unknown>,
        tags,
        searchText: buildSearchText([entry.name, ...tags, desc]),
      });
      entities.push({
        type: WorldEntityType.ITEM,
        name: entry.name,
        description: desc,
        properties: (entry.mechanics ?? {}) as Record<string, unknown>,
      });
      continue;
    }

    if (jsonType === 'race') {
      homebrew.push({
        type: 'race',
        name: entry.name,
        data: entry as Record<string, unknown>,
        tags,
        searchText: buildSearchText([entry.name, ...tags, desc]),
      });
      continue;
    }

    if (jsonType === 'lore' && tagSet.has('pc')) {
      entities.push({
        type: WorldEntityType.PC,
        name: metadata.title,
        description: desc,
        properties: {},
      });
      break;
    }
  }

  return { filename, document, npcs, homebrew, entities };
}

// ─── Preview builder ─────────────────────────────────────────────────────────

export interface FilePreview {
  filename: string;
  title: string;
  slug: string;
  docType: string;
  npcCount: number;
  homebrewCount: number;
  entityCount: number;
  valid: boolean;
}

export function buildPreview(
  files: Array<{ filename: string; content: string }>,
): FilePreview[] {
  return files.map(({ filename, content }) => {
    const parsed = parseJsonFile(filename, content);
    if (!parsed) {
      return { filename, title: filename, slug: '', docType: '', npcCount: 0, homebrewCount: 0, entityCount: 0, valid: false };
    }
    return {
      filename,
      title: parsed.document.title,
      slug: parsed.document.slug,
      docType: parsed.document.type,
      npcCount: parsed.npcs.length,
      homebrewCount: parsed.homebrew.length,
      entityCount: parsed.entities.length,
      valid: true,
    };
  });
}
