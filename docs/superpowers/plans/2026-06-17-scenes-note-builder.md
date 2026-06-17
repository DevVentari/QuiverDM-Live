# Scenes Note Builder (Layer 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a Scene into a DM **note builder** — a flexible, typed list of notes (read-aloud / tactic / secret / check / lore / trigger) assembled with invisible AI (auto-fill, ghost suggestions, inline refine, "what am I forgetting?"), with prep context **woven from the DM Brain** (entity `WorldStateChange` history + character bonds).

**Architecture:** New `SceneNote` model owned by `Scene`. A new AI module `scene-notes.ts` (Claude-first via the provider chain, never `forceProvider`) produces validated note drafts/ghosts. `gatherSceneContext` is extended to pull Brain history + character bonds. The `scenes` router gains note CRUD/reorder + AI actions; `scenes.generate` seeds notes on create. The scene UI surface becomes a `NoteBoard` (replacing the audience-split `SceneStage`); `Scene.description` is kept as a denormalised mirror of the primary read-aloud so the player/play bridge is untouched.

**Tech Stack:** Next.js 15 App Router, tRPC v11 + Zod, Prisma/PostgreSQL, `chatWithAI` multi-provider, Framer Motion, Playwright.

**Source spec:** `docs/superpowers/specs/2026-06-17-scenes-note-builder-design.md`

---

## File Structure

**Create:**
- `src/lib/ai/scene-notes.ts` — AI note functions (seed/draft/suggest/refine) + Zod
- `src/lib/ai/__tests__/scene-notes.test.ts`
- `scripts/backfill-scene-notes.ts` — one-time content→notes backfill
- `src/components/scenes/NoteBoard.tsx` — the note-builder surface (board + AI wiring)
- `src/components/scenes/NoteCard.tsx` — a single typed note (display + inline edit/refine)
- `src/components/scenes/note-constants.ts` — note types, labels, tints (client)
- `tests/workflows/scene-notes.workflow.spec.ts`

**Modify:**
- `prisma/schema.prisma` — `SceneNote` model; `Scene.act`, `Scene.notes`
- `src/lib/ai/generate-scene.ts` — extend `SceneContext` with weave fields
- `src/server/services/scene-generation.service.ts` — `gatherSceneContext` pulls Brain + bonds; `primaryReadAloud` mirror helper
- `src/server/routers/scenes.ts` — `getStage` returns notes; `sceneNotes.*` CRUD + AI; `generate` seeds notes
- `src/app/v3/campaigns/[slug]/scenes/page.tsx` — scene surface = `NoteBoard`

**Reuse unchanged:** `SceneCreateForm` (the compose/entry step), `SceneLoading`, `scene-types.ts`.

---

## Task 1: `SceneNote` model + `Scene.act`/`notes`

**Files:**
- Modify: `prisma/schema.prisma` (Scene model ~1009; add `SceneNote` model)
- Create (scratch, delete after): `scripts/sql/2026-06-17-scene-notes.sql`

- [ ] **Step 1: Add `act` + `notes` to the `Scene` model.** After the `imageJobId` line (added previously):

```prisma
  imageJobId      String?
  act             String?  // optional grouping label, e.g. "Redbrand Hideout"
  notes           SceneNote[]
```

- [ ] **Step 2: Add the `SceneNote` model** right after the `Scene` model's closing brace:

```prisma
model SceneNote {
  id         String   @id @default(cuid())
  sceneId    String
  scene      Scene    @relation(fields: [sceneId], references: [id], onDelete: Cascade)
  type       String   // read_aloud | tactic | secret | check | lore | trigger
  title      String?
  body       String   @db.Text
  data       Json? // check {skill,dc}; trigger {condition, dc?:{skill,dc}, reveal?}
  orderIndex Int      @default(0)
  source     String   @default("manual") // manual | ai | ai_suggested
  mapPinId   String? // Layer 3 boundary (unused now)
  stateRule  Json? // Layer 3 boundary (unused now)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([sceneId])
}
```

- [ ] **Step 3: Write the migration SQL** to `scripts/sql/2026-06-17-scene-notes.sql`:

```sql
ALTER TABLE "Scene" ADD COLUMN "act" TEXT;
CREATE TABLE "SceneNote" (
  "id" TEXT NOT NULL,
  "sceneId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "data" JSONB,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "mapPinId" TEXT,
  "stateRule" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SceneNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SceneNote_sceneId_idx" ON "SceneNote"("sceneId");
ALTER TABLE "SceneNote" ADD CONSTRAINT "SceneNote_sceneId_fkey"
  FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Apply to the homelab DB.** `.env` points at the live homelab DB (confirmed in a prior task):

Run:
```bash
npx prisma db execute --url "$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" --file scripts/sql/2026-06-17-scene-notes.sql
```
Expected: `Script executed successfully.` If a relation/column "already exists", report DONE_WITH_CONCERNS noting which.

- [ ] **Step 5: Regenerate client + typecheck.**

Run: `npx prisma generate && npx tsc --noEmit`
Expected: clean (no new errors).

- [ ] **Step 6: Delete scratch SQL and commit.**

```bash
rm scripts/sql/2026-06-17-scene-notes.sql
git add prisma/schema.prisma
git commit -m "feat(scenes): SceneNote model + Scene.act (note builder foundation)"
```

---

## Task 2: Backfill existing scene content → notes

**Files:**
- Create: `scripts/backfill-scene-notes.ts`

- [ ] **Step 1: Write the backfill** `scripts/backfill-scene-notes.ts`. Idempotent: only scenes with `generatedAt` set and **no** existing notes; converts the old fixed fields into notes.

```ts
import 'dotenv/config';
import { prisma } from '@/lib/prisma';

type Check = { skill: string; dc: number; note: string };
type Beat = { wantsInScene: string; secret: string | null };

