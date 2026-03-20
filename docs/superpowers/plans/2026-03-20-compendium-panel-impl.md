# Compendium Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global DM-only Compendium Panel — a sidebar-triggered slide-over that lets DMs browse, search, and act on all imported sourcebook content (encounters, monsters, chapters) from any page in the app.

**Architecture:** A Zustand store controls open/close and selection state. `CompendiumPanel` (Sheet from left) renders in `app-shell.tsx` globally. Two-pane layout: left tab list, right detail pane with context-aware action buttons. New tRPC endpoints `getBySourcebook` and `markAsRun` on the encounter-plans router.

**Tech Stack:** Next.js 15, tRPC v11, Prisma, Zustand v5, shadcn/ui Sheet, Tailwind, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-20-compendium-panel-design.md`

---

## File Map

**Create:**
- `src/store/compendium-store.ts` — Zustand open/tab/selection state
- `src/components/compendium/compendium-panel.tsx` — Sheet wrapper, two-pane layout
- `src/components/compendium/encounters-tab.tsx` — Encounter list grouped by chapter
- `src/components/compendium/monsters-tab.tsx` — Monster search list
- `src/components/compendium/chapters-tab.tsx` — Read-only chapter list
- `src/components/compendium/items-tab.tsx` — Stub tab
- `src/components/compendium/detail-pane.tsx` — Detail + context-aware actions

**Modify:**
- `prisma/schema.prisma` — Add `lastRunAt`, `timesRun`, `lastRunSessionId` to `EncounterPlan`
- `src/server/repositories/encounter-plan.repository.ts` — Add `ddbChapterId` to `create`/`update` signatures; add `getBySourcebook`/`markAsRun` methods
- `src/server/services/encounter-plan.service.ts` — Pass-through for new fields; add `getBySourcebook`/`markAsRun`
- `src/server/routers/encounter-plans.ts` — Add `getBySourcebook` + `markAsRun`; extend `create`/`update` with `ddbChapterId?`; import `campaignDMProcedure`
- `src/app/(app)/app-shell.tsx` — Mount `<CompendiumPanel />` globally
- `src/components/sidebar.tsx` — Add compendium icon + toggle to bottom section (both `Sidebar` and `MobileSidebar`)

---

## Task 1: Schema migration — add run-tracking fields to EncounterPlan

**Files:**
- Modify: `prisma/schema.prisma` (find `EncounterPlan` model, ~line 1190)

- [ ] **Step 1: Add three fields to EncounterPlan in schema.prisma**

Find the `EncounterPlan` model and add after the existing `ddbChapterId` field:

```prisma
lastRunAt        DateTime?
timesRun         Int       @default(0)
lastRunSessionId String?
```

- [ ] **Step 2: Run migration**

```bash
cd E:/Projects/QuiverDM
npx prisma migrate dev --name add-encounter-run-tracking
```

Expected: migration file created in `prisma/migrations/`, Prisma client regenerated, no errors.

- [ ] **Step 3: Verify TypeScript picks up new fields**

```bash
npx tsc --noEmit
```

Expected: no errors related to `EncounterPlan`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add run-tracking fields to EncounterPlan"
```

---

## Task 2: Repository — add ddbChapterId support + getBySourcebook + markAsRun

**Files:**
- Modify: `src/server/repositories/encounter-plan.repository.ts`

- [ ] **Step 1: Extend `create` signature to accept `ddbChapterId`**

In `encounter-plan.repository.ts`, find the `create` method (line ~42). Add `ddbChapterId?: string` to the data parameter type:

```ts
create: (data: {
  campaignId: string;
  name: string;
  aiPrompt?: string;
  sceneDescription?: string;
  tacticalNotes?: string;
  difficulty?: string;
  partySize?: number;
  partyLevel?: number;
  xpBudget?: number;
  totalXp?: number;
  adjustedXp?: number;
  ddbChapterId?: string;    // ← add this
}) =>
  prismaAny.encounterPlan.create({
    data,
    include: planWithCreaturesInclude,
  }),
```

- [ ] **Step 2: Extend `update` signature to accept `ddbChapterId`**

Find the `update` method. Add `ddbChapterId?: string` to its data type.

- [ ] **Step 3: Add `getBySourcebook` repository method**

Add after the `update` method:

