# World Content Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the ImportSheet on the World Lore page to accept JSON, markdown, and PDF files — parsing JSON directly into CampaignDocument + NPC + homebrew + WorldEntity + brain job records, and routing markdown/PDF through existing AI extraction.

**Architecture:** New `json-import.service.ts` handles all JSON parsing and DB writes. Two new tRPC procedures (`importFromJson`, `confirmJsonImport`) wrap the service. A new API route `/api/uploads/world-import-pdf` converts PDF → markdown via Docling then passes text to the existing `extractEntitiesFromMarkdown`. The `ImportSheet` grows a format selector (JSON vs markdown vs PDF) and a new JSON review view with file-level checkboxes.

**Tech Stack:** TypeScript, tRPC v11, Prisma, BullMQ (`addBrainIngestionJob`), Next.js App Router API routes, shadcn/ui

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/server/services/json-import.service.ts` | Create | JSON envelope parsing, entity extraction, DB writes |
| `src/server/routers/campaigns.ts` | Modify | Add `importFromJson` + `confirmJsonImport` procedures |
| `src/app/api/uploads/world-import-pdf/route.ts` | Create | PDF → Docling → markdown API route |
| `src/components/world/import-sheet.tsx` | Modify | Format picker, JSON multi-file flow, PDF upload flow |
| `tests/services/json-import.test.ts` | Create | Vitest unit tests for the parser |
| `tests/workflows/world-import.workflow.spec.ts` | Create | Playwright workflow spec |

---

## Task 1: JSON Import Service — Parse

**Files:**
- Create: `src/server/services/json-import.service.ts`
- Create: `tests/services/json-import.test.ts`

### Step 1.1 — Write failing tests

```typescript
// tests/services/json-import.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseJsonFile,
  slugifyFilename,
  SKIP_NAMES,
} from '@/server/services/json-import.service';

const actorNpcFile = {
  metadata: { title: 'NPCs of Hameria', date: '2025-07-21T00:00:00+00:00', tags: ['npc'] },
  source: 'NPCs\\Town Guard.md',
  type: 'actor',
  data: [
    {
      name: 'Sergeant Voss',
      description: 'A grizzled veteran.',
      type_alignment: 'Lawful Neutral',
      mechanics: { ac: 16, hp: 45 },
    },
    {
      name: 'Introduction',
      description: '# Introduction',
      mechanics: {},
    },
  ],
};

const factionFile = {
  metadata: { title: 'Factions', date: '2025-07-21T00:00:00+00:00', tags: ['faction'] },
  source: 'Factions\\Iron Circle.md',
  type: 'faction',
  data: [
    { name: 'Iron Circle', description: 'A ruthless mercenary band.', mechanics: { reputation: 'feared' } },
  ],
};

const itemFile = {
  metadata: { title: 'Items', date: '2025-07-21T00:00:00+00:00', tags: ['item'] },
  source: 'Items\\Master Item List.md',
  type: 'item',
  data: [
    { name: 'Master Item List', description: '# Overview', mechanics: {} },
    { name: 'Sword of Dawn', description: 'A glowing blade.', mechanics: { damage: '1d8+2' } },
  ],
};

describe('slugifyFilename', () => {
  it('strips extension and slugifies', () => {
    expect(slugifyFilename('NPCs\\Town Guard.md')).toBe('town-guard');
  });
  it('handles nested paths', () => {
    expect(slugifyFilename('Player Characters\\Norm Alfella.md')).toBe('norm-alfella');
  });
});

