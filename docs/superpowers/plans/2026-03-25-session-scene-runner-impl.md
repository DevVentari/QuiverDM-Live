# Session Scene Runner + Sourcebook Scene Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scene-by-scene session running to the cockpit, with read-aloud text surfaced on scene advance, contextual NPCs/secrets/monsters in the right panel, and automatic extraction of chapter structure + read-aloud text from sourcebook PDFs.

**Architecture:** Three phases sharing a data model. Phase 1 extends the prep schema and adds the tRPC surface. Phase 2 adds a BullMQ worker that parses Docling markdown to extract SourcebookScene records. Phase 3 wires the SceneRunner and SceneContextPanel components into the cockpit's center and right panels.

**Tech Stack:** Next.js 15, tRPC v11, Prisma + PostgreSQL, BullMQ + Redis, React, shadcn/ui, Zod

**Spec:** `docs/superpowers/specs/2026-03-25-session-scene-runner-design.md`

---

## Phase 1 — Data Foundation

### Task 1: Extend prep-types.ts + Prisma schema

**Files:**
- Modify: `src/lib/prep-types.ts`
- Modify: `prisma/schema.prisma` (add `SourcebookScene` model, `HomebrewPDF.sourcebookScenes`, `GameSession.activeSceneIndex`)

- [ ] **Step 1: Extend `SceneSchema` in `src/lib/prep-types.ts`**

Replace the existing `SceneSchema` and add `id` to `PrepNpcSchema`:

```typescript
export const PrepNpcSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),  // ADD THIS
  npcId: z.string().optional(),
  name: z.string(),
  role: z.string().optional(),
  motivation: z.string().optional(),
  isNew: z.boolean().optional(),
});

export const SceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(''),
  location: z.string().optional(),
  readAloud: z.string().default(''),             // NEW
  order: z.number().int().default(0),             // NEW
  linkedNpcIds: z.array(z.string()).default([]),       // NEW
  linkedSecretIds: z.array(z.string()).default([]),    // NEW
  linkedMonsterNames: z.array(z.string()).default([]), // NEW
  sourceId: z.string().optional(),               // NEW
});
```

Also update the exported types at the bottom of the file — `PrepNpc` type is auto-derived from `PrepNpcSchema` so no change needed there.

- [ ] **Step 2: Add `SourcebookScene` model to `prisma/schema.prisma`**

Find the `HomebrewPDF` model (around line 1036) and add the relation field after its existing fields:

```prisma
// Inside HomebrewPDF model, add:
sourcebookScenes SourcebookScene[]
```

Add the new model after `HomebrewPDF`:

```prisma
model SourcebookScene {
  id            String   @id @default(cuid())
  pdfId         String
  chapterId     String
  chapterTitle  String
  chapterIndex  Int
  sceneIndex    Int
  title         String
  location      String?
  readAloud     String?  @db.Text
  description   String?  @db.Text
  linkedNpcs    Json     @default("[]")
  linkedMonsters Json    @default("[]")
  rollTables    Json     @default("[]")
  createdAt     DateTime @default(now())

  pdf HomebrewPDF @relation(fields: [pdfId], references: [id], onDelete: Cascade)

  @@index([pdfId, chapterId])
  @@index([pdfId, chapterIndex])
}
```

Add `activeSceneIndex` to the `GameSession` model (NOT `Session` — that is the NextAuth auth table):

```prisma
// Inside GameSession model, add:
activeSceneIndex Int? @default(0)
```

- [ ] **Step 3: Push schema to DB**

```bash
npm run db:push
```

Expected: `All migrations applied. Database is up to date.`

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `SceneSchema`, `PrepNpcSchema`, or `SourcebookScene`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prep-types.ts prisma/schema.prisma
git commit -m "feat(schema): extend SceneSchema with read-aloud + linking fields, add SourcebookScene model"
```

---

### Task 2: Add PrepNpc id migration to prep-workspace.tsx

The `PrepNpc` type now has an `id` field, but existing saved prep data won't have one. This task ensures ids are assigned on first wizard open.

**Files:**
- Modify: `src/components/session/prep/prep-workspace.tsx`

- [ ] **Step 1: Find the data-loading logic in `prep-workspace.tsx`**

Look for where `prepData` is initialised from the server query result. It will look like:
```typescript
const rawSession = sessionQuery.data as any;
const [prepData, setPrepData] = useState<SessionPrepData>(
  SessionPrepDataSchema.safeParse(rawSession?.prepData).data ?? emptyPrepData()
);
```

- [ ] **Step 2: Add migration before setting initial state**

Add a utility function above the component:

```typescript
function migrateNpcIds(data: SessionPrepData): SessionPrepData {
  const needsMigration = data.npcs.some(npc => !npc.id);
  if (!needsMigration) return data;
  return {
    ...data,
    npcs: data.npcs.map(npc => npc.id ? npc : { ...npc, id: npc.npcId ?? crypto.randomUUID() }),
  };
}
```

Then wrap the initial data parse:

```typescript
const parsed = SessionPrepDataSchema.safeParse(rawSession?.prepData).data ?? emptyPrepData();
const [prepData, setPrepData] = useState<SessionPrepData>(migrateNpcIds(parsed));
```

Then trigger an immediate save after mount if migration ran (add a `useEffect` that checks if any NPC lacked an id and calls the existing save mutation with the migrated data).

```typescript
const saveMutation = trpc.sessions.updatePrep.useMutation();

