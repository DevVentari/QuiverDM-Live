# Session Scene Runner + Sourcebook Scene Extraction — Design Spec

**Date:** 2026-03-25
**Status:** Approved for implementation
**Scope:** Alpha

---

## Overview

Two tightly coupled features that share a data model:

1. **Session Scene Runner** — Scenes become the spine of session play. The cockpit surfaces read-aloud text when a scene advances, collapses to a slim bar mid-scene, and shows contextual NPCs/secrets/monsters/tables in the right panel automatically.

2. **Sourcebook Scene Extraction** — PDF ingestion detects chapter structure, boxed read-aloud text, encounter tables, and roll tables from `HomebrewPDF` documents. Pre-populates prep scenes from the book. Auto-suggests the next unplayed chapter when the DM starts prep.

---

## Sub-projects

These share a data model but can be implemented sequentially:
1. **Schema + prep wizard** (scene runner prereq)
2. **Sourcebook extraction pipeline**
3. **Cockpit scene runner UI**

---

## Section 1: Data Model

### 1.1 `SceneSchema` extension (`src/lib/prep-types.ts`)

Add to the existing `SceneSchema`:

```typescript
readAloud: z.string().default(''),             // Text DM reads aloud to players
order: z.number().int().default(0),             // Sequence within session prep
linkedNpcIds: z.array(z.string()).default([]),       // PrepNpc.id values linked to scene
linkedSecretIds: z.array(z.string()).default([]),    // PrepSecret.id values linked to scene
linkedMonsterNames: z.array(z.string()).default([]), // PrepMonster.name values linked to scene
sourceId: z.string().optional(),               // SourcebookScene.id if imported from book
```

`order` replaces implicit array ordering — scenes are sorted by `order` ascending.

`linkedNpcIds` references `PrepNpc.id`. Because `PrepNpcSchema` currently has no `id` field, **also add `id: z.string()` to `PrepNpcSchema`** (matching the existing pattern on `SceneSchema` and `SecretSchema`). Existing prep data without ids is migrated on first load in `prep-workspace.tsx`: before passing `prepData` to steps, map each NPC that lacks an `id` to `{ ...npc, id: npc.npcId ?? crypto.randomUUID() }`, then immediately save via the existing prep save mutation. This runs once per session on wizard open.

### 1.2 New Prisma model: `SourcebookScene`

`SourcebookScene` hangs off `HomebrewPDF` (the document container), not `HomebrewContent` (individual extracted items). `HomebrewPDF.markdownContent` is the source for scene extraction.

```prisma
model SourcebookScene {
  id            String   @id @default(cuid())
  pdfId         String                          // FK → HomebrewPDF
  chapterId     String                          // slug e.g. "the-cults-stronghold"
  chapterTitle  String                          // e.g. "The Cult's Stronghold"
  chapterIndex  Int                             // 0-based order of chapter in book
  sceneIndex    Int                             // 0-based order within chapter
  title         String
  location      String?
  readAloud     String?  @db.Text              // Extracted blockquote text
  description   String?  @db.Text              // GM-facing prose (non-boxed)
  linkedNpcs    Json     @default("[]")         // [{name: string, role?: string}]
  linkedMonsters Json    @default("[]")         // [{name: string, cr?: string, count: number}]
  rollTables    Json     @default("[]")         // [{name: string, die: string, entries: string[]}]
  createdAt     DateTime @default(now())

  pdf HomebrewPDF @relation(fields: [pdfId], references: [id], onDelete: Cascade)

  @@index([pdfId, chapterId])
  @@index([pdfId, chapterIndex])
}
```

Add to `HomebrewPDF`:
```prisma
sourcebookScenes SourcebookScene[]
```

### 1.3 `GameSession` model addition

Add to the `GameSession` model (not `Session` — `Session` is the NextAuth auth table at line 39 of `schema.prisma`):

```prisma
activeSceneIndex Int? @default(0)  // Persists current scene position in cockpit
```

---

## Section 2: PDF Extraction Pipeline

### 2.1 Architecture

Current flow: PDF → Docling (markdown stored in `HomebrewPDF.markdownContent`) → AI extraction → `HomebrewContent` item records

New second pass — triggered by the PDF processing worker after `HomebrewPDF.markerProcessed` is set to `true`:

```
HomebrewPDF.markerProcessed = true
  → existing worker enqueues: sourcebook-scene-extraction job
  → input: { pdfId, markdownContent }
  → output: N SourcebookScene records created under pdfId
```

The trigger lives in the PDF processing worker (the worker that sets `markerProcessed = true`). After marking processing complete, it enqueues the scene extraction job unconditionally — the extraction worker handles PDFs with no chapter structure gracefully (single `"main"` chapter).