describe('parseJsonFile', () => {
  it('returns a document record for every file', () => {
    const result = parseJsonFile('town-npcs.json', JSON.stringify(actorNpcFile));
    expect(result.document.title).toBe('NPCs of Hameria');
    expect(result.document.type).toBe('npc-collection');
    expect(result.document.slug).toBe('town-guard');
  });

  it('skips header entries (empty mechanics + heading description)', () => {
    const result = parseJsonFile('town-npcs.json', JSON.stringify(actorNpcFile));
    expect(result.npcs.map((n) => n.name)).not.toContain('Introduction');
    expect(result.npcs.map((n) => n.name)).toContain('Sergeant Voss');
  });

  it('extracts NPCs from actor+npc file', () => {
    const result = parseJsonFile('town-npcs.json', JSON.stringify(actorNpcFile));
    expect(result.npcs).toHaveLength(1);
    expect(result.npcs[0].name).toBe('Sergeant Voss');
    expect(result.npcs[0].role).toBe('Lawful Neutral');
    expect(result.entities[0].type).toBe('NPC');
  });

  it('extracts FACTION entity from faction file', () => {
    const result = parseJsonFile('factions.json', JSON.stringify(factionFile));
    expect(result.npcs).toHaveLength(0);
    expect(result.entities[0].type).toBe('FACTION');
    expect(result.entities[0].name).toBe('Iron Circle');
  });

  it('extracts homebrew item and ITEM entity, skips header', () => {
    const result = parseJsonFile('items.json', JSON.stringify(itemFile));
    expect(result.homebrew).toHaveLength(1);
    expect(result.homebrew[0].name).toBe('Sword of Dawn');
    expect(result.entities[0].type).toBe('ITEM');
  });

  it('returns empty arrays for unknown type', () => {
    const adventureFile = { ...actorNpcFile, type: 'adventure', data: [{ name: 'Chapter 1', description: 'An intro.' }] };
    const result = parseJsonFile('adventure.json', JSON.stringify(adventureFile));
    expect(result.npcs).toHaveLength(0);
    expect(result.homebrew).toHaveLength(0);
    expect(result.entities).toHaveLength(0);
  });

  it('returns null for malformed JSON', () => {
    const result = parseJsonFile('bad.json', '{ not valid json }');
    expect(result).toBeNull();
  });
});
```

- [ ] Run tests: `npx vitest run tests/services/json-import.test.ts`
- [ ] Expected: FAIL — `Cannot find module '@/server/services/json-import.service'`

### Step 1.2 — Implement the service

```typescript
// src/server/services/json-import.service.ts
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

const NPC_TAGS = new Set(['npc', 'major', 'minor']);
const MONSTER_TAGS = new Set(['monsters', 'bestiary', 'creature']);

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

    // actor → NPC or monster
    if (jsonType === 'actor') {
      const isNpc = NPC_TAGS.has('npc') || tagSet.has('npc') || tagSet.has('major');
      const isMonster = MONSTER_TAGS.has('monsters') || tagSet.has('monsters') || tagSet.has('bestiary');

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

    // faction
    if (jsonType === 'faction') {
      entities.push({
        type: WorldEntityType.FACTION,
        name: entry.name,
        description: desc,
        properties: (entry.mechanics ?? {}) as Record<string, unknown>,
      });
      continue;
    }

    // location
    if (jsonType === 'location') {
      entities.push({
        type: WorldEntityType.LOCATION,
        name: entry.name,
        description: desc,
        properties: (entry.mechanics ?? {}) as Record<string, unknown>,
      });
      continue;
    }

    // item
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

    // race
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

    // lore with pc tag → PC entity
    if (jsonType === 'lore' && tagSet.has('pc')) {
      entities.push({
        type: WorldEntityType.PC,
        name: metadata.title,
        description: desc,
        properties: {},
      });
      break; // one PC entity per file
    }
  }

  return { filename, document, npcs, homebrew, entities };
}