```ts
getBySourcebook: async (campaignId: string) => {
  // Get all sourcebook-linked plans for campaign
  const plans = await prismaAny.encounterPlan.findMany({
    where: {
      campaignId,
      ddbChapterId: { not: null },
    },
    select: {
      id: true,
      name: true,
      difficulty: true,
      sceneDescription: true,
      ddbChapterId: true,
      lastRunAt: true,
      timesRun: true,
      _count: { select: { creatures: true } },
    },
    orderBy: { ddbChapterId: 'asc' },
  });

  // Resolve chapter names from HomebrewContent type='location'
  const chapterIds = [...new Set(plans.map((p: any) => p.ddbChapterId).filter(Boolean))];
  const chapterRecords = await prismaAny.homebrewContent.findMany({
    where: {
      dndBeyondId: { in: chapterIds },
      type: 'location',
      campaigns: { some: { campaignId } },
    },
    select: { dndBeyondId: true, name: true },
  });
  const chapterNameMap = new Map(chapterRecords.map((r: any) => [r.dndBeyondId, r.name]));

  // Group plans by chapter
  const grouped = new Map<string, { ddbChapterId: string; chapterName: string; plans: any[] }>();
  for (const plan of plans) {
    const key = plan.ddbChapterId as string;
    if (!grouped.has(key)) {
      // Resolve name: HomebrewContent.name fallback to slug humanisation
      const rawName = chapterNameMap.get(key) ?? key.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      grouped.set(key, { ddbChapterId: key, chapterName: rawName, plans: [] });
    }
    grouped.get(key)!.plans.push(plan);
  }
  return [...grouped.values()];
},
```

- [ ] **Step 4: Add `markAsRun` repository method**

```ts
markAsRun: async (planId: string, userId: string, sessionId?: string) => {
  // Verify ownership first
  const plan = await prismaAny.encounterPlan.findFirst({
    where: { id: planId },
    include: { campaign: { select: { userId: true } } },
  });
  if (!plan || plan.campaign.userId !== userId) return null;

  return prismaAny.encounterPlan.update({
    where: { id: planId },
    data: {
      lastRunAt: new Date(),
      timesRun: { increment: 1 },
      ...(sessionId ? { lastRunSessionId: sessionId } : {}),
    },
  });
},
```

- [ ] **Step 5: Check TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/server/repositories/encounter-plan.repository.ts
git commit -m "feat(repo): add ddbChapterId, getBySourcebook, markAsRun to encounter-plan repo"
```

---

## Task 3: Service + router — wire getBySourcebook, markAsRun, extend create/update

**Files:**
- Modify: `src/server/services/encounter-plan.service.ts`
- Modify: `src/server/routers/encounter-plans.ts`

- [ ] **Step 1: Add service methods**

In `encounter-plan.service.ts`, add:

```ts
async getBySourcebook(campaignId: string) {
  // Access already verified by campaignDMProcedure — no extra check needed
  return encounterPlanRepository.getBySourcebook(campaignId);
},

async markAsRun(planId: string, userId: string, sessionId?: string) {
  return encounterPlanRepository.markAsRun(planId, userId, sessionId);
},
```

- [ ] **Step 2: Extend router — import campaignDMProcedure, add new endpoints, extend create/update**

In `src/server/routers/encounter-plans.ts`:

**2a.** Change the import line at the top:
```ts
import { protectedProcedure, campaignDMProcedure, router } from '../trpc';
```

**2b.** Extend `create` input schema to accept `ddbChapterId`:
```ts
create: protectedProcedure
  .input(
    z.object({
      campaignId: z.string(),
      name: z.string().trim().min(1).max(150),
      partySize: z.number().int().min(1).max(12).optional(),
      partyLevel: z.number().int().min(1).max(20).optional(),
      difficulty: difficultySchema.optional(),
      ddbChapterId: z.string().optional(),   // ← add this line
    })
  )
  .mutation(({ input, ctx }) => {
    const { campaignId, ...data } = input;
    return encounterPlanService.create(campaignId, ctx.session.user.id, data);
  }),
```

**2c.** Extend `update` input schema to accept `ddbChapterId`:
```ts
// In the update input z.object, add:
ddbChapterId: z.string().optional(),
```

**2d.** Add `getBySourcebook` endpoint (no additional `.input()` — `campaignId` comes from `campaignDMProcedure`):
```ts
getBySourcebook: campaignDMProcedure
  .query(({ input }) =>
    encounterPlanService.getBySourcebook(input.campaignId)
  ),
```

**2e.** Add `markAsRun` endpoint:
```ts
markAsRun: protectedProcedure
  .input(z.object({
    planId: z.string(),
    sessionId: z.string().optional(),
  }))
  .mutation(({ input, ctx }) =>
    encounterPlanService.markAsRun(input.planId, ctx.session.user.id, input.sessionId)
  ),
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/services/encounter-plan.service.ts src/server/routers/encounter-plans.ts
git commit -m "feat(router): add getBySourcebook, markAsRun; extend create/update with ddbChapterId"
```

---

## Task 4: Zustand store

**Files:**
- Create: `src/store/compendium-store.ts`

The `src/store/` directory does not yet exist — create it.

- [ ] **Step 1: Create the store**

```ts
// src/store/compendium-store.ts
import { create } from 'zustand';