async function main() {
  const scenes = await prisma.scene.findMany({
    where: { generatedAt: { not: null }, notes: { none: {} } },
    select: { id: true, description: true, dmNotes: true, suggestedChecks: true, entityBeats: true },
  });
  console.log(`[backfill] ${scenes.length} generated scenes without notes`);

  for (const s of scenes) {
    const rows: { type: string; body: string; data?: unknown; orderIndex: number; source: string }[] = [];
    let i = 0;
    if (s.description?.trim()) rows.push({ type: 'read_aloud', body: s.description.trim(), orderIndex: i++, source: 'ai' });
    if (s.dmNotes?.trim()) rows.push({ type: 'lore', body: s.dmNotes.trim(), orderIndex: i++, source: 'ai' });
    for (const c of (s.suggestedChecks as Check[] | null) ?? []) {
      rows.push({ type: 'check', body: c.note, data: { skill: c.skill, dc: c.dc }, orderIndex: i++, source: 'ai' });
    }
    const beats = (s.entityBeats as Record<string, Beat> | null) ?? {};
    for (const [, b] of Object.entries(beats)) {
      if (b.wantsInScene) rows.push({ type: 'tactic', body: b.wantsInScene, orderIndex: i++, source: 'ai' });
      if (b.secret) rows.push({ type: 'secret', body: b.secret, orderIndex: i++, source: 'ai' });
    }
    if (rows.length === 0) continue;
    await prisma.sceneNote.createMany({ data: rows.map((r) => ({ ...r, sceneId: s.id, data: (r.data ?? undefined) as never })) });
    console.log(`[backfill] scene ${s.id}: +${rows.length} notes`);
  }
  console.log('[backfill] done');
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it.**

Run: `npx tsx scripts/backfill-scene-notes.ts`
Expected: prints a count and per-scene note additions, ends `[backfill] done`. (Few/zero on a fresh branch — that's fine; idempotent on re-run: 0 the second time.)

- [ ] **Step 3: Verify idempotency** — run again, expect `0 generated scenes without notes`.

- [ ] **Step 4: Commit.**

```bash
git add scripts/backfill-scene-notes.ts
git commit -m "feat(scenes): idempotent backfill of legacy scene content into notes"
```

---

## Task 3: Extend `SceneContext` with weave fields

**Files:**
- Modify: `src/lib/ai/generate-scene.ts` (the `SceneContext` interface)

- [ ] **Step 1: Add optional weave fields** to `SceneContext` in `src/lib/ai/generate-scene.ts`. Change the `tagged` and `party` entry shapes:

```ts
export interface SceneContext {
  intent: string;
  mood?: SceneType;
  tagged: Array<{
    id: string; name: string; type: string;
    description?: string; statSummary?: string;
    history?: string[]; // recent WorldStateChange triggerText lines (Brain weave)
  }>;
  party: Array<{ name: string; summary: string; hook?: string }>; // hook = a bond/flaw line
  campaignName?: string;
}
```

- [ ] **Step 2: Typecheck.**

Run: `npx tsc --noEmit`
Expected: clean (fields are optional; existing `gatherSceneContext` still compiles).

- [ ] **Step 3: Commit.**

```bash
git add src/lib/ai/generate-scene.ts
git commit -m "feat(scenes): SceneContext gains Brain-weave fields (history, hook)"
```

---

## Task 4: `gatherSceneContext` weaves the Brain + bonds; `primaryReadAloud` mirror helper

**Files:**
- Modify: `src/server/services/scene-generation.service.ts`
- Test: `src/server/services/__tests__/scene-generation.service.test.ts`

- [ ] **Step 1: Write a failing test** for the pure mirror helper. Append to `src/server/services/__tests__/scene-generation.service.test.ts`:

```ts
import { primaryReadAloud } from '../scene-generation.service';

describe('primaryReadAloud', () => {
  it('returns the lowest-orderIndex read_aloud body, ties by createdAt', () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    const t1 = new Date('2026-01-02T00:00:00Z');
    const notes = [
      { type: 'tactic', body: 'T', orderIndex: 0, createdAt: t0 },
      { type: 'read_aloud', body: 'second', orderIndex: 2, createdAt: t0 },
      { type: 'read_aloud', body: 'first', orderIndex: 1, createdAt: t1 },
    ];
    expect(primaryReadAloud(notes)).toBe('first');
  });
  it('returns null when there is no read_aloud', () => {
    expect(primaryReadAloud([{ type: 'tactic', body: 'x', orderIndex: 0, createdAt: new Date(0) }])).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — confirm fail** (`primaryReadAloud` not exported).

Run: `npx vitest run src/server/services/__tests__/scene-generation.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `src/server/services/scene-generation.service.ts`, add the helper and extend `gatherSceneContext`. Add the helper:

```ts
/** The body of the scene's primary read-aloud: lowest orderIndex, ties by createdAt. */
export function primaryReadAloud(
  notes: Array<{ type: string; body: string; orderIndex: number; createdAt: Date }>,
): string | null {
  const ra = notes
    .filter((n) => n.type === 'read_aloud')
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.getTime() - b.createdAt.getTime());
  return ra[0]?.body ?? null;
}
```

Then extend the entity + party loading in `gatherSceneContext`. Replace the `entities`/`party` `Promise.all` block so it also pulls Brain history + bonds:

```ts
  const [campaign, entities, party, changes] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId }, select: { name: true } }),
    input.linkedEntityIds.length
      ? prisma.worldEntity.findMany({
          where: { id: { in: input.linkedEntityIds }, campaignId },
          select: { id: true, name: true, type: true, description: true, statBlock: { select: { name: true, data: true } } },
        })
      : Promise.resolve([]),
    input.partyPresentIds.length
      ? prisma.character.findMany({
          where: { id: { in: input.partyPresentIds }, campaignCharacters: { some: { campaignId } } },
          select: { id: true, name: true, race: true, class: true, level: true, bonds: true, flaws: true },
        })
      : Promise.resolve([]),
    input.linkedEntityIds.length
      ? prisma.worldStateChange.findMany({
          where: { entityId: { in: input.linkedEntityIds }, campaignId, triggerText: { not: null } },
          select: { entityId: true, triggerText: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 40,
        })
      : Promise.resolve([]),
  ]);

  const historyByEntity = new Map<string, string[]>();
  for (const c of changes) {
    if (!c.entityId || !c.triggerText) continue;
    const arr = historyByEntity.get(c.entityId) ?? [];
    if (arr.length < 4) { arr.push(c.triggerText); historyByEntity.set(c.entityId, arr); }
  }

  return {
    intent: input.intent,
    mood: input.mood,
    campaignName: campaign?.name,
    tagged: entities.map((e) => ({
      id: e.id,
      name: e.name,
      type: String(e.type),
      description: e.description ?? undefined,
      statSummary: e.statBlock ? statSummary(e.statBlock.data) : undefined,
      history: historyByEntity.get(e.id),
    })),
    party: party.map((c) => ({
      name: c.name,
      summary: [c.race, c.class, c.level != null ? `lvl ${c.level}` : null].filter(Boolean).join(' '),
      hook: c.bonds?.trim() || c.flaws?.trim() || undefined,
    })),
  };
```

(Keep the existing `statSummary` helper and `applyRegeneration` unchanged.)

- [ ] **Step 4: Run tests + typecheck.**

Run: `npx vitest run src/server/services/__tests__/scene-generation.service.test.ts && npx tsc --noEmit`
Expected: all pass; tsc clean.

- [ ] **Step 5: Commit.**

```bash
git add src/server/services/scene-generation.service.ts src/server/services/__tests__/scene-generation.service.test.ts
git commit -m "feat(scenes): weave Brain history + character bonds into scene context"
```

---

## Task 5: `scene-notes.ts` AI service

**Files:**
- Create: `src/lib/ai/scene-notes.ts`
- Test: `src/lib/ai/__tests__/scene-notes.test.ts`

- [ ] **Step 1: Write the failing test** `src/lib/ai/__tests__/scene-notes.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedSceneNotes, draftNote, suggestNotes, refineNote, type NoteContext } from '../scene-notes';
import * as chat from '../chat';

const CTX: NoteContext = {
  intent: 'Party reaches Glasstaff’s lair.',
  tagged: [{ id: 'e1', name: 'Glasstaff', type: 'NPC', history: ['Fled the cellar last session'] }],
  party: [{ name: 'Tharivol', summary: 'Elf wizard', hook: 'Hunts the Redbrands who killed his sister' }],
};

beforeEach(() => vi.restoreAllMocks());

describe('scene-notes AI', () => {
  it('seedSceneNotes returns validated notes', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue(JSON.stringify({ notes: [
      { type: 'read_aloud', body: 'Candlelight gutters…' },
      { type: 'check', body: 'Spot the trapdoor', data: { skill: 'Perception', dc: 15 } },
      { type: 'trigger', body: 'If they pick the lock', data: { condition: 'pick the lock', dc: { skill: 'Thieves’ Tools', dc: 15 }, reveal: 'A click — the door swings.' } },
    ] }));
    const notes = await seedSceneNotes(CTX);
    expect(notes).toHaveLength(3);
    expect(notes[1].data).toMatchObject({ skill: 'Perception', dc: 15 });
  });

  it('does not pin a provider (fallback allowed)', async () => {
    const spy = vi.spyOn(chat, 'chatWithAI').mockResolvedValue('{"notes":[]}');
    await seedSceneNotes(CTX);
    expect((spy.mock.calls[0]?.[1] ?? {}).forceProvider).toBeUndefined();
  });

  it('draftNote returns one note of the asked type', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue(JSON.stringify({ type: 'tactic', body: 'Attacks only who it tracks' }));
    const n = await draftNote(CTX, 'tactic');
    expect(n.type).toBe('tactic');
    expect(n.body).toMatch(/tracks/);
  });

  it('suggestNotes returns ghost candidates', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue(JSON.stringify({ notes: [{ type: 'secret', body: 'Trapdoor escape' }] }));
    const ghosts = await suggestNotes(CTX, []);
    expect(ghosts[0].type).toBe('secret');
  });

  it('refineNote returns rewritten prose', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue('Colder, sharper line.');
    const out = await refineNote('A warm line.', 'colder');
    expect(out).toBe('Colder, sharper line.');
  });

  it('throws readable error on malformed seed output', async () => {
    vi.spyOn(chat, 'chatWithAI').mockResolvedValue('not json');
    await expect(seedSceneNotes(CTX)).rejects.toThrow(/could not be read/i);
  });
});
```

- [ ] **Step 2: Run — confirm fail** (module missing).

Run: `npx vitest run src/lib/ai/__tests__/scene-notes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** `src/lib/ai/scene-notes.ts`:

```ts
/**
 * AI note functions for the scene note builder. Invisible-AI: seed an initial
 * note set, draft one note, suggest "ghost" notes, refine prose inline. Uses
 * chatWithAI Claude-first via the provider chain — never forceProvider, so a
 * Claude outage falls back. Mirrors the defensive parse of generate-statblock.ts.
 */
import { z } from 'zod';
import { chatWithAI, type ChatMessage } from './chat';
import type { SceneContext } from './generate-scene';

export type NoteContext = SceneContext;
export type NoteType = 'read_aloud' | 'tactic' | 'secret' | 'check' | 'lore' | 'trigger';

const noteSchema = z.object({
  type: z.enum(['read_aloud', 'tactic', 'secret', 'check', 'lore', 'trigger']),
  title: z.string().max(120).optional(),
  body: z.string().min(1).max(2000),
  data: z
    .union([
      z.object({ skill: z.string().max(40), dc: z.number().int().min(1).max(30) }),
      z.object({
        condition: z.string().max(300),
        dc: z.object({ skill: z.string().max(40), dc: z.number().int().min(1).max(30) }).nullish(),
        reveal: z.string().max(600).nullish(),
      }),
    ])
    .nullish(),
});
export type NoteDraft = z.infer<typeof noteSchema>;
const notesSchema = z.object({ notes: z.array(noteSchema).max(12) });

function extractJson(raw: string): unknown {
  const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('nothing usable');
  return JSON.parse(match[0]);
}

function contextBlock(ctx: NoteContext): string {
  const cast = ctx.tagged.length
    ? ctx.tagged.map((e) => {
        const hist = e.history?.length ? ` | past: ${e.history.join('; ')}` : '';
        return `- ${e.name} (${e.type})${e.statSummary ? ` — ${e.statSummary}` : ''}${e.description ? `: ${e.description}` : ''}${hist}`;
      }).join('\n')
    : '- (none tagged)';
  const party = ctx.party.length
    ? ctx.party.map((p) => `- ${p.name}: ${p.summary}${p.hook ? ` | hook: ${p.hook}` : ''}`).join('\n')
    : '- (none)';
  return [
    ctx.campaignName ? `Campaign: ${ctx.campaignName}` : '',
    ctx.mood ? `Mood: ${ctx.mood}` : '',
    `Scene: ${ctx.intent.trim()}`,
    `Cast & locations (weave their past in):\n${cast}`,
    `Party (hook the scene to a bond where natural):\n${party}`,
  ].filter(Boolean).join('\n\n');
}

const NOTE_SHAPES = `Note shapes (STRICT JSON, no fences):
- read_aloud: { "type":"read_aloud", "body": player-facing prose to speak }
- tactic:     { "type":"tactic", "body": how a creature/NPC behaves }
- secret:     { "type":"secret", "body": hidden fact/consequence }
- lore:       { "type":"lore", "body": background/continuity tidbit }
- check:      { "type":"check", "body": what it reveals, "data": { "skill": string, "dc": 1-30 } }
- trigger:    { "type":"trigger", "body": short summary, "data": { "condition": "if players …", "dc": {"skill":string,"dc":1-30}|null, "reveal": read-aloud-on-trigger|null } }`;

async function call(messages: ChatMessage[], temperature: number): Promise<string> {
  // Claude-first via AI_PROVIDER_ORDER; NEVER forceProvider (a Claude outage must fall back).
  return chatWithAI(messages, { temperature });
}

export async function seedSceneNotes(ctx: NoteContext): Promise<NoteDraft[]> {
  const messages: ChatMessage[] = [
    { role: 'system', content: `You are a D&D 5e co-DM building run-help for a scene as STRICT JSON: { "notes": Note[] }.\n${NOTE_SHAPES}\nProduce 3-6 notes: at least one read_aloud, plus the tactics/secrets/checks a DM would otherwise run from memory. Weave the cast's past and party hooks in naturally. Player-safe text in read_aloud; hidden material in secret/trigger.` },
    { role: 'user', content: contextBlock(ctx) },
  ];
  return parseNotes(await call(messages, 0.8));
}

export async function draftNote(ctx: NoteContext, type: NoteType, hint?: string): Promise<NoteDraft> {
  const messages: ChatMessage[] = [
    { role: 'system', content: `You are a D&D 5e co-DM. Write ONE scene note of type "${type}" as STRICT JSON (no fences).\n${NOTE_SHAPES}` },
    { role: 'user', content: `${contextBlock(ctx)}\n\nWrite the ${type} note.${hint ? ` Focus: ${hint}` : ''}` },
  ];
  const parsed = parseOne(await call(messages, 0.8));
  return { ...parsed, type };
}

export async function suggestNotes(ctx: NoteContext, existing: Array<{ type: string; body: string }>): Promise<NoteDraft[]> {
  const have = existing.length ? existing.map((n) => `- ${n.type}: ${n.body}`).join('\n') : '- (none yet)';
  const messages: ChatMessage[] = [
    { role: 'system', content: `You are a D&D 5e co-DM. The DM asks "what am I forgetting?". Propose 2-4 NEW notes they're missing as STRICT JSON { "notes": Note[] }. Do not repeat existing notes.\n${NOTE_SHAPES}` },
    { role: 'user', content: `${contextBlock(ctx)}\n\nExisting notes:\n${have}` },
  ];
  return parseNotes(await call(messages, 0.9));
}

export async function refineNote(body: string, instruction: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'Rewrite the DM scene-note text per the instruction. Return ONLY the rewritten text — no quotes, no preamble.' },
    { role: 'user', content: `Instruction: ${instruction}\n\nText:\n${body}` },
  ];
  const out = (await call(messages, 0.7)).trim();
  if (!out) throw new Error('The refinement could not be read. Try again.');
  return out;
}