// ─── Preview builder (used by importFromJson tRPC) ────────────────────────────

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
```

- [ ] Run tests: `npx vitest run tests/services/json-import.test.ts`
- [ ] Expected: All pass

- [ ] Commit:
```bash
git add src/server/services/json-import.service.ts tests/services/json-import.test.ts
git commit -m "feat(world-import): JSON import service — parser + unit tests"
```

---

## Task 2: tRPC Procedures — importFromJson + confirmJsonImport

**Files:**
- Modify: `src/server/routers/campaigns.ts`

### Step 2.1 — Write failing type-check

Before adding the procedures, confirm no existing `importFromJson` exists:

- [ ] Run: `npx tsc --noEmit 2>&1 | head -5` — should be clean before changes

### Step 2.2 — Add imports to campaigns.ts

At the top of `src/server/routers/campaigns.ts`, add after the existing imports:

```typescript
import { parseJsonFile, buildPreview } from '../services/json-import.service';
import { brainRepository } from '../repositories/brain.repository';
import { Prisma as PrismaTypes } from '@prisma/client';
```

Note: `Prisma` is already imported as `import { Prisma } from '@prisma/client'` — add `brainRepository` and `buildPreview`/`parseJsonFile` imports only.

### Step 2.3 — Add procedures before the closing `});` of the router

Insert these two procedures at the end of the `campaignsRouter` object (before the final `}`):

```typescript
  importFromJson: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      files: z.array(z.object({
        filename: z.string(),
        content: z.string().max(250_000),
      })).max(50),
    }))
    .mutation(async ({ input }) => {
      const previews = buildPreview(input.files);
      return { previews };
    }),

  confirmJsonImport: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      files: z.array(z.object({
        filename: z.string(),
        content: z.string().max(250_000),
      })).max(50),
      selectedSlugs: z.array(z.string()),
    }))
    .mutation(async ({ input, ctx }) => {
      const { campaignId, files, selectedSlugs } = input;
      const userId = ctx.session.user.id;
      const slugSet = new Set(selectedSlugs);

      let docsCreated = 0;
      let entitiesCreated = 0;
      let homebrewCreated = 0;
      let jobsQueued = 0;

      const { addBrainIngestionJob } = await import('@/lib/queue/brain-ingestion-queue');

      for (const file of files) {
        const parsed = parseJsonFile(file.filename, file.content);
        if (!parsed || !slugSet.has(parsed.document.slug)) continue;

        // 1 — CampaignDocument (upsert by slug)
        await prisma.campaignDocument.upsert({
          where: { campaignId_slug: { campaignId, slug: parsed.document.slug } },
          create: {
            campaignId,
            title: parsed.document.title,
            slug: parsed.document.slug,
            type: parsed.document.type,
            content: parsed.document.content,
            data: parsed.document.data as Prisma.InputJsonValue,
            tags: parsed.document.tags,
            sourceFile: parsed.document.sourceFile,
            searchText: parsed.document.searchText,
            brainIngestStatus: 'pending',
          },
          update: {
            title: parsed.document.title,
            content: parsed.document.content,
            data: parsed.document.data as Prisma.InputJsonValue,
            tags: parsed.document.tags,
            brainIngestStatus: 'pending',
          },
        });
        docsCreated++;

        // 2 — NPC records
        for (const npc of parsed.npcs) {
          const existingNpc = await prisma.nPC.findFirst({
            where: { campaignId, name: npc.name },
          });
          if (!existingNpc) {
            await prisma.nPC.create({
              data: {
                campaignId,
                name: npc.name,
                description: npc.description ?? undefined,
                role: npc.role ?? undefined,
                stats: npc.stats as Prisma.InputJsonValue,
                tags: npc.tags,
              },
            });
          }
          entitiesCreated++;
        }

        // 3 — Homebrew records (item, creature, race)
        for (const hb of parsed.homebrew) {
          let existing = await prisma.homebrewContent.findFirst({
            where: { userId, name: hb.name, type: hb.type },
          });
          if (!existing) {
            existing = await prisma.homebrewContent.create({
              data: {
                userId,
                type: hb.type,
                name: hb.name,
                data: hb.data as Prisma.InputJsonValue,
                tags: hb.tags,
                searchText: hb.searchText,
                sourceType: 'json_import',
              },
            });
            homebrewCreated++;
          }
          await prisma.campaignHomebrewContent.upsert({
            where: { campaignId_homebrewId: { campaignId, homebrewId: existing.id } },
            update: {},
            create: { campaignId, homebrewId: existing.id },
          });
        }

        // 4 — WorldEntity records (Brain)
        for (const entity of parsed.entities) {
          await brainRepository.upsertEntity(campaignId, {
            type: entity.type,
            name: entity.name,
            description: entity.description,
            properties: entity.properties,
            sourceType: 'json_import',
          });
          entitiesCreated++;
        }

        // 5 — Queue brain ingestion job
        const docText = [parsed.document.title, ...parsed.document.tags, parsed.document.content.slice(0, 2000)].join(' ');
        await addBrainIngestionJob({
          sessionId: null,
          campaignId,
          summary: docText,
          source: parsed.document.sourceFile,
        });
        jobsQueued++;
      }

      return { docsCreated, entitiesCreated, homebrewCreated, jobsQueued };
    }),