useEffect(() => {
  if (!rawSession?.prepData) return;
  const original = SessionPrepDataSchema.safeParse(rawSession.prepData).data;
  if (!original) return;
  const needsMigration = original.npcs.some((npc: any) => !npc.id);
  if (needsMigration) {
    saveMutation.mutate({ id: sessionId, prepData: migrateNpcIds(original) });
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [sessionId]);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/session/prep/prep-workspace.tsx
git commit -m "feat(prep): migrate PrepNpc records to stable ids on wizard open"
```

---

### Task 3: Add `sourcebook-scenes` tRPC router

**Files:**
- Create: `src/server/routers/sourcebook-scenes.ts`
- Modify: `src/server/routers/_app.ts`

- [ ] **Step 1: Create `src/server/routers/sourcebook-scenes.ts`**

```typescript
import { z } from 'zod';
import { router } from '../trpc';
import { campaignMemberProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { SessionPrepDataSchema } from '@/lib/prep-types';

export const sourcebookScenesRouter = router({
  /**
   * List chapters from a PDF — for the import drawer chapter picker.
   * Returns PDFs from campaign OR personal library of campaign owner.
   */
  getChapters: campaignMemberProcedure
    .input(z.object({ pdfId: z.string() }))
    .query(async ({ input }) => {
      await assertPdfAccess(input.pdfId, input.campaignId);
      const scenes = await prisma.sourcebookScene.findMany({
        where: { pdfId: input.pdfId },
        select: { chapterId: true, chapterTitle: true, chapterIndex: true },
        distinct: ['chapterId'],
        orderBy: { chapterIndex: 'asc' },
      });
      const counts = await prisma.sourcebookScene.groupBy({
        by: ['chapterId'],
        where: { pdfId: input.pdfId },
        _count: { id: true },
      });
      const countMap = Object.fromEntries(counts.map(c => [c.chapterId, c._count.id]));
      return scenes.map(s => ({
        chapterId: s.chapterId,
        chapterTitle: s.chapterTitle,
        chapterIndex: s.chapterIndex,
        sceneCount: countMap[s.chapterId] ?? 0,
      }));
    }),

  /**
   * Get all scenes for a specific chapter — for import drawer scene previews.
   */
  getByChapter: campaignMemberProcedure
    .input(z.object({ pdfId: z.string(), chapterId: z.string() }))
    .query(async ({ input }) => {
      await assertPdfAccess(input.pdfId, input.campaignId);
      return prisma.sourcebookScene.findMany({
        where: { pdfId: input.pdfId, chapterId: input.chapterId },
        orderBy: { sceneIndex: 'asc' },
      });
    }),

  /**
   * Get scenes by their ids — used by cockpit to resolve rollTables for active scene.
   */
  getByIds: campaignMemberProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.ids.length === 0) return [];
      const campaign = await prisma.campaign.findUniqueOrThrow({
        where: { id: input.campaignId },
        select: { ownerId: true },
      });
      return prisma.sourcebookScene.findMany({
        where: {
          id: { in: input.ids },
          pdf: {
            OR: [
              { campaignId: input.campaignId },
              { userId: campaign.ownerId, campaignId: null },
            ],
          },
        },
      });
    }),

  /**
   * List PDFs available to this campaign (campaign-specific + owner's personal library).
   */
  getAvailablePdfs: campaignMemberProcedure
    .query(async ({ input }) => {
      const campaign = await prisma.campaign.findUniqueOrThrow({
        where: { id: input.campaignId },
        select: { ownerId: true },
      });
      return prisma.homebrewPDF.findMany({
        where: {
          OR: [
            { campaignId: input.campaignId },
            { userId: campaign.ownerId, campaignId: null },
          ],
        },
        select: { id: true, filename: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  /**
   * Auto-suggest the next chapter to import based on previous sessions' sourceIds.
   */
  suggestNextChapter: campaignMemberProcedure
    .input(z.object({ pdfId: z.string() }))
    .query(async ({ input }) => {
      // Load all sessions for this campaign and parse their prepData
      const sessions = await prisma.gameSession.findMany({
        where: { campaignId: input.campaignId },
        select: { prepData: true },
      });

      const sourceIds: string[] = [];
      for (const s of sessions) {
        const parsed = SessionPrepDataSchema.safeParse(s.prepData);
        if (!parsed.success) continue;
        for (const scene of parsed.data.scenes) {
          if (scene.sourceId) sourceIds.push(scene.sourceId);
        }
      }

      if (sourceIds.length === 0) {
        // No history — suggest first chapter
        const first = await prisma.sourcebookScene.findFirst({
          where: { pdfId: input.pdfId },
          orderBy: { chapterIndex: 'asc' },
          select: { chapterId: true, chapterIndex: true },
        });
        return first ? { chapterId: first.chapterId, chapterIndex: first.chapterIndex } : null;
      }

      // Find max chapterIndex used
      const usedScenes = await prisma.sourcebookScene.findMany({
        where: { id: { in: sourceIds }, pdfId: input.pdfId },
        select: { chapterIndex: true },
      });
      const maxUsed = Math.max(...usedScenes.map(s => s.chapterIndex));

      // Find next chapter
      const next = await prisma.sourcebookScene.findFirst({
        where: { pdfId: input.pdfId, chapterIndex: { gt: maxUsed } },
        orderBy: { chapterIndex: 'asc' },
        select: { chapterId: true, chapterIndex: true },
      });

      if (next) return { chapterId: next.chapterId, chapterIndex: next.chapterIndex };

      // No next chapter — return last available
      const last = await prisma.sourcebookScene.findFirst({
        where: { pdfId: input.pdfId },
        orderBy: { chapterIndex: 'desc' },
        select: { chapterId: true, chapterIndex: true },
      });
      return last ? { chapterId: last.chapterId, chapterIndex: last.chapterIndex } : null;
    }),
});

/** Validate PDF is accessible to campaign (campaign-specific or owner's personal library). */
async function assertPdfAccess(pdfId: string, campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { ownerId: true },
  });
  const pdf = await prisma.homebrewPDF.findFirstOrThrow({
    where: {
      id: pdfId,
      OR: [
        { campaignId },
        { userId: campaign.ownerId, campaignId: null },
      ],
    },
    select: { id: true },
  });
}
```

- [ ] **Step 2: Register router in `src/server/routers/_app.ts`**

Add the import and registration following the existing pattern:

```typescript
// Add import:
import { sourcebookScenesRouter } from './sourcebook-scenes';

// Add to the router() call:
sourcebookScenes: sourcebookScenesRouter,
```

- [ ] **Step 3: Add `updateActiveScene` and `getActiveScene` to `src/server/routers/sessions.ts`**

Add to the existing `sessionsRouter`:

```typescript
updateActiveScene: campaignDMProcedure
  .input(z.object({ campaignId: z.string(), sessionId: z.string(), sceneIndex: z.number().int().min(0) }))
  .mutation(async ({ input }) => {
    await prisma.gameSession.update({
      where: { id: input.sessionId },
      data: { activeSceneIndex: input.sceneIndex },
    });
  }),

getActiveScene: campaignMemberProcedure
  .input(z.object({ sessionId: z.string() }))
  .query(async ({ input }) => {
    const session = await prisma.gameSession.findUniqueOrThrow({
      where: { id: input.sessionId },
      select: { activeSceneIndex: true },
    });
    return { sceneIndex: session.activeSceneIndex ?? 0 };
  }),
```

Note: `campaignDMProcedure` and `campaignMemberProcedure` are already imported in `sessions.ts`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors on new router files.

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/sourcebook-scenes.ts src/server/routers/_app.ts src/server/routers/sessions.ts
git commit -m "feat(api): add sourcebook-scenes router and session activeSceneIndex endpoints"
```

---

### Task 4: Enhance `step-scenes.tsx` — read-aloud field + linked entities

**Files:**
- Modify: `src/components/session/prep/steps/step-scenes.tsx`

The current scene card has: scene number, title input, description textarea, location input, delete button.

We're adding: read-aloud textarea, collapsible linked-entities checklist.

- [ ] **Step 1: Update `StepScenes` props to accept `prepData` context**

The component needs access to all prep NPCs, secrets, and monsters to render the linked-entities checklist. Update the props:

```typescript
export function StepScenes({
  sessionId,
  scenes,
  strongStart,
  onChange,
  prepNpcs,         // ADD
  prepSecrets,      // ADD
  prepMonsters,     // ADD
}: {
  sessionId: string;
  scenes: PrepScene[];
  strongStart: string;
  onChange: (scenes: PrepScene[]) => void;
  prepNpcs: PrepNpc[];          // ADD
  prepSecrets: PrepSecret[];    // ADD
  prepMonsters: PrepMonster[];  // ADD
})
```

Update the call site in `prep-workspace.tsx` to pass these (they're already in `prepData`):
```tsx
<StepScenes
  sessionId={sessionId}
  scenes={prepData.scenes}
  strongStart={prepData.strongStart}
  onChange={scenes => updatePrepData({ scenes })}
  prepNpcs={prepData.npcs}
  prepSecrets={prepData.secretsAndClues}
  prepMonsters={prepData.monsters}
/>
```

- [ ] **Step 2: Update `update` function to handle all new fields**

The existing `update` function only handles `keyof PrepScene`. Since we're adding `linkedNpcIds` (an array), replace `update` with a more flexible `updateScene`:

```typescript
const updateScene = (id: string, patch: Partial<PrepScene>) =>
  onChange(scenes.map(scene => scene.id === id ? { ...scene, ...patch } : scene));
```

Also update `addScene` to include the new fields with defaults:
```typescript
const addScene = () =>
  onChange([
    ...scenes,
    {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      location: '',
      readAloud: '',
      order: scenes.length,
      linkedNpcIds: [],
      linkedSecretIds: [],
      linkedMonsterNames: [],
    },
  ]);
```

- [ ] **Step 3: Add `LinkedEntitiesSection` component (inline, same file)**

```typescript
function LinkedEntitiesSection({
  scene,
  prepNpcs,
  prepSecrets,
  prepMonsters,
  onUpdate,
}: {
  scene: PrepScene;
  prepNpcs: PrepNpc[];
  prepSecrets: PrepSecret[];
  prepMonsters: PrepMonster[];
  onUpdate: (patch: Partial<PrepScene>) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggleNpc = (id: string) => {
    const ids = scene.linkedNpcIds ?? [];
    onUpdate({ linkedNpcIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] });
  };

  const toggleSecret = (id: string) => {
    const ids = scene.linkedSecretIds ?? [];
    onUpdate({ linkedSecretIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] });
  };

  const toggleMonster = (name: string) => {
    const names = scene.linkedMonsterNames ?? [];
    onUpdate({ linkedMonsterNames: names.includes(name) ? names.filter(x => x !== name) : [...names, name] });
  };

  const linkedCount = (scene.linkedNpcIds?.length ?? 0) + (scene.linkedSecretIds?.length ?? 0) + (scene.linkedMonsterNames?.length ?? 0);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-400 transition-colors"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        Linked Entities
        {linkedCount > 0 && (
          <span className="ml-1 text-amber-400 font-mono text-[10px]">{linkedCount}</span>
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-3 pl-4 border-l border-border">
          {prepNpcs.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">NPCs</p>
              {prepNpcs.map(npc => (
                <label key={npc.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={(scene.linkedNpcIds ?? []).includes(npc.id)}
                    onChange={() => toggleNpc(npc.id)}
                    className="accent-amber-400"
                  />
                  {npc.name}
                </label>
              ))}
            </div>
          )}
          {prepSecrets.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Secrets</p>
              {prepSecrets.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={(scene.linkedSecretIds ?? []).includes(s.id)}
                    onChange={() => toggleSecret(s.id)}
                    className="accent-amber-400"
                  />
                  <span className="truncate max-w-[200px]">{s.text}</span>
                </label>
              ))}
            </div>
          )}
          {prepMonsters.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Monsters</p>
              {prepMonsters.map(m => (
                <label key={m.name} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={(scene.linkedMonsterNames ?? []).includes(m.name)}
                    onChange={() => toggleMonster(m.name)}
                    className="accent-amber-400"
                  />
                  {m.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add read-aloud textarea to each scene card**

Inside the scene card JSX, after the existing `description` textarea and `location` input, add:

```tsx
{/* Read-aloud */}
<div className="relative">
  <textarea
    value={scene.readAloud ?? ''}
    onChange={e => updateScene(scene.id, { readAloud: e.target.value })}
    placeholder="Read this aloud to your players when the scene begins..."
    rows={3}
    className="w-full resize-none rounded-md border border-amber-400/30 bg-background px-3 py-2 text-sm italic text-amber-100/80 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
    style={{ fontFamily: 'Georgia, serif' }}
  />
  {scene.sourceId && (
    <span className="absolute top-1.5 right-2 text-[9px] text-amber-400/60 uppercase tracking-wider">
      From book
    </span>
  )}
</div>

{/* Linked entities */}
<LinkedEntitiesSection
  scene={scene}
  prepNpcs={prepNpcs}
  prepSecrets={prepSecrets}
  prepMonsters={prepMonsters}
  onUpdate={patch => updateScene(scene.id, patch)}
/>
```

- [ ] **Step 5: Add the import-from-sourcebook button (shell only — full drawer in Task 5)**

At the top of the `StepScenes` return, before the scenes list, add:

```tsx
<div className="flex justify-between items-center mb-2">
  <p className="text-xs text-muted-foreground">Plan the scenes that might unfold this session.</p>
  <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="text-xs gap-1.5">
    <BookOpen className="h-3.5 w-3.5" />
    Import from Sourcebook
  </Button>
</div>
```

Add `const [importOpen, setImportOpen] = useState(false)` at the top of `StepScenes`.
Add `BookOpen` to the lucide imports.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/components/session/prep/steps/step-scenes.tsx src/components/session/prep/prep-workspace.tsx
git commit -m "feat(prep): add read-aloud field and linked entities checklist to scene cards"
```

---

### Task 5: Sourcebook import drawer in StepScenes

**Files:**
- Create: `src/components/session/prep/sourcebook-import-drawer.tsx`
- Modify: `src/components/session/prep/steps/step-scenes.tsx`

- [ ] **Step 1: Create `sourcebook-import-drawer.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import type { PrepScene, PrepNpc, PrepSecret, PrepMonster } from '@/lib/prep-types';

interface SourcebookImportDrawerProps {
  open: boolean;
  onClose: () => void;
  existingSceneCount: number;
  prepNpcs: PrepNpc[];
  prepSecrets: PrepSecret[];
  prepMonsters: PrepMonster[];
  onImport: (scenes: PrepScene[]) => void;
}

type SourcebookScene = {
  id: string;
  title: string;
  location: string | null;
  readAloud: string | null;
  description: string | null;
  linkedNpcs: { name: string; role?: string }[];
  linkedMonsters: { name: string; cr?: string; count: number }[];
};

export function SourcebookImportDrawer({
  open,
  onClose,
  existingSceneCount,
  prepNpcs,
  prepSecrets,
  prepMonsters,
  onImport,
}: SourcebookImportDrawerProps) {
  const { campaignId } = useCampaign();
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set());

  const pdfsQuery = trpc.sourcebookScenes.getAvailablePdfs.useQuery(
    { campaignId },
    { enabled: open }
  );

  const chaptersQuery = trpc.sourcebookScenes.getChapters.useQuery(
    { campaignId, pdfId: selectedPdfId! },
    { enabled: !!selectedPdfId }
  );

  const suggestQuery = trpc.sourcebookScenes.suggestNextChapter.useQuery(
    { campaignId, pdfId: selectedPdfId! },
    { enabled: !!selectedPdfId }
  );

  const chapterScenesQuery = trpc.sourcebookScenes.getByChapter.useQuery(
    { campaignId, pdfId: selectedPdfId!, chapterId: expandedChapterId! },
    { enabled: !!selectedPdfId && !!expandedChapterId }
  );

  // Auto-select first PDF
  useEffect(() => {
    if (pdfsQuery.data && pdfsQuery.data.length > 0 && !selectedPdfId) {
      setSelectedPdfId(pdfsQuery.data[0].id);
    }
  }, [pdfsQuery.data, selectedPdfId]);

  // Auto-expand suggested chapter
  useEffect(() => {
    if (suggestQuery.data && !expandedChapterId) {
      setExpandedChapterId(suggestQuery.data.chapterId);
    }
  }, [suggestQuery.data, expandedChapterId]);

  const toggleScene = (id: string) => {
    setSelectedSceneIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllInChapter = () => {
    if (!chapterScenesQuery.data) return;
    setSelectedSceneIds(prev => {
      const next = new Set(prev);
      chapterScenesQuery.data.forEach(s => next.add(s.id));
      return next;
    });
  };

  const handleImport = () => {
    if (!chapterScenesQuery.data) return;
    const scenesToImport = chapterScenesQuery.data.filter(s => selectedSceneIds.has(s.id));

    // Match linkedNpcs names to prep NPC ids
    const npcByName = Object.fromEntries(prepNpcs.map(n => [n.name.toLowerCase(), n.id]));

    const newScenes: PrepScene[] = scenesToImport.map((s, i) => ({
      id: crypto.randomUUID(),
      title: s.title,
      description: s.description ?? '',
      location: s.location ?? '',
      readAloud: s.readAloud ?? '',
      order: existingSceneCount + i,
      sourceId: s.id,
      linkedNpcIds: s.linkedNpcs
        .map((n: { name: string }) => npcByName[n.name.toLowerCase()])
        .filter(Boolean) as string[],
      linkedSecretIds: [],
      linkedMonsterNames: s.linkedMonsters.map((m: { name: string }) => m.name),
    }));

    onImport(newScenes);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-[480px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-400" />
            Import from Sourcebook
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 mt-4">
          {/* PDF selector */}
          {pdfsQuery.isLoading && <Skeleton className="h-8 w-full" />}
          {pdfsQuery.data && pdfsQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              No sourcebook PDFs found for this campaign. Upload a PDF from the Homebrew page first.
            </p>
          )}
          {pdfsQuery.data && pdfsQuery.data.length > 1 && (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Sourcebook</p>
              <div className="flex gap-2 flex-wrap">
                {pdfsQuery.data.map(pdf => (
                  <button
                    key={pdf.id}
                    onClick={() => { setSelectedPdfId(pdf.id); setExpandedChapterId(null); setSelectedSceneIds(new Set()); }}
                    className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                      selectedPdfId === pdf.id
                        ? 'border-amber-400 text-amber-400 bg-amber-400/10'
                        : 'border-border text-muted-foreground hover:border-amber-400/50'
                    }`}
                  >
                    {pdf.filename}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chapter list */}
          {chaptersQuery.isLoading && <Skeleton className="h-32 w-full" />}
          {chaptersQuery.data?.map(chapter => {
            const isSuggested = suggestQuery.data?.chapterId === chapter.chapterId;
            const isExpanded = expandedChapterId === chapter.chapterId;
            return (
              <div
                key={chapter.chapterId}
                className={`rounded-lg border ${isSuggested ? 'border-amber-400/50' : 'border-border'}`}
              >
                <button
                  onClick={() => setExpandedChapterId(isExpanded ? null : chapter.chapterId)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <span className="text-sm font-medium flex-1">{chapter.chapterTitle}</span>
                  <span className="text-xs text-muted-foreground">{chapter.sceneCount} scenes</span>
                  {isSuggested && (
                    <span className="text-[10px] text-amber-400 uppercase tracking-wider ml-1">Suggested</span>
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-3 py-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">Select scenes to import:</p>
                      <button onClick={selectAllInChapter} className="text-xs text-amber-400 hover:underline">
                        Select all
                      </button>
                    </div>
                    {chapterScenesQuery.isLoading && <Skeleton className="h-20 w-full" />}
                    {chapterScenesQuery.data?.map(scene => (
                      <label key={scene.id} className="flex items-start gap-2.5 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={selectedSceneIds.has(scene.id)}
                          onChange={() => toggleScene(scene.id)}
                          className="mt-0.5 accent-amber-400"
                        />
                        <div>
                          <p className="text-sm">{scene.title}</p>
                          {scene.location && (
                            <p className="text-xs text-muted-foreground">{scene.location}</p>
                          )}
                          {scene.readAloud && (
                            <p className="text-xs italic text-amber-100/60 mt-0.5 line-clamp-2">
                              "{scene.readAloud}"
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-3 flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{selectedSceneIds.size} scene{selectedSceneIds.size !== 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              disabled={selectedSceneIds.size === 0}
              onClick={handleImport}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              Import {selectedSceneIds.size > 0 ? selectedSceneIds.size : ''} Scene{selectedSceneIds.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Wire the drawer into `step-scenes.tsx`**

Add the import and render the drawer at the end of `StepScenes`:

```typescript
import { SourcebookImportDrawer } from '../sourcebook-import-drawer';
```

Inside the component return, add after the scenes list:

```tsx
<SourcebookImportDrawer
  open={importOpen}
  onClose={() => setImportOpen(false)}
  existingSceneCount={scenes.length}
  prepNpcs={prepNpcs}
  prepSecrets={prepSecrets}
  prepMonsters={prepMonsters}
  onImport={importedScenes => onChange([...scenes, ...importedScenes])}
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/session/prep/sourcebook-import-drawer.tsx src/components/session/prep/steps/step-scenes.tsx
git commit -m "feat(prep): add sourcebook import drawer to scenes step"
```

---

## Phase 2 — Extraction Pipeline

### Task 6: Sourcebook scene extraction queue + worker

**Files:**
- Create: `src/lib/queue/sourcebook-scene-extraction-queue.ts`
- Create: `src/lib/queue/sourcebook-scene-extraction-worker.ts`
- Modify: `package.json`

- [ ] **Step 1: Create the queue file**

`src/lib/queue/sourcebook-scene-extraction-queue.ts`:

```typescript
import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env.local' });

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface SourcebookSceneExtractionJobData {
  pdfId: string;
  markdownContent: string;
}

export interface SourcebookSceneExtractionJobResult {
  scenesCreated: number;
  chaptersFound: number;
  tablesFound: number;
}

export const sourcebookSceneExtractionQueue = new Queue<
  SourcebookSceneExtractionJobData,
  SourcebookSceneExtractionJobResult
>('sourcebook-scene-extraction', {
  connection: getRedisConnection() as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: { age: 24 * 3600, count: 100 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

export async function addSourcebookSceneExtractionJob(data: SourcebookSceneExtractionJobData) {
  return sourcebookSceneExtractionQueue.add(
    `sourcebook-extract-${data.pdfId}`,
    data,
    { jobId: `sourcebook-extract-${data.pdfId}` }
  );
}
```

- [ ] **Step 2: Create the worker**

`src/lib/queue/sourcebook-scene-extraction-worker.ts`:

```typescript
import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env.local' });

import { Worker } from 'bullmq';
import { getRedisConnection } from './queue';
import { prisma } from '@/lib/prisma';
import type { SourcebookSceneExtractionJobData, SourcebookSceneExtractionJobResult } from './sourcebook-scene-extraction-queue';

// ─── Markdown parsing helpers ───────────────────────────────────────────────

const CHAPTER_RE = /^#{1,2}\s+(?:chapter\s+\d+[:\s]+)?(.+)$/i;
const SCENE_RE   = /^#{3,4}\s+(.+)$/;
const DIE_RE     = /\b(d4|d6|d8|d10|d12|d20|d100)\b/i;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

interface ParsedScene {
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  sceneIndex: number;
  title: string;
  location: string | undefined;
  readAloud: string;
  description: string;
  rollTables: { name: string; die: string; entries: string[] }[];
}

function parseMarkdown(markdown: string): ParsedScene[] {
  const lines = markdown.split('\n');
  const scenes: ParsedScene[] = [];

  let chapterId = 'main';
  let chapterTitle = 'Main';
  let chapterIndex = -1;
  let sceneTitle = '';
  let sceneIndex = -1;
  let readAloud = '';
  let description = '';
  let rollTables: ParsedScene['rollTables'] = [];
  let inBlockquote = false;
  let currentBlockquote = '';
  let currentTable: { name: string; die: string; entries: string[] } | null = null;
  let hasChapters = false;

  const flushScene = () => {
    if (!sceneTitle) return;
    scenes.push({
      chapterId,
      chapterTitle,
      chapterIndex,
      sceneIndex,
      title: sceneTitle.trim(),
      location: undefined,
      readAloud: readAloud.trim(),
      description: description.trim(),
      rollTables,
    });
    sceneTitle = '';
    readAloud = '';
    description = '';
    rollTables = [];
    currentTable = null;
  };

  const flushBlockquote = () => {
    if (currentBlockquote.trim()) {
      readAloud += (readAloud ? '\n\n' : '') + currentBlockquote.trim();
    }
    currentBlockquote = '';
    inBlockquote = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Chapter heading (H1 or H2)
    const chapterMatch = trimmed.match(CHAPTER_RE);
    if (chapterMatch && (trimmed.startsWith('# ') || trimmed.startsWith('## '))) {
      flushBlockquote();
      flushScene();
      hasChapters = true;
      chapterIndex++;
      sceneIndex = -1;
      chapterTitle = chapterMatch[1].trim();
      chapterId = slugify(chapterTitle);
      continue;
    }

    // Scene heading (H3 or H4)
    const sceneMatch = trimmed.match(SCENE_RE);
    if (sceneMatch) {
      flushBlockquote();
      flushScene();
      sceneIndex++;
      sceneTitle = sceneMatch[1].trim();
      continue;
    }

    // Blockquote (read-aloud)
    if (trimmed.startsWith('> ')) {
      inBlockquote = true;
      currentBlockquote += (currentBlockquote ? '\n' : '') + trimmed.slice(2);
      continue;
    }

    if (inBlockquote && trimmed === '') {
      // Empty line ends blockquote
      flushBlockquote();
      continue;
    }

    if (inBlockquote) {
      // Continuation without > prefix (some markdown renderers)
      currentBlockquote += ' ' + trimmed;
      continue;
    }

    // Markdown table row
    if (trimmed.startsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        // Header row — check for die notation
        if (!currentTable) {
          const dieMatch = trimmed.match(DIE_RE);
          if (dieMatch) {
            currentTable = { name: sceneTitle || 'Random Table', die: dieMatch[1].toLowerCase(), entries: [] };
          }
        } else if (trimmed.includes('---')) {
          // Separator row — skip
        } else {
          // Data row — last cell is the entry
          currentTable.entries.push(cells[cells.length - 1]);
        }
      }
      continue;
    }

    // End of table
    if (currentTable && !trimmed.startsWith('|') && trimmed !== '') {
      rollTables.push(currentTable);
      currentTable = null;
    }

    // Body text → description
    if (trimmed && sceneTitle) {
      description += (description ? ' ' : '') + trimmed;
    }
  }

  flushBlockquote();
  flushScene();

  // If no chapters were detected, assign chapterIndex 0 to all scenes
  if (!hasChapters) {
    return scenes.map(s => ({ ...s, chapterIndex: 0 }));
  }

  // Ensure chapterIndex starts at 0
  const minIdx = Math.min(...scenes.map(s => s.chapterIndex));
  return scenes.map(s => ({ ...s, chapterIndex: s.chapterIndex - minIdx }));
}

// ─── Worker ─────────────────────────────────────────────────────────────────

export async function processSourcebookSceneExtraction(
  data: SourcebookSceneExtractionJobData
): Promise<SourcebookSceneExtractionJobResult> {
  const { pdfId, markdownContent } = data;

  // Delete existing scenes for re-ingestion
  await prisma.sourcebookScene.deleteMany({ where: { pdfId } });

  const parsed = parseMarkdown(markdownContent);

  if (parsed.length === 0) {
    console.log(`[sourcebook-scene-extraction] No scenes found in PDF ${pdfId}`);
    return { scenesCreated: 0, chaptersFound: 0, tablesFound: 0 };
  }

  const chapters = new Set(parsed.map(s => s.chapterId)).size;
  const tables = parsed.reduce((n, s) => n + s.rollTables.length, 0);

  await prisma.sourcebookScene.createMany({
    data: parsed.map(s => ({
      pdfId,
      chapterId: s.chapterId,
      chapterTitle: s.chapterTitle,
      chapterIndex: s.chapterIndex,
      sceneIndex: s.sceneIndex,
      title: s.title,
      location: s.location ?? null,
      readAloud: s.readAloud || null,
      description: s.description || null,
      linkedNpcs: [],
      linkedMonsters: [],
      rollTables: s.rollTables,
    })),
  });

  console.log(`[sourcebook-scene-extraction] PDF ${pdfId}: ${parsed.length} scenes, ${chapters} chapters, ${tables} tables`);
  return { scenesCreated: parsed.length, chaptersFound: chapters, tablesFound: tables };
}

const worker = new Worker<SourcebookSceneExtractionJobData, SourcebookSceneExtractionJobResult>(
  'sourcebook-scene-extraction',
  async job => processSourcebookSceneExtraction(job.data),
  { connection: getRedisConnection() as any, concurrency: 2 }
);

worker.on('completed', job => {
  console.log(`[sourcebook-scene-extraction] Completed: ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[sourcebook-scene-extraction] Failed: ${job?.id}`, err);
});

process.on('SIGTERM', async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
```

- [ ] **Step 3: Add npm script to `package.json`**

Find the `"worker:ddb-sync"` line and add after it:

```json
"worker:sourcebook-scenes": "tsx src/lib/queue/sourcebook-scene-extraction-worker.ts",
```

- [ ] **Step 4: Trigger extraction from PDF processing worker**

In `src/lib/queue/worker.ts`, find the block at line 535 where `markerProcessed: true` is set. After the `prisma.homebrewPDF.update(...)` call that sets `markerProcessed`, add:

```typescript
import { addSourcebookSceneExtractionJob } from './sourcebook-scene-extraction-queue';

// After the update that sets markerProcessed: true:
// Use the variables already in scope at that point:
//   - `markdownContent` (local const from result.markdown)
//   - `data.pdfId` (from the BullMQ job data)
if (markdownContent) {
  await addSourcebookSceneExtractionJob({
    pdfId: data.pdfId,
    markdownContent,
  });
  console.log(`[worker] Queued sourcebook scene extraction for PDF ${data.pdfId}`);
}

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manually test parser on a small markdown snippet**

```typescript
// Quick smoke test — add to bottom of worker file temporarily, then remove
const testMd = `
## Chapter 1: The Dragon's Lair

### Scene 1: Entry Hall

> As you push open the iron door, the stench of rot washes over you.

The entry hall stretches into shadow.

| d6 | Guard Patrol |
|----|------|
| 1 | 2 guards |
| 2-3 | Empty |
`;
const result = parseMarkdown(testMd);
console.log(JSON.stringify(result, null, 2));
```

Run: `npx tsx src/lib/queue/sourcebook-scene-extraction-worker.ts`
Expected: 1 chapter, 1 scene, readAloud set, 1 roll table with 2 entries.

Remove the test code after verifying.

- [ ] **Step 7: Commit**

```bash
git add src/lib/queue/sourcebook-scene-extraction-queue.ts src/lib/queue/sourcebook-scene-extraction-worker.ts src/lib/queue/worker.ts package.json
git commit -m "feat(pipeline): add sourcebook scene extraction BullMQ worker with markdown parser"
```

---

## Phase 3 — Cockpit Scene Runner

### Task 7: `SceneRunner` component

**Files:**
- Create: `src/components/cockpit/scene-runner.tsx`

- [ ] **Step 1: Create `src/components/cockpit/scene-runner.tsx`**

```typescript
'use client';

import type { PrepScene } from '@/lib/prep-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SceneRunnerProps {
  scenes: PrepScene[];
  activeIndex: number;
  isExpanded: boolean;
  onNavigate: (index: number) => void;
  onExpandToggle: (expanded: boolean) => void;
}

export function SceneRunner({
  scenes,
  activeIndex,
  isExpanded,
  onNavigate,
  onExpandToggle,
}: SceneRunnerProps) {
  const scene = scenes[activeIndex];

  if (!scene || scenes.length === 0) {
    return (
      <div
        className="px-4 py-2 border-b border-border text-xs text-muted-foreground"
        style={{ background: 'hsl(35 20% 5%)' }}
      >
        No scenes prepared for this session.
        {' '}<a href="#" className="text-amber-400 hover:underline" onClick={e => { e.preventDefault(); }}>Add scenes in prep →</a>
      </div>
    );
  }

  const canPrev = activeIndex > 0;
  const canNext = activeIndex < scenes.length - 1;

  if (!isExpanded) {
    // Collapsed: slim bar
    const preview = scene.readAloud?.slice(0, 60);
    return (
      <div
        className="flex items-center gap-3 px-3 py-2 border-b border-border cursor-pointer hover:bg-white/5 transition-colors"
        style={{ background: 'hsl(35 15% 5%)' }}
        onClick={() => onExpandToggle(true)}
      >
        <span className="text-[10px] text-amber-400/60 uppercase tracking-wider shrink-0">
          {activeIndex + 1}/{scenes.length}
        </span>
        <span className="text-xs font-medium text-amber-100/70 shrink-0">{scene.title}</span>
        {preview && (
          <span className="text-xs text-amber-100/30 italic truncate hidden sm:block">
            "{preview}{(scene.readAloud?.length ?? 0) > 60 ? '…' : ''}"
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            disabled={!canPrev}
            onClick={e => { e.stopPropagation(); onNavigate(activeIndex - 1); }}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={!canNext}
            onClick={e => { e.stopPropagation(); onNavigate(activeIndex + 1); }}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-amber-400"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded: full scene card
  return (
    <div
      className="border-b border-amber-400/20 px-4 pt-3 pb-4"
      style={{ background: 'hsl(35 20% 5%)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-400 uppercase tracking-wider font-medium">
            Scene {activeIndex + 1} of {scenes.length}
          </span>
          {scene.location && (
            <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full border border-border">
              {scene.location}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            disabled={!canPrev}
            onClick={() => onNavigate(activeIndex - 1)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-border hover:border-amber-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            Prev
          </button>
          <button
            disabled={!canNext}
            onClick={() => onNavigate(activeIndex + 1)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-amber-400 text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Read-aloud block */}
      {scene.readAloud ? (
        <div
          className="rounded-md px-4 py-3"
          style={{
            background: 'hsl(35 25% 7%)',
            borderLeft: '2px solid hsl(35 60% 55% / 0.6)',
          }}
        >
          <p className="text-[9px] uppercase tracking-widest text-amber-400/60 mb-2">Read Aloud</p>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'hsl(35 30% 88%)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
          >
            {scene.readAloud}
          </p>
        </div>
      ) : (
        <div
          className="rounded-md px-4 py-3 border border-dashed border-border"
        >
          <p className="text-xs text-muted-foreground/50 italic">No read-aloud text for this scene.</p>
        </div>
      )}

      {/* Source credit + collapse hint */}
      <div className="flex items-center justify-between mt-2">
        {scene.sourceId ? (
          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">From sourcebook</span>
        ) : (
          <span />
        )}
        <button
          onClick={() => onExpandToggle(false)}
          className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          collapse ↑
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cockpit/scene-runner.tsx
git commit -m "feat(cockpit): add SceneRunner component with expand/collapse read-aloud card"
```

---

### Task 8: `SceneContextPanel` component

**Files:**
- Create: `src/components/cockpit/scene-context-panel.tsx`

This replaces `PrepReferencePanel` in the cockpit's right panel. Shows scene-contextual NPCs, secrets, monsters, and roll tables.

- [ ] **Step 1: Create `src/components/cockpit/scene-context-panel.tsx`**

```typescript
'use client';

import { useState } from 'react';
import type { SessionPrepData, PrepScene } from '@/lib/prep-types';
import { Users, Eye, Swords, Dices } from 'lucide-react';

interface SourcebookSceneData {
  id: string;
  rollTables: { name: string; die: string; entries: string[] }[];
  linkedNpcs: { name: string; role?: string }[];
  linkedMonsters: { name: string; cr?: string; count: number }[];
}

interface SceneContextPanelProps {
  activeScene: PrepScene | null;
  prepData: SessionPrepData | null;
  sourcebookScenes: SourcebookSceneData[];  // from sourcebookScenes.getByIds
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">{title}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function EntityChip({ name, subtitle, auto }: { name: string; subtitle?: string; auto?: boolean }) {
  return (
    <div className="rounded px-2 py-1.5 text-xs border border-border bg-card/50">
      <div className="flex items-center gap-1">
        {auto && <span className="text-muted-foreground/50">~</span>}
        <span className={auto ? 'text-muted-foreground' : ''}>{name}</span>
      </div>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

function RollTableWidget({ table }: { table: { name: string; die: string; entries: string[] } }) {
  const [result, setResult] = useState<string | null>(null);
  const sides = parseInt(table.die.replace('d', ''), 10);
  const roll = () => {
    const idx = Math.floor(Math.random() * table.entries.length);
    setResult(table.entries[idx] ?? String(Math.ceil(Math.random() * sides)));
  };
  return (
    <div className="rounded px-2 py-1.5 border border-border bg-card/50">
      <div className="flex items-center justify-between">
        <span className="text-xs text-amber-400/80">{table.name}</span>
        <button
          onClick={roll}
          className="text-[10px] px-2 py-0.5 rounded border border-amber-400/50 text-amber-400 hover:bg-amber-400/10 transition-colors"
        >
          {table.die}
        </button>
      </div>
      {result && (
        <p className="text-xs mt-1.5 px-2 py-1 rounded bg-amber-400/15 text-amber-200 border border-amber-400/20">
          → {result}
        </p>
      )}
    </div>
  );
}

export function SceneContextPanel({ activeScene, prepData, sourcebookScenes }: SceneContextPanelProps) {
  if (!activeScene || !prepData) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <Swords className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground italic">No scene active</p>
      </div>
    );
  }

  const sceneText = [activeScene.title, activeScene.description, activeScene.location]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Resolve manually linked items
  const linkedNpcs = prepData.npcs.filter(n => (activeScene.linkedNpcIds ?? []).includes(n.id));
  const linkedSecrets = prepData.secretsAndClues.filter(s => (activeScene.linkedSecretIds ?? []).includes(s.id));
  const linkedMonsters = prepData.monsters.filter(m => (activeScene.linkedMonsterNames ?? []).includes(m.name));

  // Auto-match
  const autoNpcs = prepData.npcs.filter(n =>
    !linkedNpcs.includes(n) && sceneText.includes(n.name.toLowerCase())
  );
  const autoSecrets = prepData.secretsAndClues.filter(s =>
    !linkedSecrets.includes(s) &&
    s.linkedTo != null &&
    activeScene.location != null &&
    normalize(s.linkedTo) === normalize(activeScene.location)
  );
  const autoMonsters = prepData.monsters.filter(m =>
    !linkedMonsters.includes(m) && sceneText.includes(m.name.toLowerCase())
  );

  // Sourcebook data for this scene
  const sbScene = activeScene.sourceId
    ? sourcebookScenes.find(s => s.id === activeScene.sourceId)
    : null;
  const rollTables = (sbScene?.rollTables ?? []) as { name: string; die: string; entries: string[] }[];

  const allNpcs = [...linkedNpcs, ...autoNpcs];
  const allSecrets = [...linkedSecrets, ...autoSecrets];
  const allMonsters = [...linkedMonsters, ...autoMonsters];

  const isEmpty = allNpcs.length === 0 && allSecrets.length === 0 && allMonsters.length === 0 && rollTables.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2 px-3">
        <Swords className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground italic">
          No content linked to this scene.
          <br />
          <span className="text-[10px]">Tag NPCs, secrets, and monsters in prep to surface them here.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allNpcs.length > 0 && (
        <Section icon={Users} title="NPCs">
          {allNpcs.map(n => (
            <EntityChip
              key={n.id}
              name={n.name}
              subtitle={n.role}
              auto={autoNpcs.includes(n)}
            />
          ))}
        </Section>
      )}

      {allMonsters.length > 0 && (
        <Section icon={Swords} title="Encounter">
          {allMonsters.map(m => (
            <EntityChip
              key={m.name}
              name={`${m.count > 1 ? `${m.count}× ` : ''}${m.name}`}
              subtitle={m.cr ? `CR ${m.cr}` : undefined}
              auto={autoMonsters.includes(m)}
            />
          ))}
        </Section>
      )}

      {allSecrets.length > 0 && (
        <Section icon={Eye} title="Secrets">
          {allSecrets.map(s => (
            <div
              key={s.id}
              className={`rounded px-2 py-1.5 text-xs border border-border bg-card/50 ${autoSecrets.includes(s) ? 'opacity-70' : ''}`}
            >
              <p className="leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </Section>
      )}

      {rollTables.length > 0 && (
        <Section icon={Dices} title="Tables">
          {rollTables.map((t, i) => (
            <RollTableWidget key={i} table={t} />
          ))}
        </Section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cockpit/scene-context-panel.tsx
git commit -m "feat(cockpit): add SceneContextPanel with auto-match and roll tables"
```

---

### Task 9: Wire SceneRunner + SceneContextPanel into the cockpit

**Files:**
- Modify: `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx`

- [ ] **Step 1: Add state and data fetching to `live/page.tsx`**

Add these imports at the top:

```typescript
import { SceneRunner } from '@/components/cockpit/scene-runner';
import { SceneContextPanel } from '@/components/cockpit/scene-context-panel';
import { useEffect, useRef } from 'react';
```

Inside the component, after the existing `const [mode, setMode] = useState<'rp' | 'combat'>('rp')`:

```typescript
// Scene runner state
const [activeSceneIndex, setActiveSceneIndex] = useState(0);
const [isSceneExpanded, setIsSceneExpanded] = useState(false);
const prevSceneIndexRef = useRef(activeSceneIndex);

// Initialise from persisted session value
useEffect(() => {
  const session = sessionQuery.data as any;
  if (session?.activeSceneIndex != null) {
    setActiveSceneIndex(session.activeSceneIndex);
  }
}, [sessionQuery.data]);

// Expand card whenever scene advances
useEffect(() => {
  if (activeSceneIndex !== prevSceneIndexRef.current) {
    setIsSceneExpanded(true);
    prevSceneIndexRef.current = activeSceneIndex;
  }
}, [activeSceneIndex]);

// Persist active scene
const updateActiveScene = trpc.sessions.updateActiveScene.useMutation();
const debouncedUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleNavigate = (index: number) => {
  setActiveSceneIndex(index);
  if (debouncedUpdateRef.current) clearTimeout(debouncedUpdateRef.current);
  debouncedUpdateRef.current = setTimeout(() => {
    if (campaignId) {
      updateActiveScene.mutate({ campaignId, sessionId, sceneIndex: index });
    }
  }, 500);
};
```

Fetch sourcebook scenes for cockpit:

```typescript
const scenes = prepData?.scenes ?? [];
const sourceIds = scenes.map(s => s.sourceId).filter(Boolean) as string[];
const sourcebookScenesQuery = trpc.sourcebookScenes.getByIds.useQuery(
  { campaignId: campaignId ?? '', ids: sourceIds },
  { enabled: !!campaignId && sourceIds.length > 0 }
);
const sourcebookScenes = (sourcebookScenesQuery.data ?? []) as any[];
```

- [ ] **Step 2: Update the center panel JSX**

Replace the center panel section (the `flex-1 overflow-hidden flex flex-col` div):

```tsx
{/* Center: SceneRunner + RP or Combat */}
<div className="flex-1 overflow-hidden flex flex-col">
  {/* Scene runner always visible above notes/combat */}
  <SceneRunner
    scenes={scenes.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))}
    activeIndex={activeSceneIndex}
    isExpanded={isSceneExpanded}
    onNavigate={handleNavigate}
    onExpandToggle={setIsSceneExpanded}
  />

  {/* Notes/combat below, click collapses scene card */}
  <div
    className="flex-1 overflow-hidden"
    onClick={() => setIsSceneExpanded(false)}
  >
    {mode === 'rp' ? (
      <LiveNotesPanel
        sessionId={sessionId}
        initialNotes={session.quickNotes ?? ''}
        dmHints={transcription.dmHints}
      />
    ) : (
      <CombatPanel sessionId={sessionId} />
    )}
  </div>
</div>
```

- [ ] **Step 3: Replace "Prep" tab with "Scene" tab in right panel**

Replace `TabsTrigger value="prep"` and its `TabsContent` with:

```tsx
<TabsTrigger value="scene" className="flex-1 text-xs">Scene</TabsTrigger>
```

```tsx
<TabsContent value="scene" className="flex-1 overflow-y-auto m-0 p-3">
  <SceneContextPanel
    activeScene={scenes[activeSceneIndex] ?? null}
    prepData={prepData}
    sourcebookScenes={sourcebookScenes}
  />
</TabsContent>
```

Change `defaultValue="prep"` to `defaultValue="scene"` on the `Tabs` component.

Also remove the `PrepReferencePanel` import since it's no longer used.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Run build to catch any remaining errors**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(session\)/campaigns/\[slug\]/sessions/\[sessionId\]/live/page.tsx
git commit -m "feat(cockpit): wire SceneRunner + SceneContextPanel into cockpit, replace Prep tab with Scene tab"
```

---

### Task 10: E2E test

> **TDD note:** Create this file at the start of the feature branch so tests exist as failing stubs from the beginning. The tests will fail until their respective phases are implemented. Run after each phase to confirm progress.

**Files:**
- Create: `tests/workflows/session-scene-runner.workflow.spec.ts`

- [ ] **Step 1: Create the E2E test**

```typescript
import { test, expect } from '@playwright/test';
import { signInAsTestUser } from '../helpers/auth';

const BASE = process.env.BASE_URL ?? 'http://localhost:3847';
const CAMPAIGN_SLUG = 'year-of-rogue-dragons';

test.describe('Session Scene Runner', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page, 'vic');
  });

  test('prep wizard scenes step shows read-aloud textarea', async ({ page }) => {
    await page.goto(`${BASE}/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('networkidle');

    // Open first session's prep
    const prepLink = page.locator('a[href*="/prep"]').first();
    await expect(prepLink).toBeVisible({ timeout: 10000 });
    await prepLink.click();
    await page.waitForLoadState('networkidle');

    // Navigate to scenes step
    const scenesNav = page.getByText('Scenes', { exact: false }).first();
    await scenesNav.click();
    await page.waitForTimeout(500);

    // Verify read-aloud textarea is present
    await expect(page.locator('textarea[placeholder*="Read this aloud"]')).toBeVisible({ timeout: 5000 });
  });

  test('prep wizard scenes step has Import from Sourcebook button', async ({ page }) => {
    await page.goto(`${BASE}/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('networkidle');

    const prepLink = page.locator('a[href*="/prep"]').first();
    await expect(prepLink).toBeVisible({ timeout: 10000 });
    await prepLink.click();
    await page.waitForLoadState('networkidle');

    const scenesNav = page.getByText('Scenes', { exact: false }).first();
    await scenesNav.click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Import from Sourcebook')).toBeVisible({ timeout: 5000 });
  });

  test('cockpit shows scene runner above live notes', async ({ page }) => {
    await page.goto(`${BASE}/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('networkidle');

    // Click into a session's live cockpit
    const liveLink = page.locator('a[href*="/live"]').first();
    if (!(await liveLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Some sessions may not have a /live link visible — skip
      test.skip();
      return;
    }
    await liveLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Scene runner bar should be visible (collapsed or expanded)
    // Look for scene counter or "No scenes prepared" fallback
    const hasScenes = await page.locator('text=/Scene \\d+ of \\d+/').isVisible({ timeout: 5000 }).catch(() => false);
    const hasNoScenes = await page.getByText('No scenes prepared').isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasScenes || hasNoScenes).toBe(true);
  });

  test('cockpit right panel has Scene tab', async ({ page }) => {
    await page.goto(`${BASE}/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('networkidle');

    const liveLink = page.locator('a[href*="/live"]').first();
    if (!(await liveLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await liveLink.click();
    await page.waitForLoadState('networkidle');

    // Right panel should have "Scene" tab (not "Prep")
    await expect(page.getByRole('tab', { name: 'Scene' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('tab', { name: 'Prep' })).not.toBeVisible();
  });

  test('scene navigation advances to next scene', async ({ page }) => {
    await page.goto(`${BASE}/campaigns/${CAMPAIGN_SLUG}/sessions`);
    await page.waitForLoadState('networkidle');

    const liveLink = page.locator('a[href*="/live"]').first();
    if (!(await liveLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await liveLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const sceneCounter = page.locator('text=/Scene \\d+ of \\d+/').first();
    if (!(await sceneCounter.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); // No scenes in this session
      return;
    }

    const initialText = await sceneCounter.textContent();
    const match = initialText?.match(/Scene (\d+) of (\d+)/);
    if (!match || parseInt(match[2]) < 2) {
      test.skip(); // Only 1 scene, can't navigate
      return;
    }

    // Click "Next" to advance
    const nextBtn = page.getByRole('button', { name: /Next/i }).first();
    await nextBtn.click();
    await page.waitForTimeout(500);

    const newText = await sceneCounter.textContent();
    expect(newText).toContain('Scene 2 of');
  });
});
```

- [ ] **Step 2: Run the test against production**

```bash
BASE_URL=https://quiverdm.com npx playwright test tests/workflows/session-scene-runner.workflow.spec.ts --project=chromium
```

Expected: Tests 1-2 pass (prep wizard). Tests 3-5 may skip if no live sessions exist — that's acceptable. No failures.

- [ ] **Step 3: Commit**

```bash
git add tests/workflows/session-scene-runner.workflow.spec.ts
git commit -m "test(e2e): add session scene runner workflow spec"
git push origin main
```

---

## Definition of Done Checklist

- [ ] `SourcebookScene` records created when YoRD PDF is re-processed (`npm run worker:sourcebook-scenes` with a test PDF)
- [ ] `PrepNpcSchema` has stable `id` field; migration runs on wizard open
- [ ] Scenes step shows read-aloud textarea + "From book" badge when `sourceId` is set
- [ ] "Import from Sourcebook" button opens drawer with auto-suggested chapter highlighted
- [ ] Cockpit center panel shows `SceneRunner` above live notes
- [ ] Clicking into notes collapses the scene card
- [ ] Right panel "Scene" tab updates contextually when scene advances
- [ ] `activeSceneIndex` persists — cockpit resumes correct scene on reload
- [ ] Roll table dice roll works client-side in Scene tab
- [ ] E2E test suite passes: `npx playwright test tests/workflows/session-scene-runner.workflow.spec.ts`