type CompendiumTab = 'encounters' | 'monsters' | 'chapters' | 'items';
type CompendiumItemType = 'encounter' | 'monster' | 'chapter' | 'item';

interface CompendiumStore {
  isOpen: boolean;
  activeTab: CompendiumTab;
  selectedItemId: string | null;
  selectedItemType: CompendiumItemType | null;
  open: () => void;
  close: () => void;
  setTab: (tab: CompendiumTab) => void;
  selectItem: (id: string, type: CompendiumItemType) => void;
}

export const useCompendiumStore = create<CompendiumStore>((set) => ({
  isOpen: false,
  activeTab: 'encounters',
  selectedItemId: null,
  selectedItemType: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, selectedItemId: null, selectedItemType: null }),
  setTab: (tab) => set({ activeTab: tab, selectedItemId: null, selectedItemType: null }),
  selectItem: (id, type) => set({ selectedItemId: id, selectedItemType: type }),
}));
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/store/compendium-store.ts
git commit -m "feat(store): add Zustand compendium store"
```

---

## Task 5: CompendiumPanel shell + Items stub tab

**Files:**
- Create: `src/components/compendium/compendium-panel.tsx`
- Create: `src/components/compendium/items-tab.tsx`

- [ ] **Step 1: Create the Items stub tab**

```tsx
// src/components/compendium/items-tab.tsx
export function ItemsTab() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center px-6">
      <p className="text-sm text-muted-foreground">Items coming soon</p>
    </div>
  );
}
```

- [ ] **Step 2: Create CompendiumPanel**

```tsx
// src/components/compendium/compendium-panel.tsx
'use client';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useCompendiumStore } from '@/store/compendium-store';
import { cn } from '@/lib/utils';
import { EncountersTab } from './encounters-tab';
import { MonstersTab } from './monsters-tab';
import { ChaptersTab } from './chapters-tab';
import { ItemsTab } from './items-tab';
import { DetailPane } from './detail-pane';

const TABS = [
  { id: 'encounters', label: 'Encounters' },
  { id: 'monsters',   label: 'Monsters' },
  { id: 'chapters',   label: 'Chapters' },
  { id: 'items',      label: 'Items' },
] as const;

export function CompendiumPanel() {
  const { isOpen, close, activeTab, setTab, selectedItemId, selectedItemType } = useCompendiumStore();

  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && close()}>
      <SheetContent
        side="left"
        className="p-0 border-r border-[hsl(35_35%_18%)] glass-shell w-[700px] max-w-[95vw] flex flex-row z-50"
        // No SheetHeader — custom layout below
      >
        {/* Left pane: tabs + list */}
        <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-[hsl(240_20%_85%/0.07)] h-full">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[hsl(240_20%_85%/0.07)]">
            <p className="text-[10px] font-display tracking-[0.15em] text-[var(--card-amber)] uppercase">Compendium</p>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-[hsl(240_20%_85%/0.07)] px-2 pt-2 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-t transition-colors',
                  activeTab === tab.id
                    ? 'bg-[hsl(240_10%_14%)] text-[var(--card-amber)] border border-b-0 border-[var(--card-stone-border)]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'encounters' && <EncountersTab />}
            {activeTab === 'monsters'   && <MonstersTab />}
            {activeTab === 'chapters'   && <ChaptersTab />}
            {activeTab === 'items'      && <ItemsTab />}
          </div>
        </div>

        {/* Right pane: detail */}
        <div className="flex-1 overflow-hidden">
          <DetailPane />
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Note on `useCampaignSlug`:** Check if this hook already exists with `grep -r "useCampaignSlug\|use-campaign-slug" src/hooks/`. If not, derive the campaign slug inside each tab using `usePathname()` and the regex `/\/campaigns\/([^/]+)/`.