function parseNotes(raw: string): NoteDraft[] {
  let parsed: unknown;
  try { parsed = extractJson(raw); } catch { throw new Error('The notes could not be read. Try again or rephrase.'); }
  const result = notesSchema.safeParse(parsed);
  if (!result.success) throw new Error('The notes could not be read. Try again or rephrase.');
  return result.data.notes;
}

function parseOne(raw: string): NoteDraft {
  let parsed: unknown;
  try { parsed = extractJson(raw); } catch { throw new Error('The note could not be read. Try again or rephrase.'); }
  const result = noteSchema.safeParse(parsed);
  if (!result.success) throw new Error('The note could not be read. Try again or rephrase.');
  return result.data;
}
```

- [ ] **Step 4: Run tests + typecheck.**

Run: `npx vitest run src/lib/ai/__tests__/scene-notes.test.ts && npx tsc --noEmit`
Expected: all pass; tsc clean.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/ai/scene-notes.ts src/lib/ai/__tests__/scene-notes.test.ts
git commit -m "feat(scenes): AI note service — seed/draft/suggest/refine (provider-fallback)"
```

---

## Task 6: Router — `getStage` returns notes; note CRUD + reorder

**Files:**
- Modify: `src/server/routers/scenes.ts`

- [ ] **Step 1: Add a shared notes include + mirror sync helper** near the top of `scenes.ts` (after imports):