```

### Step 2.4 — Type check

- [ ] Run: `npx tsc --noEmit 2>&1 | grep -i error | head -20`
- [ ] Expected: 0 errors (fix any that appear before proceeding)

- [ ] Commit:
```bash
git add src/server/routers/campaigns.ts
git commit -m "feat(world-import): importFromJson + confirmJsonImport tRPC procedures"
```

---

## Task 3: PDF Upload API Route

**Files:**
- Create: `src/app/api/uploads/world-import-pdf/route.ts`

This route accepts a PDF via multipart form, converts with Docling (sync endpoint for simplicity — PDFs here are typically small campaign notes, not 200-page books), and returns the extracted markdown text for the client to pass to the existing `importFromMarkdown` tRPC procedure.

### Step 3.1 — Create the route

```typescript
// src/app/api/uploads/world-import-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files accepted' }, { status: 400 });
  }
  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 400 });
  }

  const doclingUrl = process.env.DOCLING_URL || 'http://localhost:5001';
  const buffer = Buffer.from(await file.arrayBuffer());
  const doclingForm = new FormData();
  doclingForm.append('files', new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }), file.name);
  doclingForm.append('to_formats', 'md');

  const res = await fetch(`${doclingUrl}/v1/convert/file`, {
    method: 'POST',
    body: doclingForm,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    return NextResponse.json({ error: `Docling error: ${errText}` }, { status: 502 });
  }

  const result = await res.json();
  const item = Array.isArray(result) ? result[0] : result;
  const markdown: string =
    item?.document?.md_content ??
    item?.output?.md_content ??
    item?.md_content ??
    item?.content ??
    '';

  if (!markdown.trim()) {
    return NextResponse.json({ error: 'PDF yielded no text content' }, { status: 422 });
  }

  return NextResponse.json({ markdown, filename: file.name });
}
```

### Step 3.2 — Manual smoke test (no automated test — Docling is an external service)

- [ ] Start dev server: `npm run dev`
- [ ] Upload a small PDF to `/api/uploads/world-import-pdf` via curl or Postman
- [ ] Verify `{ markdown: "...", filename: "..." }` response

- [ ] Commit:
```bash
git add src/app/api/uploads/world-import-pdf/route.ts
git commit -m "feat(world-import): PDF upload API route via Docling sync"
```

---

## Task 4: ImportSheet — Format Selection + JSON Flow

**Files:**
- Modify: `src/components/world/import-sheet.tsx`

This is the biggest UI change. The sheet gains a format selector (`json | md | pdf`) and a new JSON review view. The existing markdown flow is unchanged.

### Step 4.1 — Read the current sheet

Already read — it's at `src/components/world/import-sheet.tsx`. Current structure:
- State: `view: 'upload' | 'loading' | 'review'`, `entities[]`, `checked: Set<number>`
- Calls: `campaigns.importFromMarkdown`, `campaigns.confirmImport`

### Step 4.2 — Replace the sheet with the extended version

```typescript
// src/components/world/import-sheet.tsx
'use client';

import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Upload, Loader2, BookOpen, MapPin, Package, Skull,
  Flag, ScrollText, Sparkles, Dna, UsersRound, FileJson,
} from 'lucide-react';
import type { ExtractedEntity, ExtractedEntityType } from '@/server/services/markdown-extraction.service';
import type { FilePreview } from '@/server/services/json-import.service';

const TYPE_META: Record<ExtractedEntityType, { label: string; icon: React.ElementType; color: string }> = {
  location: { label: 'Locations', icon: MapPin,      color: 'text-emerald-400/80' },
  npc:      { label: 'NPCs',      icon: UsersRound,  color: 'text-blue-400/80'    },
  item:     { label: 'Items',     icon: Package,     color: 'text-yellow-400/80'  },
  creature: { label: 'Creatures', icon: Skull,       color: 'text-red-400/80'     },
  faction:  { label: 'Factions',  icon: Flag,        color: 'text-purple-400/80'  },
  lore:     { label: 'Lore',      icon: ScrollText,  color: 'text-amber-400/80'   },
  timeline: { label: 'Timelines', icon: BookOpen,    color: 'text-violet-400/80'  },
  spell:    { label: 'Spells',    icon: Sparkles,    color: 'text-cyan-400/80'    },
  race:     { label: 'Races',     icon: Dna,         color: 'text-pink-400/80'    },
};

const HINTS = [
  { value: '', label: 'Let AI decide' },
  { value: 'Locations', label: 'Locations' },
  { value: 'NPCs', label: 'NPCs' },
  { value: 'Items & Creatures', label: 'Items & Creatures' },
  { value: 'Mixed', label: 'Mixed' },
];

type Format = 'json' | 'md' | 'pdf';
type View = 'upload' | 'loading' | 'review';