### 2.2 New BullMQ queue: `sourcebook-scene-extraction`

**File:** `src/lib/queue/sourcebook-scene-extraction-queue.ts`

```typescript
interface SourcebookSceneExtractionJobData {
  pdfId: string;
  markdownContent: string;  // HomebrewPDF.markdownContent
}

interface SourcebookSceneExtractionJobResult {
  scenesCreated: number;
  chaptersFound: number;
  tablesFound: number;
}
```

**Worker:** `src/lib/queue/sourcebook-scene-extraction-worker.ts`

Add npm script: `worker:sourcebook-scenes` (following existing worker script pattern in `package.json`).

### 2.3 Markdown detection logic

| Source pattern | Extraction target |
|---|---|
| `# Chapter N: Title` or `## Title` at top level | New chapter boundary → `chapterId` (slugified), `chapterTitle`, `chapterIndex` (increment) |
| H3 / H4 under a chapter | New scene → `title`, `sceneIndex` (increment within chapter) |
| `> paragraph text` (blockquote) | `readAloud` — concatenated for the current scene |
| Markdown table with die notation in header (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`) | `rollTables` entry on current scene: `{name, die, entries[]}` |
| NPC/creature names (from `HomebrewContent` linked to same campaign) within 800 chars of scene heading | `linkedNpcs` / `linkedMonsters` on that scene |
| Non-blockquote body text between headings | `description` |

**Chapter ID generation:** `slugify(chapterTitle)` → `"the-cults-stronghold"`. Stable across re-ingestion. `chapterIndex` is the 0-based position in parse order.

**No chapter headings found:** Worker creates a single chapter `{ chapterId: "main", chapterTitle: "Main", chapterIndex: 0 }` and maps all H2/H3 sections as scenes under it.

**Re-ingestion:** On re-run, delete all existing `SourcebookScene` records for this `pdfId` before inserting new ones.

### 2.4 Modified files for pipeline

| File | Change |
|---|---|
| `src/lib/queue/sourcebook-scene-extraction-queue.ts` | New — queue definition |
| `src/lib/queue/sourcebook-scene-extraction-worker.ts` | New — extraction worker |
| PDF processing worker (file that sets `markerProcessed = true`) | Enqueue scene extraction job after marking complete |
| `package.json` | Add `worker:sourcebook-scenes` script |

---

## Section 3: Prep Wizard — Scene Step

### 3.1 `SceneSchema` field additions in UI

Each scene card in `step-scenes.tsx` gains:

- **Read-aloud textarea** — below description, amber left border, serif italic font. Placeholder: *"Read this aloud to your players when the scene begins..."*. If `sourceId` is set, pre-filled from the book and marked with a small "From book" badge. Editable by DM.
- **Linked entities section** (collapsible, default closed) — checkboxes listing all prep NPCs (by name), secrets (by text preview), and monsters (by name). Pre-checked based on auto-match logic. DM can toggle any item.

### 3.2 Import from Sourcebook panel

Button at top of Scenes step: **"Import Scenes from Sourcebook"** opens a right-side shadcn Sheet:

1. Lists `HomebrewPDF` records available to this campaign: PDFs where `campaignId = campaign.id` OR where `userId = campaign.ownerId AND campaignId IS NULL` (personal library PDFs belonging to the campaign owner). This ensures DMs who uploaded PDFs before linking them to a campaign can still access them.
2. Shows chapters grouped by `chapterId`, ordered by `chapterIndex`
3. **Auto-suggested chapter** highlighted with amber border (see 3.3)
4. DM expands a chapter to preview its scenes (title + first line of read-aloud)
5. DM selects individual scenes or "Import all scenes in chapter"
6. On confirm: selected `SourcebookScene` records are transformed into `SceneSchema` objects with `sourceId`, `readAloud`, `order`, `linkedNpcIds`, `linkedSecretIds`, `linkedMonsterNames` pre-populated and appended to prep

### 3.3 Auto-suggest logic

Auto-suggest is server-side. Add endpoint to `sourcebook-scenes.ts`:

```typescript
sourcebookScenes.suggestNextChapter({ campaignId, pdfId }) →
  { chapterId: string; chapterIndex: number } | null
```

Server logic:
1. Load all `GameSession` records for `campaignId` (select `prepData` JSON only)
2. Parse each `prepData` blob with `SessionPrepDataSchema.safeParse(session.prepData)` — skip sessions where parse fails. Extract all `scene.sourceId` values from `.scenes[]`.
3. Query `SourcebookScene` WHERE `id IN (sourceIds) AND pdfId = pdfId` — select `chapterIndex`
4. Return `chapterIndex = max(results) + 1`, or `0` if no results
5. If `chapterIndex` exceeds the max available chapter, return the last chapter

The import drawer calls this endpoint when it opens. Uses `campaignMemberProcedure`.

---

## Section 4: Cockpit Scene Runner

### 4.1 Layout (Option A — Split Center)

The center panel of the cockpit (`flex-1`) splits vertically:

```
┌─────────────────────────────────────────────┐
│ HEADER (session title, rec, mode toggle)     │
├──────────┬─────────────────────────┬─────────┤
│  Party   │  [SceneRunner]          │  Scene  │
│  Panel   │  ─────────────          │  Context│
│  (w-60)  │  [LiveNotesPanel]       │  (w-80) │
└──────────┴─────────────────────────┴─────────┘
```

### 4.2 `SceneRunner` component (`src/components/cockpit/scene-runner.tsx`)

Props:
```typescript
interface SceneRunnerProps {
  scenes: PrepScene[];
  activeIndex: number;
  isExpanded: boolean;
  onNavigate: (index: number) => void;
  onExpandToggle: (expanded: boolean) => void;
}
```

**Expanded state** (shown when scene first advances):
- Scene number badge: `Scene 3 of 6`
- Location badge
- Read-aloud block: amber left border, `font-serif italic`, `text-sm` — dominant visual element
- Prev / Next buttons (top-right)
- Source credit: `"Ch. 4 · YoRD"` if `sourceId` set

**Collapsed state:**
- Slim bar: scene number + title + first ~60 chars of read-aloud (truncated, dimmed)
- Prev / Next still visible
- Click bar to re-expand

**Collapse/expand is owned by the cockpit page** (`live/page.tsx`), which already owns `mode` state. Add:
```typescript
const [isSceneExpanded, setIsSceneExpanded] = useState(false);
// Set true when activeSceneIndex changes (scene advance)
// Pass setIsSceneExpanded(false) as onClick to LiveNotesPanel wrapper
```

`LiveNotesPanel` wrapper div gets `onClick={() => setIsSceneExpanded(false)}` so clicking into notes collapses the scene card. No cross-component signals needed — state lives in the shared parent.

**State persistence:**
- `activeSceneIndex` synced to server via `trpc.sessions.updateActiveScene` (debounced 500ms)
- On cockpit load, `session.activeSceneIndex` initialises the local state

**Cockpit sourcebook data fetch:**

The live page (`live/page.tsx`) collects all `sourceId` values from `prepData.scenes` on mount and calls `sourcebookScenes.getByIds({ campaignId, ids: sourceIds })`. The resulting `SourcebookScene[]` is passed as a prop to `SceneContextPanel`. If a scene has no `sourceId`, the Scene tab shows only the manually linked and auto-matched content with no Tables section.

### 4.3 Right panel: "Scene" tab replaces "Prep" tab

The existing right panel tabs become: **Scene / NPCs / Brain / Co-DM**

The `PrepReferencePanel` (current "Prep" tab) is removed from the cockpit. All prep content the DM needs mid-session is surfaced contextually through the Scene tab. The full prep document remains accessible via the prep wizard at `/campaigns/[slug]/sessions/prep`.

The `SceneContextPanel` component (`src/components/cockpit/scene-context-panel.tsx`) shows:

1. **NPCs** — union of `linkedNpcIds` (resolved to names) + auto-matched prep NPCs
2. **Encounter** — `linkedMonsterNames` + auto-matched prep monsters
3. **Secrets** — `linkedSecretIds` (resolved) + auto-matched secrets
4. **Tables** — `rollTables` from `SourcebookScene` where `sourceId` matches current scene (client-side dice roll, result shown inline)

Content updates immediately when `activeIndex` changes.

### 4.4 tRPC endpoint additions

**`src/server/routers/sessions.ts`** (existing router):
```typescript
sessions.updateActiveScene({ sessionId, sceneIndex }) → void
sessions.getActiveScene({ sessionId }) → { sceneIndex: number }
```

**`src/server/routers/sourcebook-scenes.ts`** (new router — register in `src/server/routers/index.ts`):

All endpoints use `campaignMemberProcedure` (read-only, campaign-scoped access).

```typescript
// Get all scenes for a PDF (for import drawer scene previews)
sourcebookScenes.getByPdf({ campaignId, pdfId }) → SourcebookScene[]

// Get chapter list for a PDF (for import drawer chapter list)
sourcebookScenes.getChapters({ campaignId, pdfId }) →
  { chapterId, chapterTitle, chapterIndex, sceneCount }[]

// Get scenes by sourceId list (for cockpit — resolves rollTables + linkedNpcs per scene)
sourcebookScenes.getByIds({ campaignId, ids: string[] }) → SourcebookScene[]

// Auto-suggest next chapter
sourcebookScenes.suggestNextChapter({ campaignId, pdfId }) →
  { chapterId: string; chapterIndex: number } | null
```

---

## Section 5: Tagging System

### 5.1 Auto-match (runtime, no DB)

In `SceneContextPanel`, for the active scene:

```typescript
const sceneText = [scene.title, scene.description, scene.location].join(' ').toLowerCase();

// NPCs: match if npc.name appears in scene text
const autoNpcs = prepData.npcs.filter(npc =>
  sceneText.includes(npc.name.toLowerCase())
);

// Secrets: match if secret.linkedTo matches scene location (normalised)
const autoSecrets = prepData.secretsAndClues.filter(s =>
  s.linkedTo && scene.location &&
  normalize(s.linkedTo) === normalize(scene.location)
);

// Monsters: match if monster.name appears in scene text
const autoMonsters = prepData.monsters.filter(m =>
  sceneText.includes(m.name.toLowerCase())
);
```

Auto-matched items are shown with a `~` prefix (dimmed) to distinguish from manually linked.

### 5.2 Manual tagging (prep time, `step-scenes.tsx`)

Expandable **"Linked Entities"** section on each scene card:
- Checklist of prep NPCs (by name, key = `PrepNpc.id`) → toggle adds/removes from `linkedNpcIds`
- Checklist of prep secrets (by text preview, key = `PrepSecret.id`) → `linkedSecretIds`
- Checklist of prep monsters (by name) → `linkedMonsterNames`

Pre-checked state derived from auto-match at mount time. DM can override.

---

## Section 6: Roll Tables

Extracted from sourcebook scenes and stored as `SourcebookScene.rollTables: [{name, die, entries[]}]`.

In cockpit Scene tab (Tables section per scene):
- Show: table name + die notation
- Roll button: `Math.ceil(Math.random() * sides)` — pure client-side
- Result shown inline below the table name as an amber highlighted entry
- No server call

Roll tables are not part of `SessionPrepData` — they live on `SourcebookScene` only.

---

## Component File Map

### New files
| File | Purpose |
|---|---|
| `src/lib/queue/sourcebook-scene-extraction-queue.ts` | BullMQ queue + job interfaces |
| `src/lib/queue/sourcebook-scene-extraction-worker.ts` | Markdown parsing + SourcebookScene creation |
| `src/components/cockpit/scene-runner.tsx` | Expand/collapse scene card component |
| `src/components/cockpit/scene-context-panel.tsx` | Right panel: This Scene contextual content |
| `src/server/routers/sourcebook-scenes.ts` | tRPC router for sourcebook scene queries |

### Modified files
| File | Change |
|---|---|
| `src/lib/prep-types.ts` | Add `id` to `PrepNpcSchema`; extend `SceneSchema` with 6 new fields |
| `prisma/schema.prisma` | Add `SourcebookScene` model; `HomebrewPDF.sourcebookScenes`; `GameSession.activeSceneIndex` |
| `src/components/session/prep/steps/step-scenes.tsx` | Read-aloud textarea + import drawer + linked entities checklist |
| `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx` | Add `isSceneExpanded` state; inject `SceneRunner`; swap Prep → Scene tab |
| PDF processing worker | Enqueue scene extraction job after `markerProcessed = true` |
| `src/server/routers/sessions.ts` | Add `updateActiveScene`, `getActiveScene` |
| `src/server/routers/index.ts` | Register `sourcebookScenesRouter` |
| `package.json` | Add `worker:sourcebook-scenes` script |

---

## Definition of Done

- [ ] `SourcebookScene` records created when YoRD PDF is re-processed
- [ ] `PrepNpcSchema` has stable `id` field; existing prep data gets ids on first load
- [ ] Scenes step in prep wizard shows read-aloud field + sourcebook import drawer
- [ ] Import drawer auto-suggests next YoRD chapter based on previous sessions' `sourceId` values
- [ ] Cockpit center panel shows `SceneRunner` (expanded on advance, collapses to bar)
- [ ] Clicking into `LiveNotesPanel` collapses the scene card
- [ ] Right panel "Scene" tab updates contextually when scene advances
- [ ] `activeSceneIndex` persists on session — cockpit resumes correct scene on reload
- [ ] Roll table dice roll works client-side in Scene tab
- [ ] E2E test: `tests/workflows/session-scene-runner.workflow.spec.ts`