```ts
import { primaryReadAloud } from '../services/scene-generation.service';

const noteOrder = { orderBy: [{ orderIndex: 'asc' as const }, { createdAt: 'asc' as const }] };

/** Recompute Scene.description from the primary read-aloud note (denormalised mirror). */
async function syncReadAloudMirror(sceneId: string) {
  const notes = await prisma.sceneNote.findMany({
    where: { sceneId }, select: { type: true, body: true, orderIndex: true, createdAt: true },
  });
  const body = primaryReadAloud(notes);
  await prisma.scene.update({ where: { id: sceneId }, data: { description: body ?? '' } });
}
```

- [ ] **Step 2: Make `getStage` return ordered notes.** In the `getStage` query, add `notes` to the scene fetch:

```ts
      const scene = await prisma.scene.findUnique({ where: { id: input.id }, include: { notes: noteOrder } });
```
(Keep the campaign-ownership guard and the entities/party resolution as-is.)

- [ ] **Step 3: Add note CRUD + reorder procedures** inside `scenesRouter` (all DM-scoped). The `noteData` schema mirrors `scene-notes.ts`:

```ts
  notesCreate: campaignDMProcedure
    .input(z.object({
      sceneId: z.string(),
      type: z.enum(['read_aloud', 'tactic', 'secret', 'check', 'lore', 'trigger']),
      title: z.string().max(120).optional(),
      body: z.string().min(1).max(2000),
      data: z.any().optional(),
      source: z.enum(['manual', 'ai', 'ai_suggested']).default('manual'),
    }))
    .mutation(async ({ input }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.sceneId }, select: { campaignId: true } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.sceneId);
      const max = await prisma.sceneNote.aggregate({ where: { sceneId: input.sceneId }, _max: { orderIndex: true } });
      const note = await prisma.sceneNote.create({ data: {
        sceneId: input.sceneId, type: input.type, title: input.title, body: input.body,
        data: (input.data ?? undefined) as Prisma.InputJsonValue, source: input.source,
        orderIndex: (max._max.orderIndex ?? -1) + 1,
      } });
      if (input.type === 'read_aloud') await syncReadAloudMirror(input.sceneId);
      return note;
    }),

  notesUpdate: campaignDMProcedure
    .input(z.object({ id: z.string(), title: z.string().max(120).nullish(), body: z.string().min(1).max(2000).optional(), data: z.any().optional() }))
    .mutation(async ({ input }) => {
      const existing = await prisma.sceneNote.findUnique({ where: { id: input.id }, select: { sceneId: true, type: true, scene: { select: { campaignId: true } } } });
      if (!existing || existing.scene.campaignId !== input.campaignId) throw new NotFoundError('note', input.id);
      const note = await prisma.sceneNote.update({ where: { id: input.id }, data: {
        title: input.title === null ? null : input.title, body: input.body,
        data: input.data === undefined ? undefined : ((input.data ?? undefined) as Prisma.InputJsonValue),
      } });
      if (existing.type === 'read_aloud') await syncReadAloudMirror(existing.sceneId);
      return note;
    }),

  notesDelete: campaignDMProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const existing = await prisma.sceneNote.findUnique({ where: { id: input.id }, select: { sceneId: true, type: true, scene: { select: { campaignId: true } } } });
      if (!existing || existing.scene.campaignId !== input.campaignId) throw new NotFoundError('note', input.id);
      await prisma.sceneNote.delete({ where: { id: input.id } });
      if (existing.type === 'read_aloud') await syncReadAloudMirror(existing.sceneId);
      return { ok: true };
    }),

  notesReorder: campaignDMProcedure
    .input(z.object({ sceneId: z.string(), orderedIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.sceneId }, select: { campaignId: true } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.sceneId);
      await prisma.$transaction(input.orderedIds.map((id, i) =>
        prisma.sceneNote.update({ where: { id }, data: { orderIndex: i } })));
      await syncReadAloudMirror(input.sceneId);
      return { ok: true };
    }),
```