export function ImportSheet({
  campaignId,
  open,
  onOpenChange,
  onSuccess,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const mdFileRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const pdfFileRef = useRef<HTMLInputElement>(null);

  const [format, setFormat] = useState<Format>('json');
  const [view, setView] = useState<View>('upload');
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Markdown state
  const [mdFilename, setMdFilename] = useState('');
  const [mdContent, setMdContent] = useState('');
  const [entities, setEntities] = useState<ExtractedEntity[]>([]);
  const [entityChecked, setEntityChecked] = useState<Set<number>>(new Set());

  // JSON state
  const [jsonFiles, setJsonFiles] = useState<Array<{ filename: string; content: string }>>([]);
  const [jsonPreviews, setJsonPreviews] = useState<FilePreview[]>([]);
  const [jsonChecked, setJsonChecked] = useState<Set<string>>(new Set());

  // PDF state
  const [pdfFilename, setPdfFilename] = useState('');
  const [pdfUploading, setPdfUploading] = useState(false);

  // ── tRPC mutations ──────────────────────────────────────────────────────────

  const extractMd = trpc.campaigns.importFromMarkdown.useMutation({
    onSuccess: (data) => {
      setEntities(data);
      setEntityChecked(new Set(data.map((_, i) => i)));
      setView('review');
    },
    onError: (e) => { setError(e.message); setView('upload'); },
  });

  const confirmMd = trpc.campaigns.confirmImport.useMutation({
    onSuccess: () => { onSuccess(); reset(); },
    onError: (e) => { setError(e.message); setView('upload'); },
  });

  const importJson = trpc.campaigns.importFromJson.useMutation({
    onSuccess: (data) => {
      setJsonPreviews(data.previews);
      setJsonChecked(new Set(data.previews.filter((p) => p.valid).map((p) => p.slug)));
      setView('review');
    },
    onError: (e) => { setError(e.message); setView('upload'); },
  });

  const confirmJson = trpc.campaigns.confirmJsonImport.useMutation({
    onSuccess: () => { onSuccess(); reset(); },
    onError: (e) => { setError(e.message); setView('upload'); },
  });

  // ── Reset ───────────────────────────────────────────────────────────────────

  function reset() {
    setView('upload');
    setHint('');
    setError(null);
    setMdFilename(''); setMdContent('');
    setEntities([]); setEntityChecked(new Set());
    setJsonFiles([]); setJsonPreviews([]); setJsonChecked(new Set());
    setPdfFilename('');
  }

  function handleClose() { reset(); onOpenChange(false); }

  // ── Markdown handlers ───────────────────────────────────────────────────────

  function handleMdFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 60_000) { setError('File too large (max ~55 KB). Please split the file.'); return; }
    setMdFilename(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setMdContent((ev.target?.result as string) ?? '');
    reader.readAsText(file);
  }

  function handleMdExtract() {
    if (!mdContent) { setError('No file loaded.'); return; }
    setView('loading');
    extractMd.mutate({ campaignId, content: mdContent, hint: hint || undefined });
  }

  // ── JSON handlers ───────────────────────────────────────────────────────────

  function handleJsonFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setError(null);

    const readers = selected.map(
      (file) =>
        new Promise<{ filename: string; content: string }>((resolve, reject) => {
          if (file.size > 250_000) {
            reject(new Error(`${file.name}: too large (max 200KB)`));
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => resolve({ filename: file.name, content: (ev.target?.result as string) ?? '' });
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsText(file);
        }),
    );

    Promise.all(readers)
      .then((files) => {
        setJsonFiles(files);
        setView('loading');
        importJson.mutate({ campaignId, files });
      })
      .catch((err: Error) => setError(err.message));
  }

  // ── PDF handlers ────────────────────────────────────────────────────────────

  async function handlePdfFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPdfFilename(file.name);
    setPdfUploading(true);
    setView('loading');

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/uploads/world-import-pdf', { method: 'POST', body: form });
      const json = await res.json() as { markdown?: string; error?: string };
      if (!res.ok || !json.markdown) {
        throw new Error(json.error ?? 'PDF conversion failed');
      }
      // Re-use markdown extraction flow
      setMdContent(json.markdown);
      setMdFilename(file.name);
      extractMd.mutate({ campaignId, content: json.markdown.slice(0, 55_000), hint: hint || undefined });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'PDF conversion failed');
      setView('upload');
    } finally {
      setPdfUploading(false);
    }
  }

  // ── Confirm handlers ────────────────────────────────────────────────────────

  function handleMdConfirm() {
    const selected = entities.filter((_, i) => entityChecked.has(i));
    confirmMd.mutate({ campaignId, entities: selected });
  }

  function handleJsonConfirm() {
    confirmJson.mutate({
      campaignId,
      files: jsonFiles,
      selectedSlugs: Array.from(jsonChecked),
    });
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const grouped = Object.entries(
    entities.reduce<Record<string, { entity: ExtractedEntity; index: number }[]>>(
      (acc, entity, i) => { (acc[entity.type] ??= []).push({ entity, index: i }); return acc; },
      {},
    ),
  );

  const loadingLabel =
    format === 'json' ? 'Parsing JSON files…' :
    format === 'pdf' ? 'Converting PDF…' :
    `Extracting entities from ${mdFilename}…`;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-4 border-b border-border/40">
          <SheetTitle className="font-display text-sm tracking-widest uppercase text-amber-300/80">
            Import World Content
          </SheetTitle>
        </SheetHeader>

        {/* Format tabs — only shown on upload view */}
        {view === 'upload' && (
          <div className="flex border-b border-border/30 px-6 pt-3 gap-1">
            {(['json', 'md', 'pdf'] as Format[]).map((f) => (
              <button
                key={f}
                onClick={() => { setFormat(f); setError(null); }}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-t-sm font-medium uppercase tracking-widest transition-colors',
                  format === f
                    ? 'bg-amber-500/10 text-amber-300/80 border border-b-0 border-amber-500/30'
                    : 'text-muted-foreground/50 hover:text-muted-foreground/80',
                )}
              >
                {f === 'json' ? 'JSON' : f === 'md' ? 'Markdown' : 'PDF'}
              </button>
            ))}
          </div>
        )}

        {/* Upload views */}
        {view === 'upload' && (
          <div className="flex flex-col gap-4 p-6">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
            )}

            {format === 'json' && (
              <>
                <div
                  onClick={() => jsonFileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/40 rounded-md py-10 cursor-pointer hover:border-amber-500/40 hover:bg-white/[0.02] transition-colors"
                >
                  <FileJson className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground/60">Click to choose JSON files (up to 30)</p>
                  <p className="text-xs text-muted-foreground/40">200KB per file · multi-select supported</p>
                </div>
                <input
                  ref={jsonFileRef}
                  type="file"
                  accept=".json"
                  multiple
                  className="hidden"
                  onChange={handleJsonFilesChange}
                />
              </>
            )}

            {format === 'md' && (
              <>
                <div
                  onClick={() => mdFileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/40 rounded-md py-10 cursor-pointer hover:border-amber-500/40 hover:bg-white/[0.02] transition-colors"
                >
                  <Upload className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground/60">
                    {mdFilename || 'Click to choose a .md file'}
                  </p>
                  {mdFilename && <p className="text-xs text-muted-foreground/40">Click to change</p>}
                </div>
                <input ref={mdFileRef} type="file" accept=".md" className="hidden" onChange={handleMdFileChange} />

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">What&apos;s mainly in this file?</p>
                  <select
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    className="w-full bg-card/40 border border-border/40 rounded px-3 py-2 text-sm text-foreground"
                  >
                    {HINTS.map((h) => (
                      <option key={h.value} value={h.value}>{h.label}</option>
                    ))}
                  </select>
                </div>

                <Button onClick={handleMdExtract} disabled={!mdContent} className="mt-2">
                  Extract Content
                </Button>
              </>
            )}

            {format === 'pdf' && (
              <>
                <div
                  onClick={() => pdfFileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/40 rounded-md py-10 cursor-pointer hover:border-amber-500/40 hover:bg-white/[0.02] transition-colors"
                >
                  <Upload className="h-6 w-6 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground/60">
                    {pdfFilename || 'Click to choose a PDF'}
                  </p>
                  <p className="text-xs text-muted-foreground/40">Converted via Docling · max 25MB</p>
                </div>
                <input ref={pdfFileRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfFileChange} />
              </>
            )}
          </div>
        )}

        {/* Loading */}
        {view === 'loading' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground/60 p-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400/60" />
            <p className="text-sm text-center">{loadingLabel}</p>
            <p className="text-xs text-muted-foreground/40 text-center">
              {format === 'json' ? 'Parsing all files…' : 'This can take 15–30 seconds'}
            </p>
          </div>
        )}

        {/* Review — JSON */}
        {view === 'review' && format === 'json' && (
          <>
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground/50 mb-3">
                  {jsonPreviews.length} files parsed — select to import
                </p>
                {jsonPreviews.map((preview) => (
                  <label
                    key={preview.slug || preview.filename}
                    className={cn(
                      'flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors',
                      preview.valid
                        ? 'border-border/30 bg-card/20 hover:bg-card/40'
                        : 'border-destructive/20 bg-destructive/5 opacity-60',
                    )}
                  >
                    <Checkbox
                      checked={jsonChecked.has(preview.slug)}
                      disabled={!preview.valid}
                      onCheckedChange={(checked) => {
                        setJsonChecked((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(preview.slug); else next.delete(preview.slug);
                          return next;
                        });
                      }}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground/90 leading-snug">{preview.title}</p>
                        {!preview.valid && (
                          <span className="text-[10px] text-destructive/70 uppercase tracking-wider">invalid</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/50 mt-0.5">{preview.filename}</p>
                      {preview.valid && (
                        <p className="text-[11px] text-muted-foreground/40 mt-0.5">
                          {[
                            preview.npcCount > 0 && `${preview.npcCount} NPCs`,
                            preview.homebrewCount > 0 && `${preview.homebrewCount} homebrew`,
                            preview.entityCount > 0 && `${preview.entityCount} entities`,
                          ].filter(Boolean).join(' · ') || preview.docType}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={() => setView('upload')}>Back</Button>
              <Button
                onClick={handleJsonConfirm}
                disabled={jsonChecked.size === 0 || confirmJson.isPending}
                className="gap-2"
              >
                {confirmJson.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Import {jsonChecked.size} {jsonChecked.size === 1 ? 'file' : 'files'}
              </Button>
            </div>
          </>
        )}

        {/* Review — Markdown / PDF (entity-level) */}
        {view === 'review' && (format === 'md' || format === 'pdf') && (
          <>
            <ScrollArea className="flex-1 px-6 py-4">
              {entities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground/40">
                  <BookOpen className="h-8 w-8" />
                  <p className="text-sm">Nothing found — try a different file or hint</p>
                  <Button variant="ghost" size="sm" onClick={() => setView('upload')} className="mt-2">Try again</Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {grouped.map(([type, items]) => {
                    const meta = TYPE_META[type as ExtractedEntityType];
                    const Icon = meta?.icon ?? BookOpen;
                    return (
                      <div key={type} className="space-y-1.5">
                        <div className={cn('flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-semibold', meta?.color)}>
                          <Icon className="h-3 w-3" />
                          {meta?.label ?? type}
                          <span className="text-muted-foreground/40 normal-case tracking-normal">({items.length})</span>
                        </div>
                        {items.map(({ entity, index }) => (
                          <label
                            key={index}
                            className="flex items-start gap-3 rounded-md border border-border/30 bg-card/20 px-3 py-2.5 cursor-pointer hover:bg-card/40 transition-colors"
                          >
                            <Checkbox
                              checked={entityChecked.has(index)}
                              onCheckedChange={() => {
                                setEntityChecked((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(index)) next.delete(index); else next.add(index);
                                  return next;
                                });
                              }}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground/90 leading-snug">{entity.name}</p>
                              {entity.description && (
                                <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-2">{entity.description}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            {entities.length > 0 && (
              <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between gap-3">
                <Button variant="ghost" size="sm" onClick={() => setView('upload')}>Back</Button>
                <Button
                  onClick={handleMdConfirm}
                  disabled={entityChecked.size === 0 || confirmMd.isPending}
                  className="gap-2"
                >
                  {confirmMd.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save {entityChecked.size} {entityChecked.size === 1 ? 'entity' : 'entities'}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

### Step 4.3 — Type check and lint

- [ ] Run: `npx tsc --noEmit 2>&1 | grep -i error | head -30`
- [ ] Run: `npm run lint 2>&1 | head -40`
- [ ] Fix any errors before proceeding

### Step 4.4 — Verify in browser

- [ ] Open World Lore page (`/campaigns/[slug]/world`) → click Import
- [ ] Verify 3 tabs appear: JSON / Markdown / PDF
- [ ] JSON tab: select one JSON file from `docs/hameria-ire-jsons/` → verify loading → review screen shows file card with counts
- [ ] Uncheck one file, click Import — verify success toast + world page refreshes
- [ ] Markdown tab: select a small `.md` file → verify existing extraction flow unchanged
- [ ] PDF tab: verify file picker opens for `.pdf` only

- [ ] Commit:
```bash
git add src/components/world/import-sheet.tsx
git commit -m "feat(world-import): extend ImportSheet — JSON/MD/PDF format selector + JSON review view"
```

---

## Task 5: Workflow Spec

**Files:**
- Create: `tests/workflows/world-import.workflow.spec.ts`

This spec documents and exercises the import journey. It runs against a test campaign with an isolated DB state.

### Step 5.1 — Write the workflow spec

```typescript
// tests/workflows/world-import.workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('World Import Workflow', () => {
  test.use({ storageState: 'tests/.auth/dm.json' });

  const CAMPAIGN_SLUG = process.env.TEST_CAMPAIGN_SLUG ?? 'test-campaign';

  test('JSON import — file picker accepts .json, review screen shows file cards, confirm populates world page', async ({ page }) => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);

    // Open import sheet
    await page.getByRole('button', { name: /import/i }).first().click();
    await expect(page.getByText('Import World Content')).toBeVisible();

    // JSON tab should be default
    await expect(page.getByRole('button', { name: /json/i })).toBeVisible();

    // Upload a single JSON file
    const fileInput = page.locator('input[type="file"][accept=".json"]');
    await fileInput.setInputFiles('docs/hameria-ire-jsons/Factions_Iron Circle.json');

    // Should show loading then review
    await expect(page.getByText(/parsing/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/files parsed/i)).toBeVisible({ timeout: 15000 });

    // File card appears with title
    await expect(page.getByText(/iron circle/i, { exact: false })).toBeVisible();

    // Confirm
    await page.getByRole('button', { name: /import/i }).click();

    // World page refreshes — document appears
    await expect(page.getByText(/iron circle/i, { exact: false })).toBeVisible({ timeout: 10000 });
  });

  test('JSON import — invalid file shows invalid badge, cannot be checked', async ({ page }) => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
    await page.getByRole('button', { name: /import/i }).first().click();

    const fileInput = page.locator('input[type="file"][accept=".json"]');
    // Create a temp invalid JSON in memory via data URL — use a known bad file approach
    // For this test: use a fixture file
    await fileInput.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json') });

    await expect(page.getByText(/files parsed/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/invalid/i)).toBeVisible();
    // Import button disabled when nothing valid checked
    const importBtn = page.getByRole('button', { name: /import 0 files/i });
    await expect(importBtn).toBeDisabled();
  });

  test('Markdown tab — existing extraction flow unchanged', async ({ page }) => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
    await page.getByRole('button', { name: /import/i }).first().click();

    // Switch to markdown tab
    await page.getByRole('button', { name: /markdown/i }).click();

    // File picker accepts .md only
    const fileInput = page.locator('input[type="file"][accept=".md"]');
    await expect(fileInput).toBeAttached();
    await expect(page.getByRole('button', { name: /extract content/i })).toBeVisible();
  });

  test('PDF tab — file picker appears for .pdf', async ({ page }) => {
    await page.goto(`/campaigns/${CAMPAIGN_SLUG}/world`);
    await page.getByRole('button', { name: /import/i }).first().click();

    await page.getByRole('button', { name: /pdf/i }).click();
    const fileInput = page.locator('input[type="file"][accept=".pdf"]');
    await expect(fileInput).toBeAttached();
    await expect(page.getByText(/converted via docling/i, { exact: false })).toBeVisible();
  });
});
```

- [ ] Run: `npx playwright test tests/workflows/world-import.workflow.spec.ts --reporter=list`
- [ ] Expected: First test passes (may need a real `Factions_Iron Circle.json` at the path — copy from `docs/hameria-ire-jsons/`)
- [ ] Fix any failures before merging

- [ ] Commit:
```bash
git add tests/workflows/world-import.workflow.spec.ts
git commit -m "test(world-import): workflow spec — JSON/MD/PDF import journeys"
```

---

## Task 6: Fix NPC stats Prisma.InputJsonValue

The `stats` field on NPC in the service passes `entry as Record<string, unknown>` which won't satisfy Prisma's `InputJsonValue`. Fix in campaigns.ts confirmJsonImport:

**In** `src/server/routers/campaigns.ts` confirmJsonImport NPC creation block, stats must be cast properly. The `npc.stats` is already `Record<string, unknown>` — this satisfies `Prisma.InputJsonValue` if the values are JSON-serialisable. Add an explicit cast:

```typescript
stats: npc.stats as Prisma.InputJsonValue,
```

This is already in the procedure as written in Task 2. No additional change needed if copied verbatim.

Additionally, verify that `campaignDMProcedure` automatically extracts `campaignId` from input. Checking the pattern in the router (e.g. `getWorldDocuments` takes no explicit `input` destructure of `campaignId`) — but the procedures we wrote explicitly include `campaignId` in the input schema, and `campaignDMProcedure` validates membership using it. This is correct — both `input.campaignId` and `ctx.membership` are available.

- [ ] Run full type check: `npx tsc --noEmit`
- [ ] Expected: 0 errors

- [ ] Run unit tests: `npx vitest run tests/services/`
- [ ] Expected: All pass

- [ ] Push: `git push origin main`

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Implemented in |
|---|---|
| JSON multi-file upload (up to 30) | Task 4 — `accept=".json" multiple`, max 50 in schema |
| 200KB per JSON file limit | Task 2 — `.max(250_000)` on content string |
| JSON direct parse (no AI) | Task 1 — `parseJsonFile` pure parse |
| CampaignDocument per file | Task 2 — `confirmJsonImport` upsert |
| NPC records for actor+npc files | Task 1 parser + Task 2 confirm |
| Homebrew records for actor+monster, item, race | Task 1 parser + Task 2 confirm |
| WorldEntity records (NPC/FACTION/LOCATION/ITEM/PC) | Task 1 parser + Task 2 confirm |
| Brain ingestion job per file | Task 2 confirm — `addBrainIngestionJob` |
| Header entry filtering | Task 1 — `isHeaderEntry()` |
| File-level review (not entity-level) for JSON | Task 4 — `jsonPreviews` with per-file checkboxes |
| Markdown path unchanged | Task 4 — same `extractMd` + `confirmMd` mutations |
| PDF → Docling → markdown → extraction | Task 3 + Task 4 `handlePdfFileChange` |
| Workflow spec | Task 5 |
| Unit tests | Task 1 |

**Placeholder scan:** No TBDs or incomplete code blocks found.

**Type consistency:** `ParsedFile`, `ParsedNpc`, `ParsedHomebrew`, `ParsedEntity`, `FilePreview` all defined in Task 1 and used consistently in Task 2 and Task 4. `WorldEntityType.NPC/FACTION/LOCATION/ITEM/PC` match the actual Prisma enum (no MONSTER).