- [ ] **Step 3: Verify TypeScript (will fail on missing tab imports — that's expected)**

```bash
npx tsc --noEmit 2>&1 | grep compendium
```

Expected: errors for missing `EncountersTab`, `MonstersTab`, `ChaptersTab`, `DetailPane` — acceptable at this stage.

- [ ] **Step 4: Commit**

```bash
git add src/components/compendium/
git commit -m "feat(compendium): panel shell + items stub tab"
```

---

## Task 6: Encounters tab

**Files:**
- Create: `src/components/compendium/encounters-tab.tsx`

- [ ] **Step 1: Create EncountersTab**

```tsx
// src/components/compendium/encounters-tab.tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCompendiumStore } from '@/store/compendium-store';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

function getStatusBadge(plan: { lastRunAt: Date | null; timesRun: number; _count: { creatures: number } }) {
  if (plan.lastRunAt) {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(35_50%_15%)] text-[var(--card-amber)] border border-[var(--card-stone-border)] uppercase tracking-wide">
        Run {format(new Date(plan.lastRunAt), 'MMM d')}
      </span>
    );
  }
  if (plan._count.creatures > 0) {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(120_30%_10%)] text-emerald-400 border border-emerald-900/40 uppercase tracking-wide">
        Prepped
      </span>
    );
  }
  return null;
}

export function EncountersTab() {
  const [search, setSearch] = useState('');
  const { selectedItemId, selectItem } = useCompendiumStore();
  const pathname = usePathname();
  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];

  // Need campaignId from slug — use the campaign context or a lookup
  // The campaignDMProcedure needs campaignId not slug.
  // Use trpc to get campaign by slug if needed, or read from CampaignContext.
  // Simplest: import useCampaign from campaign-context if available inside a campaign route.
  // Outside a campaign, show empty state.
  const { data: campaignData } = trpc.campaigns.getBySlug.useQuery(
    { slug: campaignSlug! },
    { enabled: !!campaignSlug }
  );
  const campaignId = campaignData?.id;

  const { data: chapters = [], isLoading } = trpc.encounterPlans.getBySourcebook.useQuery(
    { campaignId: campaignId! },
    { enabled: !!campaignId }
  );

  if (!campaignSlug) {
    return <div className="p-4 text-sm text-muted-foreground">Open a campaign to browse encounters.</div>;
  }
  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }
  if (chapters.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No sourcebook encounters found. Import a sourcebook first.</div>;
  }

  const filtered = search
    ? chapters.map((ch) => ({
        ...ch,
        plans: ch.plans.filter((p: any) =>
          p.name.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((ch) => ch.plans.length > 0)
    : chapters;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[hsl(240_20%_85%/0.07)]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search encounters…"
          className="w-full bg-[hsl(240_10%_8%/0.6)] border border-[hsl(240_20%_85%/0.09)] rounded px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--card-amber)]/40"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {filtered.map((chapter) => (
          <div key={chapter.ddbChapterId}>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5 px-1">
              {chapter.chapterName}
            </p>
            <div className="space-y-1">
              {chapter.plans.map((plan: any) => (
                <button
                  key={plan.id}
                  onClick={() => selectItem(plan.id, 'encounter')}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded border transition-colors',
                    selectedItemId === plan.id
                      ? 'bg-[hsl(240_10%_14%)] border-[var(--card-stone-border-hi)]'
                      : 'bg-[hsl(240_10%_10%/0.5)] border-[hsl(240_20%_85%/0.06)] hover:bg-[hsl(240_10%_12%)]'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-foreground/80 truncate">{plan.name}</span>
                    {getStatusBadge(plan)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{plan.difficulty}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Note:** Check if `trpc.campaigns.getBySlug` exists with `grep -n "getBySlug" src/server/routers/campaigns.ts`. If it doesn't, use `useCampaign()` from `@/components/campaign/campaign-context` instead — that hook is available on all campaign-scoped pages and provides `campaignId` directly. If `useCampaign()` is not available (e.g. on `/dashboard`), show the "Open a campaign" empty state. Update this component to use whichever pattern is available.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep encounters-tab
```

- [ ] **Step 3: Commit**

```bash
git add src/components/compendium/encounters-tab.tsx
git commit -m "feat(compendium): encounters tab with chapter grouping and run/prepped badges"
```

---

## Task 7: Detail pane

**Files:**
- Create: `src/components/compendium/detail-pane.tsx`

- [ ] **Step 0: Verify `campaignId` is in `planWithCreaturesInclude`**

Open `src/server/repositories/encounter-plan.repository.ts`. Find the `planWithCreaturesInclude` object. Confirm it includes `campaignId: true` in its `select` (or is not restricted to a subset). If `campaignId` is absent, add it:

```ts
const planWithCreaturesInclude = {
  // ... existing fields ...
  campaignId: true,   // ← ensure this is present
};
```

This field is needed by `EncounterDetail.handleLoadToBuilder` to call `encounterPlans.create`.

- [ ] **Step 1: Create DetailPane**

```tsx
// src/components/compendium/detail-pane.tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCompendiumStore } from '@/store/compendium-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function useRouteContext() {
  const pathname = usePathname();
  const encounterMatch = pathname.match(/\/campaigns\/([^/]+)\/encounters\/([^/]+)/);
  const sessionMatch = pathname.match(/\/sessions\/([^/]+)\/live/);
  const campaignSlugMatch = pathname.match(/\/campaigns\/([^/]+)/);
  const campaignSlug = campaignSlugMatch?.[1] ?? null;

  // Resolve campaignId from slug — used by detail components that need scoped queries
  const { data: campaignData } = trpc.campaigns.getBySlug.useQuery(
    { slug: campaignSlug! },
    { enabled: !!campaignSlug }
  );

  return {
    campaignSlug,
    campaignId: campaignData?.id ?? null,
    currentPlanId: encounterMatch?.[2] ?? null,
    currentSessionId: sessionMatch?.[1] ?? null,
  };
}

function EncounterDetail({ planId }: { planId: string }) {
  const { campaignSlug, campaignId, currentPlanId, currentSessionId } = useRouteContext();
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: plan } = trpc.encounterPlans.getById.useQuery({ planId });

  // campaignId from route context (already resolved by useRouteContext).
  // Also available from plan.campaignId (Step 0 ensures it's in the select) as a fallback.
  const resolvedCampaignId = campaignId ?? (plan as any)?.campaignId;

  // Fetch parent chapter for monster links — scoped to campaign
  const { data: chapterContent } = trpc.homebrew.getContent.useQuery(
    { campaignId: resolvedCampaignId!, type: 'location' as const },
    { enabled: !!resolvedCampaignId && !!plan?.ddbChapterId }
  );
  const chapterData = chapterContent?.items?.find(
    (item: any) => item.dndBeyondId === plan?.ddbChapterId
  );
  const monsterLinks: { ddbId: string; name: string }[] =
    (chapterData?.data as any)?.monsterLinks ?? [];

  const updateMutation = trpc.encounterPlans.update.useMutation();
  const createMutation = trpc.encounterPlans.create.useMutation({
    onSuccess: (newPlan) => {
      router.push(`/campaigns/${campaignSlug}/encounters/${newPlan.id}`);
    },
  });
  const markAsRunMutation = trpc.encounterPlans.markAsRun.useMutation({
    onSuccess: () => utils.encounterPlans.getBySourcebook.invalidate(),
  });

  if (!plan) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;

  const handleLoadToBuilder = () => {
    if (currentPlanId) {
      updateMutation.mutate({
        planId: currentPlanId,
        name: plan.name,
        difficulty: plan.difficulty as any,
        sceneDescription: plan.sceneDescription ?? undefined,
        ddbChapterId: plan.ddbChapterId ?? undefined,
      });
    } else if (campaignSlug) {
      // Need campaignId — get from plan's campaign relation or context
      // plan.campaignId is available on the EncounterPlan record
      createMutation.mutate({
        campaignId: plan.campaignId,
        name: plan.name,
        difficulty: plan.difficulty as any,
        ddbChapterId: plan.ddbChapterId ?? undefined,
      });
    }
  };

  const handleMarkAsRun = () => {
    markAsRunMutation.mutate({
      planId: plan.id,
      sessionId: currentSessionId ?? undefined,
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b border-[hsl(240_20%_85%/0.07)]">
        <h3 className="font-display text-sm font-semibold text-foreground">{plan.name}</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{plan.difficulty}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {plan.sceneDescription && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Scene</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{plan.sceneDescription}</p>
          </div>
        )}

        {monsterLinks.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Monsters available in this chapter</p>
            <div className="space-y-1">
              {monsterLinks.map((m) => (
                <div key={m.ddbId} className="px-2.5 py-1.5 rounded bg-[hsl(240_10%_10%/0.5)] border border-[hsl(240_20%_85%/0.06)]">
                  <span className="text-xs text-foreground/70">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-[hsl(240_20%_85%/0.07)] space-y-2">
        <Button
          size="sm"
          className="w-full bg-emerald-900/30 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50"
          onClick={handleLoadToBuilder}
          disabled={updateMutation.isPending || createMutation.isPending}
        >
          Load to Encounter Builder
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full border-blue-800/40 text-blue-400 hover:bg-blue-900/20"
          onClick={() => campaignSlug && router.push(`/campaigns/${campaignSlug}/brain?encounter=${plan.id}`)}
          disabled={!campaignSlug}
        >
          Prep with DM Brain
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full border-[var(--card-stone-border)] text-[var(--card-amber)] hover:bg-[hsl(35_30%_10%)]"
          onClick={handleMarkAsRun}
          disabled={markAsRunMutation.isPending}
        >
          Mark as Run
        </Button>
      </div>
    </div>
  );
}

export function DetailPane() {
  const { selectedItemId, selectedItemType } = useCompendiumStore();

  if (!selectedItemId) {
    return (
      <div className="flex items-center justify-center h-full text-center px-6">
        <p className="text-sm text-muted-foreground">Select an item to see details</p>
      </div>
    );
  }

  if (selectedItemType === 'encounter') {
    return <EncounterDetail planId={selectedItemId} />;
  }

  // Monster and Chapter detail handled in Tasks 8 and 9
  return null;
}
```

**Note:** `plan.campaignId` is required — Step 0 above ensures it's in `planWithCreaturesInclude`.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep detail-pane
```

- [ ] **Step 3: Commit**

```bash
git add src/components/compendium/detail-pane.tsx
git commit -m "feat(compendium): detail pane with encounter actions"
```

---

## Task 8: Monsters tab + detail pane monster section

**Files:**
- Create: `src/components/compendium/monsters-tab.tsx`
- Modify: `src/components/compendium/detail-pane.tsx`

- [ ] **Step 1: Create MonstersTab**

```tsx
// src/components/compendium/monsters-tab.tsx
'use client';

import { useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCompendiumStore } from '@/store/compendium-store';
import { cn } from '@/lib/utils';

export function MonstersTab() {
  const [search, setSearch] = useState('');
  const { selectedItemId, selectItem } = useCompendiumStore();
  const pathname = usePathname();
  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];

  // Get campaignId from slug (same pattern as EncountersTab)
  const { data: campaignData } = trpc.campaigns.getBySlug.useQuery(
    { slug: campaignSlug! },
    { enabled: !!campaignSlug }
  );
  const campaignId = campaignData?.id;

  const { data: result, isLoading } = trpc.homebrew.getContent.useQuery(
    { campaignId: campaignId!, type: 'creature' as const },
    { enabled: !!campaignId }
  );
  const monsters = result?.items ?? [];

  const filtered = useMemo(() =>
    search
      ? monsters.filter((m: any) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          String((m.data as any)?.cr ?? '').includes(search) ||
          String((m.data as any)?.type ?? '').toLowerCase().includes(search.toLowerCase())
        )
      : monsters,
    [monsters, search]
  );

  if (!campaignSlug) {
    return <div className="p-4 text-sm text-muted-foreground">Open a campaign to browse monsters.</div>;
  }
  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[hsl(240_20%_85%/0.07)]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, CR, type…"
          className="w-full bg-[hsl(240_10%_8%/0.6)] border border-[hsl(240_20%_85%/0.09)] rounded px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--card-amber)]/40"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground p-2">No monsters found.</p>
        )}
        {filtered.map((monster: any) => (
          <button
            key={monster.id}
            onClick={() => selectItem(monster.id, 'monster')}
            className={cn(
              'w-full text-left px-3 py-2 rounded border transition-colors',
              selectedItemId === monster.id
                ? 'bg-[hsl(240_10%_14%)] border-[var(--card-stone-border-hi)]'
                : 'bg-[hsl(240_10%_10%/0.5)] border-[hsl(240_20%_85%/0.06)] hover:bg-[hsl(240_10%_12%)]'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-foreground/80 truncate">{monster.name}</span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">CR {(monster.data as any)?.cr ?? '?'}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate capitalize">
              {(monster.data as any)?.type ?? ''}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add MonsterDetail to detail-pane.tsx**

Add this function before `DetailPane` in `detail-pane.tsx`:

```tsx
import { MonsterStatBlock, type MonsterStatBlockData } from '@/components/homebrew/MonsterStatBlock';

function MonsterDetail({ monsterId }: { monsterId: string }) {
  const { campaignId, currentPlanId } = useRouteContext();
  const { data: result } = trpc.homebrew.getContent.useQuery(
    { campaignId: campaignId!, type: 'creature' as const },
    { enabled: !!campaignId }
  );
  const monster = result?.items?.find((m: any) => m.id === monsterId);

  const addCreatureMutation = trpc.encounterPlans.addCreature.useMutation();

  if (!monster) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  if (!monster.data) return null;

  const statBlock = monster.data as unknown as MonsterStatBlockData;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <MonsterStatBlock data={statBlock} mode="full" />
      </div>
      {currentPlanId && (
        <div className="px-4 py-3 border-t border-[hsl(240_20%_85%/0.07)]">
          <Button
            size="sm"
            className="w-full bg-emerald-900/30 border border-emerald-800/40 text-emerald-400 hover:bg-emerald-900/50"
            onClick={() =>
              addCreatureMutation.mutate({
                planId: currentPlanId,
                name: monster.name,
                count: 1,
                cr: String((monster.data as any)?.cr ?? ''),
                xp: (monster.data as any)?.xp ?? undefined,
                sourceType: 'homebrew',
                sourceId: monster.id,
                statBlock: monster.data as Record<string, unknown>,
              })
            }
            disabled={addCreatureMutation.isPending}
          >
            Add to Encounter
          </Button>
        </div>
      )}
    </div>
  );
}
```

Then update `DetailPane` to handle the `'monster'` type:
```tsx
if (selectedItemType === 'monster') {
  return <MonsterDetail monsterId={selectedItemId} />;
}
```

- [ ] **Step 3: Check `MonsterStatBlock` props**

```bash
grep -n "export.*MonsterStatBlock\|mode.*full\|MonsterStatBlockData" src/components/homebrew/MonsterStatBlock.tsx | head -10
```

Adjust the `mode` prop name to match what `MonsterStatBlock` actually accepts.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "monsters-tab\|detail-pane"
```

- [ ] **Step 5: Commit**

```bash
git add src/components/compendium/monsters-tab.tsx src/components/compendium/detail-pane.tsx
git commit -m "feat(compendium): monsters tab + monster detail with Add to Encounter"
```

---

## Task 9: Chapters tab + detail pane chapter section

**Files:**
- Create: `src/components/compendium/chapters-tab.tsx`
- Modify: `src/components/compendium/detail-pane.tsx`

- [ ] **Step 1: Create ChaptersTab**

```tsx
// src/components/compendium/chapters-tab.tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCompendiumStore } from '@/store/compendium-store';
import { cn } from '@/lib/utils';

export function ChaptersTab() {
  const [search, setSearch] = useState('');
  const { selectedItemId, selectItem } = useCompendiumStore();
  const pathname = usePathname();
  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];

  const { data: campaignData } = trpc.campaigns.getBySlug.useQuery(
    { slug: campaignSlug! },
    { enabled: !!campaignSlug }
  );
  const campaignId = campaignData?.id;

  const { data: result, isLoading } = trpc.homebrew.getContent.useQuery(
    { campaignId: campaignId!, type: 'location' as const },
    { enabled: !!campaignId }
  );

  const chapters = (result?.items ?? []).filter(
    (item: any) => item.sourceType === 'dndbeyond_import'
  );

  const filtered = search
    ? chapters.filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase()))
    : chapters;

  if (!campaignSlug) {
    return <div className="p-4 text-sm text-muted-foreground">Open a campaign to browse chapters.</div>;
  }
  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[hsl(240_20%_85%/0.07)]">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chapters…"
          className="w-full bg-[hsl(240_10%_8%/0.6)] border border-[hsl(240_20%_85%/0.09)] rounded px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--card-amber)]/40"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground p-2">No chapters found.</p>
        )}
        {filtered.map((chapter: any) => {
          const data = chapter.data as any;
          const wordEstimate = data?.proseLength
            ? `~${Math.round(data.proseLength / 5).toLocaleString()} words`
            : '';
          return (
            <button
              key={chapter.id}
              onClick={() => selectItem(chapter.id, 'chapter')}
              className={cn(
                'w-full text-left px-3 py-2 rounded border transition-colors',
                selectedItemId === chapter.id
                  ? 'bg-[hsl(240_10%_14%)] border-[var(--card-stone-border-hi)]'
                  : 'bg-[hsl(240_10%_10%/0.5)] border-[hsl(240_20%_85%/0.06)] hover:bg-[hsl(240_10%_12%)]'
              )}
            >
              <span className="text-xs text-foreground/80 block truncate">{chapter.name}</span>
              {wordEstimate && <span className="text-[10px] text-muted-foreground">{wordEstimate}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add ChapterDetail to detail-pane.tsx**

```tsx
function ChapterDetail({ chapterId }: { chapterId: string }) {
  const { campaignId } = useRouteContext();
  const { data: result } = trpc.homebrew.getContent.useQuery(
    { campaignId: campaignId!, type: 'location' as const },
    { enabled: !!campaignId }
  );
  const chapter = result?.items?.find((c: any) => c.id === chapterId);
  if (!chapter) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;

  const data = chapter.data as any;
  const prose: string = data?.prose ?? '';
  const truncated = prose.length > 800
    ? prose.slice(0, prose.lastIndexOf(' ', 800)) + '…'
    : prose;
  const encounterAreas: string[] = data?.encounterAreas ?? [];

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-3 space-y-4">
      <div>
        <h3 className="font-display text-sm font-semibold text-foreground mb-1">{chapter.name}</h3>
      </div>
      {truncated && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Excerpt</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{truncated}</p>
        </div>
      )}
      {encounterAreas.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">Encounter Areas</p>
          <ul className="space-y-1">
            {encounterAreas.map((area: string) => (
              <li key={area} className="text-xs text-foreground/70 px-2.5 py-1.5 rounded bg-[hsl(240_10%_10%/0.5)] border border-[hsl(240_20%_85%/0.06)]">
                {area}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

Update `DetailPane` to handle `'chapter'`:
```tsx
if (selectedItemType === 'chapter') {
  return <ChapterDetail chapterId={selectedItemId} />;
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "chapters-tab\|detail-pane"
```

- [ ] **Step 4: Commit**

```bash
git add src/components/compendium/chapters-tab.tsx src/components/compendium/detail-pane.tsx
git commit -m "feat(compendium): chapters tab + chapter detail (read-only)"
```

---

## Task 10: Sidebar icon + app-shell mount

**Files:**
- Modify: `src/components/sidebar.tsx`
- Modify: `src/app/(app)/app-shell.tsx`

- [ ] **Step 1: Add compendium toggle to Sidebar bottom section**

In `sidebar.tsx`, import `BookOpen` from lucide-react and `useCompendiumStore`:

```tsx
import { BookOpen } from 'lucide-react';
import { useCompendiumStore } from '@/store/compendium-store';
```

In the `Sidebar` function, get `open` and `isOpen` from the store:
```tsx
const { open: openCompendium, isOpen: compendiumOpen } = useCompendiumStore();
```

In the `{/* Bottom */}` section, add the compendium button **above** the Settings `NavItem`:

```tsx
{/* Compendium toggle */}
<button
  onClick={openCompendium}
  className={cn(
    'flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors rounded-sm mx-1',
    compendiumOpen
      ? 'text-[var(--card-amber)]'
      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
  )}
  title="Compendium"
>
  <BookOpen
    className={cn('h-4 w-4 flex-shrink-0', compendiumOpen && 'drop-shadow-[0_0_4px_hsl(35_80%_48%/0.6)]')}
    strokeWidth={1.8}
  />
  {!collapsed && <span className="font-body">Compendium</span>}
</button>
```

**Note on `collapsed`:** Use the same `collapsed` variable already used by existing `NavItem` buttons in the `Sidebar` function. Do not introduce a new variable — match whatever the existing pattern uses.

- [ ] **Step 2: Add the same toggle to MobileSidebar**

Scroll to `MobileSidebar` in the same file. Apply the same pattern before the Settings link near the bottom of that component.

- [ ] **Step 3: Mount CompendiumPanel in app-shell.tsx**

**Note:** The spec mentions `layout.tsx` but `layout.tsx` is a Server Component and cannot hold client-side Zustand state. `app-shell.tsx` is the Client Component that `layout.tsx` wraps — mount here instead. This is the correct pattern.

In `src/app/(app)/app-shell.tsx`:

```tsx
import { CompendiumPanel } from '@/components/compendium/compendium-panel';
```

Add `<CompendiumPanel />` inside `<OnboardingCheck>` at the same level as `<FeedbackWidget />`:

```tsx
<FeedbackWidget />
<CompendiumPanel />
```

- [ ] **Step 4: Verify full TypeScript build**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Run the dev server and manually verify**

```bash
npm run dev
```

Check:
- Compendium icon appears in sidebar bottom
- Clicking opens the slide-over from the left
- Tabs switch between Encounters/Monsters/Chapters/Items
- On a campaign page: encounters load grouped by chapter
- Clicking an encounter opens detail pane with actions
- Monsters tab shows creature list; clicking shows stat block
- Mark as Run updates badge optimistically
- Load to Builder works on encounter builder page

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar.tsx src/app/\(app\)/app-shell.tsx
git commit -m "feat(compendium): sidebar icon + global panel mount in app-shell"
```

- [ ] **Step 7: Push**

```bash
git push origin main
```

---

## Notes for Implementer

- **Campaign ID resolution:** `trpc.campaigns.getBySlug` may not exist. Check with `grep -n "getBySlug" src/server/routers/campaigns.ts`. If absent, use `useCampaign()` from `@/components/campaign/campaign-context` — it returns `{ campaignId }` directly and works on all `/campaigns/[slug]/*` routes. For global pages (dashboard), show an "Open a campaign" empty state.

- **`planWithCreaturesInclude` / `campaignId` on plan:** Task 7 Step 0 handles this concretely — ensure `campaignId` is in the select before proceeding.

- **`MonsterStatBlock` props:** Check the actual component props before using `mode="full"`. The component may use `variant` or no prop at all.

- **`homebrew.getContent` with `campaignId`:** Verify the existing query accepts `campaignId`. If not, add it as an optional filter in the homebrew router.