- [ ] **Step 4: Typecheck.**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit.**

```bash
git add src/server/routers/scenes.ts
git commit -m "feat(scenes): note CRUD + reorder, read-aloud mirror, getStage returns notes"
```

---

## Task 7: Router — `generate` seeds notes; AI note actions

**Files:**
- Modify: `src/server/routers/scenes.ts`

- [ ] **Step 1: Switch `generate` to seed notes.** Replace its body so it creates the scene then seeds notes from the woven context (it already calls `gatherSceneContext`):

```ts
  generate: campaignDMProcedure
    .input(generateInput)
    .mutation(async ({ input, ctx }) => {
      const context = await gatherSceneContext(input.campaignId, {
        intent: input.description, mood: input.type,
        linkedEntityIds: input.linkedEntityIds, partyPresentIds: input.partyPresentIds,
      });
      const notes = await seedSceneNotes(context);
      const title = input.title?.trim() || deriveTitle(input.description);
      const readAloud = notes.find((n) => n.type === 'read_aloud')?.body ?? '';

      const scene = await prisma.scene.create({ data: {
        campaignId: input.campaignId, title, type: input.type ?? 'rp',
        description: readAloud,
        linkedEntityIds: input.linkedEntityIds as Prisma.InputJsonValue,
        partyPresentIds: input.partyPresentIds as Prisma.InputJsonValue,
        generatedAt: new Date(),
        promptInput: { intent: input.description, mood: input.type ?? null, linkedEntityIds: input.linkedEntityIds, partyPresentIds: input.partyPresentIds } as Prisma.InputJsonValue,
        notes: { create: notes.map((n, i) => ({ type: n.type, title: n.title, body: n.body, data: (n.data ?? undefined) as Prisma.InputJsonValue, source: 'ai', orderIndex: i })) },
      } });

      enqueueSceneArt({ sceneId: scene.id, userId: ctx.session.user.id, title: scene.title, readAloud })
        .catch((e) => console.error('[scenes.generate] art enqueue failed', e));
      return scene;
    }),
```

Add a tiny title helper near the top of the file (no AI needed for the fallback title):

```ts
function deriveTitle(intent: string): string {
  const s = intent.trim().replace(/\s+/g, ' ');
  return s.length <= 60 ? s : s.slice(0, 57) + '…';
}
```

Update imports at the top: `import { seedSceneNotes, draftNote, suggestNotes, refineNote } from '@/lib/ai/scene-notes';`. (You may remove the now-unused `generateScene` import if nothing else uses it — check first.)

- [ ] **Step 2: Add the builder AI procedures** inside `scenesRouter`:

```ts
  notesDraft: campaignDMProcedure
    .input(z.object({ sceneId: z.string(), type: z.enum(['read_aloud','tactic','secret','check','lore','trigger']), hint: z.string().max(300).optional() }))
    .mutation(async ({ input }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.sceneId }, select: { campaignId: true, promptInput: true } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.sceneId);
      const ctx = await contextForScene(scene.campaignId, scene.promptInput);
      return draftNote(ctx, input.type, input.hint);
    }),

  notesSuggest: campaignDMProcedure
    .input(z.object({ sceneId: z.string() }))
    .mutation(async ({ input }) => {
      const scene = await prisma.scene.findUnique({ where: { id: input.sceneId }, select: { campaignId: true, promptInput: true, notes: { select: { type: true, body: true } } } });
      if (!scene || scene.campaignId !== input.campaignId) throw new NotFoundError('scene', input.sceneId);
      const ctx = await contextForScene(scene.campaignId, scene.promptInput);
      return suggestNotes(ctx, scene.notes);
    }),

  notesRefine: campaignDMProcedure
    .input(z.object({ id: z.string(), instruction: z.string().min(1).max(60) }))
    .mutation(async ({ input }) => {
      const note = await prisma.sceneNote.findUnique({ where: { id: input.id }, select: { body: true, scene: { select: { campaignId: true } } } });
      if (!note || note.scene.campaignId !== input.campaignId) throw new NotFoundError('note', input.id);
      return { body: await refineNote(note.body, input.instruction) };
    }),
```

Add a small helper that rebuilds context from a scene's stored `promptInput` (reused by draft/suggest), near the other helpers:

```ts
async function contextForScene(campaignId: string, promptInput: unknown) {
  const p = (promptInput && typeof promptInput === 'object' && !Array.isArray(promptInput) ? promptInput : {}) as {
    intent?: string; mood?: string; linkedEntityIds?: string[]; partyPresentIds?: string[];
  };
  return gatherSceneContext(campaignId, {
    intent: typeof p.intent === 'string' ? p.intent : '',
    mood: (['rp','description','tavern','battle','theatre'] as const).includes(p.mood as never) ? (p.mood as never) : undefined,
    linkedEntityIds: Array.isArray(p.linkedEntityIds) ? p.linkedEntityIds : [],
    partyPresentIds: Array.isArray(p.partyPresentIds) ? p.partyPresentIds : [],
  });
}
```

- [ ] **Step 3: Typecheck.**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit.**

```bash
git add src/server/routers/scenes.ts
git commit -m "feat(scenes): generate seeds notes; draft/suggest/refine note actions"
```

---

## Task 8: Note constants + `NoteCard` + `NoteBoard` (no AI yet)

**Files:**
- Create: `src/components/scenes/note-constants.ts`, `NoteCard.tsx`, `NoteBoard.tsx`

- [ ] **Step 1: Constants** `src/components/scenes/note-constants.ts`:

```ts
export const NOTE_TYPES = ['read_aloud', 'tactic', 'secret', 'check', 'lore', 'trigger'] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const NOTE_LABEL: Record<NoteType, string> = {
  read_aloud: 'read-aloud', tactic: 'tactic', secret: 'secret', check: 'check', lore: 'lore', trigger: 'trigger',
};
export const NOTE_TINT: Record<NoteType, string> = {
  read_aloud: 'var(--qd-accent-text)', tactic: 'var(--qd-arcane)', secret: 'var(--qd-accent-bright)',
  check: 'var(--qd-success)', lore: 'var(--qd-ink-muted)', trigger: 'var(--qd-danger-bright)',
};

export interface SceneNote {
  id: string; type: NoteType; title: string | null; body: string;
  data: unknown; orderIndex: number; source: string;
}
```

- [ ] **Step 2: `NoteCard.tsx`** — display + inline edit; renders `check`/`trigger` payloads; exposes refine/edit/delete callbacks:

```tsx
'use client';
import { useState } from 'react';
import { NOTE_LABEL, NOTE_TINT, type SceneNote } from './note-constants';

const mono = 'font-[family-name:var(--qd-font-mono)]';

export function NoteCard({ note, onSave, onDelete, onRefine, refining }: {
  note: SceneNote;
  onSave: (patch: { body: string }) => void;
  onDelete: () => void;
  onRefine: (instruction: string) => void;
  refining: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const d = (note.data ?? {}) as { skill?: string; dc?: number | { skill: string; dc: number }; condition?: string; reveal?: string };

  return (
    <div className="rounded-qd-md border border-qd-faint p-3" style={{ borderLeft: `2px solid ${NOTE_TINT[note.type]}` }}>
      <div className="mb-1 flex items-center gap-2">
        <span className={`${mono} text-[8px] uppercase tracking-[0.1em]`} style={{ color: NOTE_TINT[note.type] }}>{NOTE_LABEL[note.type]}</span>
        <span className="ml-auto flex gap-2">
          {(note.type === 'read_aloud' || note.type === 'lore' || note.type === 'secret') && (
            <>
              <button disabled={refining} onClick={() => onRefine('colder')} className="text-[10px] text-qd-ink-faint hover:text-qd-accent-text">✦ colder</button>
              <button disabled={refining} onClick={() => onRefine('shorter')} className="text-[10px] text-qd-ink-faint hover:text-qd-accent-text">✦ shorter</button>
            </>
          )}
          <button onClick={() => { setDraft(note.body); setEditing((e) => !e); }} className="text-[10px] text-qd-ink-faint hover:text-qd-accent-text">✎</button>
          <button onClick={onDelete} className="text-[10px] text-qd-ink-faint hover:text-qd-danger-bright">✕</button>
        </span>
      </div>
      {editing ? (
        <div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="w-full rounded-qd-md border border-qd-accent bg-[rgba(255,255,255,0.03)] px-2.5 py-1.5 text-sm text-qd-ink focus:outline-none" />
          <div className="mt-1.5 flex gap-2">
            <button onClick={() => { onSave({ body: draft }); setEditing(false); }} className="rounded-qd-md bg-qd-accent px-3 py-1 text-[12px] font-bold text-qd-on-accent">Save</button>
            <button onClick={() => setEditing(false)} className="rounded-qd-md border border-qd-strong px-3 py-1 text-[12px] text-qd-ink-2">Cancel</button>
          </div>
        </div>
      ) : (
        <p className={`text-qd-body-sm leading-relaxed ${note.type === 'read_aloud' ? 'font-qd-display italic text-qd-ink' : 'text-qd-ink-2'}`}>{note.body}</p>
      )}
      {note.type === 'check' && d.skill && <div className={`${mono} mt-1.5 text-[11px] text-qd-success`}>{d.skill} DC {String(d.dc)}</div>}
      {note.type === 'trigger' && (
        <div className="mt-1.5 text-[11px] text-qd-ink-2">
          {d.condition && <div><span className="text-qd-ink-faint">if</span> {d.condition}</div>}
          {d.dc && typeof d.dc === 'object' && <div className="text-qd-success">{d.dc.skill} DC {d.dc.dc}</div>}
          {d.reveal && <div className="mt-0.5 italic text-qd-accent-text">“{d.reveal}”</div>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `NoteBoard.tsx`** — fetches the stage, renders the note list with add/edit/delete (AI wiring added in Task 9). This task: CRUD only, with stub handlers for AI buttons that call the procedures already built:

```tsx
'use client';
import { trpc } from '@/lib/trpc';
import { NOTE_TYPES, NOTE_LABEL, type NoteType, type SceneNote } from './note-constants';
import { NoteCard } from './NoteCard';

const mono = 'font-[family-name:var(--qd-font-mono)]';

export function NoteBoard({ campaignId, sceneId }: { campaignId: string; sceneId: string }) {
  const utils = trpc.useUtils();
  const stage = trpc.scenes.getStage.useQuery({ campaignId, id: sceneId });
  const invalidate = () => utils.scenes.getStage.invalidate({ campaignId, id: sceneId });

  const create = trpc.scenes.notesCreate.useMutation({ onSuccess: invalidate });
  const update = trpc.scenes.notesUpdate.useMutation({ onSuccess: invalidate });
  const del = trpc.scenes.notesDelete.useMutation({ onSuccess: invalidate });
  const draft = trpc.scenes.notesDraft.useMutation();
  const refine = trpc.scenes.notesRefine.useMutation();

  if (stage.isLoading) return <div className="px-6 py-12 text-qd-ink-muted">Drawing the scene…</div>;
  if (stage.error || !stage.data) return <div className="px-6 py-12 text-qd-ink-muted">The threads tangled. Try again.</div>;

  const scene = stage.data.scene as { title: string; act: string | null; notes: SceneNote[] };
  const notes = scene.notes ?? [];

  const addBlock = async (type: NoteType) => {
    const d = await draft.mutateAsync({ campaignId, sceneId, type }); // AI auto-fill
    await create.mutateAsync({ campaignId, sceneId, type, title: d.title ?? undefined, body: d.body, data: d.data ?? undefined, source: 'ai' });
  };
  const refineNote = async (id: string, instruction: string) => {
    const r = await refine.mutateAsync({ campaignId, id, instruction });
    await update.mutateAsync({ campaignId, id, body: r.body });
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      {scene.act && <div className={`${mono} mb-1 text-[9px] uppercase tracking-[0.14em] text-qd-ink-muted`}>▸ {scene.act}</div>}
      <h1 className="mb-4 font-qd-display text-[28px] leading-tight text-qd-ink-strong">{scene.title}</h1>

      <div className="flex flex-col gap-2.5">
        {notes.map((n) => (
          <NoteCard key={n.id} note={n}
            onSave={(patch) => update.mutate({ campaignId, id: n.id, body: patch.body })}
            onDelete={() => del.mutate({ campaignId, id: n.id })}
            onRefine={(instr) => refineNote(n.id, instr)}
            refining={refine.isPending} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {NOTE_TYPES.map((t) => (
          <button key={t} disabled={draft.isPending || create.isPending} onClick={() => addBlock(t)}
            className="rounded-full border border-dashed border-qd-strong px-3 py-1.5 text-[11px] text-qd-ink-2 hover:border-qd-accent hover:text-qd-accent-text disabled:opacity-50">
            + {NOTE_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck.**

Run: `npx tsc --noEmit`
Expected: clean. (Confirm `getStage` now includes `notes` and `act` — adjust the `scene` cast if Prisma's inferred type differs.)

- [ ] **Step 5: Commit.**

```bash
git add src/components/scenes/note-constants.ts src/components/scenes/NoteCard.tsx src/components/scenes/NoteBoard.tsx
git commit -m "feat(scenes): note board + card with AI auto-fill add and inline refine"
```

---

## Task 9: Ghost suggestions + "What am I forgetting?"

**Files:**
- Modify: `src/components/scenes/NoteBoard.tsx`

- [ ] **Step 1: Add ghost state + UI** to `NoteBoard`. Add the suggest mutation and a local ghost list, render dashed ghost cards with ✓/✕, and a "What am I forgetting?" button. Insert after the existing mutation hooks:

```tsx
  const suggest = trpc.scenes.notesSuggest.useMutation();
  const [ghosts, setGhosts] = useState<Array<{ type: NoteType; title?: string; body: string; data?: unknown }>>([]);

  const askForgetting = async () => {
    const out = await suggest.mutateAsync({ campaignId, sceneId });
    setGhosts(out as typeof ghosts);
  };
  const keepGhost = async (g: { type: NoteType; title?: string; body: string; data?: unknown }, idx: number) => {
    await create.mutateAsync({ campaignId, sceneId, type: g.type, title: g.title, body: g.body, data: g.data ?? undefined, source: 'ai_suggested' });
    setGhosts((gs) => gs.filter((_, i) => i !== idx));
  };
  const dismissGhost = (idx: number) => setGhosts((gs) => gs.filter((_, i) => i !== idx));
```

Add `useState` to the React import. Render the ghosts under the notes list and the button in the add-bar row:

```tsx
      {ghosts.map((g, i) => (
        <div key={i} className="rounded-qd-md border border-dashed p-3" style={{ borderColor: 'var(--qd-border-accent)', background: 'rgba(217,138,61,.05)' }}>
          <div className="mb-1 flex items-center gap-2">
            <span className={`${mono} text-[8px] uppercase tracking-[0.1em] text-qd-accent-text`}>✦ {NOTE_LABEL[g.type]}</span>
            <span className="ml-auto flex gap-2">
              <button onClick={() => keepGhost(g, i)} className="text-[12px] text-qd-success">✓</button>
              <button onClick={() => dismissGhost(i)} className="text-[12px] text-qd-ink-faint">✕</button>
            </span>
          </div>
          <p className="text-qd-body-sm italic text-qd-ink-2">{g.body}</p>
        </div>
      ))}
```

And in the add-bar:

```tsx
        <button disabled={suggest.isPending} onClick={askForgetting}
          className="ml-auto rounded-full border border-qd-accent px-3 py-1.5 text-[11px] text-qd-accent-text hover:bg-[rgba(217,138,61,0.08)] disabled:opacity-50">
          ✦ {suggest.isPending ? 'Listening…' : 'What am I forgetting?'}
        </button>
```

- [ ] **Step 2: Typecheck + lint.**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean (no new errors in this file).

- [ ] **Step 3: Commit.**

```bash
git add src/components/scenes/NoteBoard.tsx
git commit -m "feat(scenes): ghost suggestions + what-am-I-forgetting in the note board"
```

---

## Task 10: Page wiring — scene surface = `NoteBoard`

**Files:**
- Modify: `src/app/v3/campaigns/[slug]/scenes/page.tsx`

- [ ] **Step 1: Swap `SceneStage` for `NoteBoard`** as the reveal/stage surface. Change the import and the JSX where the stage renders:

```tsx
import { NoteBoard } from '@/components/scenes/NoteBoard';
```
Replace the `<SceneStage ... />` usage with:
```tsx
                <NoteBoard campaignId={campaignId} sceneId={stageId} />
```
(Leave the compose → loading → stage phase orchestration, the gallery sidebar, and `SceneCreateForm`/`SceneLoading` exactly as they are. `SceneStage.tsx` is now unused — keep the file for the present/play bridge reference but remove its import here.)

- [ ] **Step 2: Typecheck + lint + manual smoke.**

Run: `npx tsc --noEmit && npm run lint`
Then `npm run dev` (port 3847): open a campaign's Scenes → + New Scene → describe + tag → Create → the reveal now shows the **note board** with AI-seeded notes; add a block (AI fills it); click "What am I forgetting?" → ghosts appear → keep one; refine a read-aloud (colder); edit + delete a note.

- [ ] **Step 3: Commit.**

```bash
git add "src/app/v3/campaigns/[slug]/scenes/page.tsx"
git commit -m "feat(scenes): scene surface is the note builder"
```

---

## Task 11: Workflow spec

**Files:**
- Create: `tests/workflows/scene-notes.workflow.spec.ts`

> **REQUIRED SUB-SKILL:** use `workflow-spec`. Match the harness facts established by `tests/workflows/scenes.workflow.spec.ts` (helper `signInAsTestUser`, `ensureTestUserExists`/`ensureTestCampaignExists`, `checkpoint`, slug `vic-s-test-campaign`). Seed deterministically via Prisma — do NOT call live AI.

- [ ] **Step 1: Write the spec.** Seed a Scene with several `SceneNote` rows (read_aloud, tactic, check, trigger), then drive: open Scenes → select the seeded scene → assert the note board renders each note type → edit a note body + Save → delete a note. (Adding/ghosts/refine call live AI, so assert their **affordances exist** — the "+ tactic" buttons and "What am I forgetting?" are visible/enabled — rather than triggering them.)

```ts
import { test, expect } from '@playwright/test';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkpoint, signInAsTestUser, ensureTestUserExists, ensureTestCampaignExists, TEST_USER_PASSWORD } from '../helpers';

const VIC = process.env.QA_VIC_EMAIL ?? 'vic@test.local';
const PW = process.env.QA_TEST_PASSWORD ?? TEST_USER_PASSWORD;
const SLUG = process.env.QA_CAMPAIGN_SLUG ?? 'vic-s-test-campaign';
const TITLE = `QA Notes ${Date.now()}`;
const READ = 'The portcullis groans; iron teeth wet with fog.';
const NO_CRASH = /something went wrong|internal server error|client-side exception|application error/i;

test.describe('scenes — note builder', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists(VIC, PW);
    await ensureTestCampaignExists(VIC, SLUG, "Vic's Test Campaign");
    const c = await prisma.campaign.findUnique({ where: { slug: SLUG } });
    if (!c) throw new Error('seed: campaign missing');
    await prisma.scene.create({ data: {
      campaignId: c.id, title: TITLE, type: 'theatre', description: READ, generatedAt: new Date(),
      promptInput: { intent: 'gates', mood: 'theatre', linkedEntityIds: [], partyPresentIds: [] } as Prisma.InputJsonValue,
      notes: { create: [
        { type: 'read_aloud', body: READ, orderIndex: 0, source: 'ai' },
        { type: 'tactic', body: 'Gargoyles wake only if a torch is lit.', orderIndex: 1, source: 'ai' },
        { type: 'check', body: 'Spot the watcher above', data: { skill: 'Perception', dc: 15 } as Prisma.InputJsonValue, orderIndex: 2, source: 'ai' },
        { type: 'trigger', body: 'If they knock', data: { condition: 'knock on the gate', reveal: 'A slot opens — eyes.' } as Prisma.InputJsonValue, orderIndex: 3, source: 'ai' },
      ] },
    } });
  });

  test('builds and edits a scene’s notes', async ({ page }, info) => {
    test.slow();
    await checkpoint(info, 'sign-in', async () => { await signInAsTestUser(page, VIC, PW); }, 20_000);
    await checkpoint(info, 'open-and-select', async () => {
      await page.goto(`/v3/campaigns/${SLUG}/scenes`);
      await page.getByRole('button', { name: TITLE }).first().click();
      await expect(page.getByRole('heading', { name: TITLE })).toBeVisible({ timeout: 12_000 });
    }, 25_000);
    await checkpoint(info, 'notes-render', async () => {
      await expect(page.getByText(READ)).toBeVisible();
      await expect(page.getByText('Gargoyles wake only if a torch is lit.')).toBeVisible();
      await expect(page.getByText(/Perception DC 15/)).toBeVisible();
      await expect(page.getByText(/knock on the gate/)).toBeVisible();
      await expect(page.getByRole('button', { name: /What am I forgetting/i })).toBeVisible();
      await expect(page.getByRole('button', { name: '+ tactic' })).toBeEnabled();
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 20_000);
    await checkpoint(info, 'edit-and-delete', async () => {
      await page.getByText('Gargoyles wake only if a torch is lit.').locator('xpath=ancestor::div[1]').getByRole('button', { name: '✎' }).click();
      const ta = page.locator('textarea').first();
      await ta.fill('Gargoyles wake if a torch is lit OR a weapon is drawn.');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText(/weapon is drawn/)).toBeVisible({ timeout: 8_000 });
      await expect(page.locator('body')).not.toContainText(NO_CRASH);
    }, 25_000);
  });
});
```

- [ ] **Step 2: Run it.**

Run: `npx playwright test tests/workflows/scene-notes.workflow.spec.ts`
Expected: PASS. If a selector (e.g. the `✎` ancestor lookup) doesn't match the rendered DOM, adjust the locator to the real structure — do not loosen the assertions. Report honestly if the dev server/DB is unavailable.

- [ ] **Step 3: Run the gate.**

Run: `npm run qa:cycle`
Expected: PASS (no `test.fixme`). Report any pre-existing unrelated failures honestly.

- [ ] **Step 4: Commit.**

```bash
git add tests/workflows/scene-notes.workflow.spec.ts
git commit -m "test(scenes): note builder workflow spec (acceptance gate)"
```

---

## Task 12: Persona update + cleanup

**Files:**
- Modify: `tests/personas/veteran-dm.persona.spec.ts`

- [ ] **Step 1:** Add a step (standalone test, matching that file's structure) where the veteran DM seeds a scene with notes (reuse the Task 11 seed block adapted to Blake's campaign slug), opens it, asserts the note board renders and the "What am I forgetting?" affordance is present. Keep existing steps intact.

- [ ] **Step 2: Run.**

Run: `npx playwright test tests/personas/veteran-dm.persona.spec.ts -g "note"`
Expected: the new test passes (run on a warm server; report pre-existing unrelated failures honestly).

- [ ] **Step 3: Commit.**

```bash
git add tests/personas/veteran-dm.persona.spec.ts
git commit -m "test(scenes): veteran-dm builds a scene’s notes"
```

- [ ] **Step 4: Deploy note (report only).** No worker code changed in Layer 1, so no homelab redeploy is required beyond the normal app deploy. (`scenes.generate` now seeds notes inline; the image worker is unchanged.)

---

## Self-Review (completed during planning)

- **Spec coverage:** SceneNote model + types incl. trigger (T1) ✓ · content→notes backfill (T2) ✓ · Brain weave + bonds (T3,T4) ✓ · primary-read-aloud mirror (T4,T6) ✓ · AI seed/draft/suggest/refine, provider-fallback (T5) ✓ · note CRUD/reorder + getStage notes (T6) ✓ · generate seeds notes + AI actions (T7) ✓ · invisible-AI builder: auto-fill (T8), ghosts + "what am I forgetting" (T9), inline refine (T8) ✓ · scene surface = note board, SceneStage de-emphasised (T10) ✓ · workflow spec + persona (T11,T12) ✓.
- **Placeholder scan:** none — every step has concrete code/commands. The one selector caveat in T11 is an explicit "match real DOM" instruction with a complete spec around it.
- **Type consistency:** `NoteType`/`NoteDraft`/`SceneNote`/`NoteContext` are consistent across `scene-notes.ts` (T5), the router note schemas (T6,T7), `note-constants.ts` (T8); `gatherSceneContext` returns the `SceneContext` extended in T3 and consumed in T5; `seedSceneNotes`/`draftNote`/`suggestNotes`/`refineNote` signatures match between T5 and the router (T7).

## Open verification points (flagged inline)

1. `getStage`'s Prisma-inferred type for `scene.notes`/`scene.act` — adjust the `NoteBoard` cast if it differs (T8).
2. The `✎`-button ancestor locator in the workflow spec vs. the real `NoteCard` DOM (T11).
3. Whether `generate-scene.ts`'s `generateScene` is still imported anywhere after T7 (remove the dead import if not).
