# QuiverDM UI 2.0 — Priority Screens Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign three key screens using the stone card design system — NPC Inspector (split view), Session Cockpit (3-panel layout), and DM Brain (stone card visual treatment).

**Architecture:** Pure frontend redesigns — no new API routes, no schema changes. HTML prototypes at `C:\Users\mail\quiverdm-npc.html`, `quiverdm-session.html`, and `quiverdm-campaign.html` are the visual reference. All existing tRPC queries remain unchanged.

**Tech Stack:** Next.js 15 App Router, tRPC client (`@/lib/trpc`), Tailwind + stone card CSS classes in `globals.css`, shadcn/ui, Lucide icons.

**Design tokens (in use, from globals.css):**
- Stone card: `.stone-card`, `.stone-card-header`, `.stone-card-title`, `.stone-card-body`
- Stats: `.stat-value`, `.stat-label`
- Labels: `.label-overline`, `.section-rule`
- Glass: `.glass-panel`, `.glass-shell`, `.glass-grain`
- Hero layout: `.hero-arch-left`
- Amber primary: `hsl(35 80% 55%)` = `text-primary`

---

## Chunk 1: NPC Split Inspector

Replace the NPC grid page with a desktop split-view (list panel + inspector panel). Mobile retains the grid card view.

**Key design decisions:**
- Selected NPC tracked via URL search param `?npc=<id>` (shareable, bookmarkable)
- Desktop (md+): `grid-cols-[300px_1fr]` — left list, right inspector
- Mobile: flat grid of cards, clicking navigates to detail page (unchanged)
- Inspector shows: portrait, stats strip, description, secrets (DM only), relationships
- "Full Details" link at bottom of inspector → `[npcId]/page.tsx` for editing/stat block

### Task 1: NpcInspectorPanel component

**Files:**
- Create: `src/components/npc/npc-inspector-panel.tsx`

- [ ] **Step 1: Create the inspector panel component**

```tsx
// src/components/npc/npc-inspector-panel.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Zap, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NpcInspectorPanelProps {
  npcId: string;
  slug: string;
  isDM: boolean;
}

export function NpcInspectorPanel({ npcId, slug, isDM }: NpcInspectorPanelProps) {
  const npc = trpc.npcs.getById.useQuery({ id: npcId }, { staleTime: 120_000 });

  if (npc.isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Skeleton className="h-48 w-full rounded-none" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 flex-1 rounded" />)}
          </div>
          <Skeleton className="h-32 w-full rounded mt-4" />
        </div>
      </div>
    );
  }

  if (npc.isError || !npc.data) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Failed to load NPC.
      </div>
    );
  }

  const data = npc.data as any;
  const stats = data.stats as any;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Portrait */}
      <div className="relative h-52 w-full shrink-0 bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900">
        {data.imageUrl && (
          <Image src={data.imageUrl} alt={data.name} fill className="object-cover object-top opacity-90" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="font-display text-xl font-bold" style={{ color: 'hsl(35 30% 90%)' }}>
            {data.name}
          </h3>
          {data.faction && (
            <Badge variant="outline" className="mt-1 text-xs border-amber-500/30 text-amber-400/80">
              {data.faction}
            </Badge>
          )}
        </div>
      </div>

      {/* Stat pills */}
      {stats && (
        <div className="flex divide-x" style={{ borderBottom: '1px solid hsl(35 35% 18%)', borderColor: 'hsl(35 35% 18%)' }}>
          {[
            { label: 'CR', value: stats.cr ?? '—' },
            { label: 'HP', value: typeof stats.hitPoints === 'object' ? stats.hitPoints?.max : (stats.hitPoints ?? '—') },
            { label: 'AC', value: stats.armorClass ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="stone-card-body flex-1 text-center py-3" style={{ borderColor: 'hsl(35 35% 18%)' }}>
              <div className="stat-value text-base">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 p-4 space-y-4">
        {data.description && (
          <div>
            <p className="label-overline mb-1">Description</p>
            <div className="section-rule mb-2" />
            <p className="text-sm text-muted-foreground leading-relaxed">{data.description}</p>
          </div>
        )}

        {isDM && data.secrets && (
          <div>
            <p className="label-overline mb-1" style={{ color: 'hsl(35 80% 55% / 0.7)' }}>DM Secrets</p>
            <div className="section-rule mb-2" />
            <div className="stone-card p-3">
              <p className="text-sm leading-relaxed">{data.secrets}</p>
            </div>
          </div>
        )}

        {stats?.size || stats?.creatureType || stats?.alignment ? (
          <div>
            <p className="label-overline mb-1">Type</p>
            <div className="section-rule mb-2" />
            <p className="text-sm text-muted-foreground">
              {[stats.size, stats.creatureType, stats.alignment].filter(Boolean).join(' · ')}
            </p>
          </div>
        ) : null}

        <div className="pt-2">
          <Button asChild variant="outline" size="sm" className="w-full gap-2">
            <Link href={`/campaigns/${slug}/npcs/${data.id}`}>
              Full Details <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify component renders without errors** — import it in the npcs page temporarily and check for TypeScript errors:

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors for the new file.

---

### Task 2: NpcListRow component

**Files:**
- Create: `src/components/npc/npc-list-row.tsx`

- [ ] **Step 1: Create the list row component**

```tsx
// src/components/npc/npc-list-row.tsx
'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface NpcListRowProps {
  npc: {
    id: string;
    name: string;
    faction?: string | null;
    imageUrl?: string | null;
    description?: string | null;
  };
  isSelected: boolean;
  onClick: () => void;
}

export function NpcListRow({ npc, isSelected, onClick }: NpcListRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
        isSelected
          ? 'bg-amber-500/10 border-l-2 border-primary'
          : 'border-l-2 border-transparent hover:bg-white/[0.04] hover:border-white/10'
      )}
    >
      {/* Avatar */}
      <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-stone-800 to-stone-900">
        {npc.imageUrl ? (
          <Image src={npc.imageUrl} alt={npc.name} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full w-full text-xs font-bold text-amber-500/60 font-display">
            {npc.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name + faction */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          isSelected ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {npc.name}
        </p>
        {npc.faction && (
          <p className="text-[10px] text-muted-foreground/60 truncate">{npc.faction}</p>
        )}
      </div>
    </button>
  );
}
```

---

### Task 3: Rebuild the NPCs page with split layout

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/npcs/page.tsx`

- [ ] **Step 1: Replace the npcs page with split layout**

```tsx
// src/app/(app)/campaigns/[slug]/npcs/page.tsx
'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { NpcListRow } from '@/components/npc/npc-list-row';
import { NpcInspectorPanel } from '@/components/npc/npc-inspector-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Users, Ghost } from 'lucide-react';

// useSearchParams requires a Suspense boundary in Next.js 15 App Router.
// NPCsPageInner contains the search-param logic; the default export wraps it.
export default function NPCsPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-220px)] animate-pulse bg-white/5" />}>
      <NPCsPageInner />
    </Suspense>
  );
}

function NPCsPageInner() {
  const { campaignId, slug, isDM } = useCampaign();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState('');
  const selectedId = searchParams.get('npc');

  const npcs = trpc.npcs.getAll.useQuery(
    { campaignId, search: search || undefined },
    { staleTime: 120_000 }
  );
  const factions = trpc.npcs.getFactions.useQuery({ campaignId }, { staleTime: 120_000 });

  function selectNpc(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get('npc') === id) {
      params.delete('npc');
    } else {
      params.set('npc', id);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const npcList = (npcs.data ?? []) as any[];
  const hasNpcs = npcList.length > 0;

  // ── Desktop split view ────────────────────────────────────────────────────
  return (
    <>
      {/* Mobile: grid view (< md) */}
      <div className="md:hidden space-y-4 px-4 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">NPCs</h2>
          {isDM && (
            <Button asChild size="sm">
              <Link href={`/campaigns/${slug}/npcs/new`}>
                <Plus className="mr-2 h-4 w-4" />
                New NPC
              </Link>
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search NPCs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {npcs.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
          </div>
        ) : hasNpcs ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {npcList.map((npc) => (
              <Link key={npc.id} href={`/campaigns/${slug}/npcs/${npc.id}`}>
                <div className="stone-card glass-panel h-full hover:border-foreground/50 transition-colors cursor-pointer overflow-hidden">
                  {npc.imageUrl ? (
                    <div className="relative h-24 w-full">
                      <Image src={npc.imageUrl} alt={npc.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="h-24 w-full bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900" />
                  )}
                  <div className="stone-card-header pb-2">
                    <span className="stone-card-title">{npc.name}</span>
                    {npc.faction && (
                      <Badge variant="outline" className="text-xs ml-auto">{npc.faction}</Badge>
                    )}
                  </div>
                  <div className="stone-card-body">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {npc.description || 'No description'}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <MobileEmpty slug={slug} isDM={isDM} />
        )}
      </div>

      {/* Desktop: split view (md+) */}
      <div
        className="hidden md:grid h-[calc(100vh-220px)] overflow-hidden"
        style={{
          gridTemplateColumns: '300px 1fr',
          borderTop: '1px solid hsl(35 35% 18%)',
          marginLeft: '-2rem',
          marginRight: '-2rem',
        }}
      >
        {/* Left: NPC List */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ borderRight: '1px solid hsl(35 35% 18%)' }}
        >
          {/* List header */}
          <div
            className="flex items-center justify-between px-3 py-2.5 shrink-0"
            style={{ borderBottom: '1px solid hsl(35 35% 18%)' }}
          >
            <p className="label-overline">Characters</p>
            {isDM && (
              <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1">
                <Link href={`/campaigns/${slug}/npcs/new`}>
                  <Plus className="h-3 w-3" />
                  New
                </Link>
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid hsl(35 35% 18%)' }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-7 text-sm"
              />
            </div>
          </div>

          {/* Faction chips */}
          {factions.data && (factions.data as string[]).length > 0 && (
            <div
              className="flex gap-1.5 flex-wrap px-3 py-2 shrink-0"
              style={{ borderBottom: '1px solid hsl(35 35% 18%)' }}
            >
              {(factions.data as string[]).map((f) => (
                <Badge
                  key={f}
                  variant="outline"
                  className="text-[10px] cursor-pointer hover:bg-white/5 px-2 py-0"
                  onClick={() => setSearch(f)}
                >
                  {f}
                </Badge>
              ))}
            </div>
          )}

          {/* NPC list */}
          <div className="flex-1 overflow-y-auto">
            {npcs.isLoading ? (
              <div className="space-y-1 p-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded" />
                ))}
              </div>
            ) : hasNpcs ? (
              npcList.map((npc) => (
                <NpcListRow
                  key={npc.id}
                  npc={npc}
                  isSelected={selectedId === npc.id}
                  onClick={() => selectNpc(npc.id)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                <Ghost className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No NPCs yet</p>
                {isDM && (
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link href={`/campaigns/${slug}/npcs/new`}>Add First NPC</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Inspector panel */}
        <div className="overflow-hidden">
          {selectedId ? (
            <NpcInspectorPanel npcId={selectedId} slug={slug} isDM={isDM} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'hsl(240 10% 11%)' }}
              >
                <Users className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Select an NPC to inspect
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                {hasNpcs
                  ? `${npcList.length} NPC${npcList.length !== 1 ? 's' : ''} in this campaign`
                  : 'No NPCs yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

} // end NPCsPageInner

function MobileEmpty({ slug, isDM }: { slug: string; isDM: boolean }) {
  return (
    <div className="stone-card">
      <div className="stone-card-body flex flex-col items-center justify-center py-16 text-center">
        <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No NPCs yet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Add NPCs to track the characters your players encounter.
        </p>
        {isDM && (
          <Button asChild size="sm">
            <Link href={`/campaigns/${slug}/npcs/new`}>New NPC</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: 0 errors related to the new files.

- [ ] **Step 3: Visual check in dev**

Navigate to `/campaigns/[slug]/npcs` at 1440px width. Expected:
- Left panel 300px showing NPC list rows with avatar circles and names
- Right panel showing "Select an NPC to inspect" empty state
- Clicking an NPC updates the URL `?npc=<id>` and shows the inspector

- [ ] **Step 4: Commit**

```bash
cd E:/Projects/QuiverDM && git add src/components/npc/npc-inspector-panel.tsx src/components/npc/npc-list-row.tsx src/app/\(app\)/campaigns/\[slug\]/npcs/page.tsx
git commit -m "feat(ui): NPC split inspector — list panel + inline inspector on desktop"
```

---

## Chunk 2: Session Cockpit 3-Panel Layout

The session detail page at `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` currently uses a stacked vertical layout. The prototype shows a 3-column grid:
- Left col (220px): world context panel — session info, scene notes, quick NPC lookup
- Center col (flex): transcript stream + AI suggestion cards
- Right col (300px): combat/tools — encounter tracker, dice tray, rules lookup

The existing components stay; we extract a layout wrapper and reorganize them.

### Task 4: CockpitLayout component

**Files:**
- Create: `src/components/session/cockpit-layout.tsx`

- [ ] **Step 1: Create the cockpit layout wrapper**

```tsx
// src/components/session/cockpit-layout.tsx
'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CockpitLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  className?: string;
}

export function CockpitLayout({ left, center, right, className }: CockpitLayoutProps) {
  return (
    <div
      className={cn(
        'hidden lg:grid h-[calc(100vh-200px)] overflow-hidden',
        className
      )}
      style={{
        gridTemplateColumns: '220px 1fr 300px',
        borderTop: '1px solid hsl(35 35% 18%)',
        marginLeft: '-2rem',
        marginRight: '-2rem',
      }}
    >
      {/* Left panel */}
      <div
        className="flex flex-col overflow-y-auto"
        style={{ borderRight: '1px solid hsl(35 35% 18%)' }}
      >
        {left}
      </div>

      {/* Center panel */}
      <div className="flex flex-col overflow-y-auto min-w-0">
        {center}
      </div>

      {/* Right panel */}
      <div
        className="flex flex-col overflow-y-auto"
        style={{ borderLeft: '1px solid hsl(35 35% 18%)' }}
      >
        {right}
      </div>
    </div>
  );
}

/* Panel section header — consistent across all cockpit panels */
export function CockpitPanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 shrink-0"
      style={{ borderBottom: '1px solid hsl(35 35% 18%)' }}
    >
      <p className="label-overline">{title}</p>
      {children}
    </div>
  );
}
```

### Task 5: Restructure session page to use 3-panel cockpit layout

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

The session page is large (~1000+ lines). The strategy: add the 3-panel layout for desktop (lg+) and keep the current stacked layout for mobile/tablet. Don't remove any existing components or functionality.

- [ ] **Step 1: Read the current session page imports and state**

The session page already imports these relevant components:
- `LiveTranscriptionControls` — mic/recording controls
- `TranscriptionStatus` — live transcription feed
- `EncounterTracker` — initiative/combat tracker
- `DerailmentPanel` — narrative tools
- `RulesPanel` — rules lookup
- `SummaryPanel` — session summary
- `CombatCopiloterPanel` — combat AI
- `AudioRecorder` — audio capture

- [ ] **Step 2: Add CockpitLayout to the session page**

Find the main return statement in the session page. The current layout wraps everything in `<div className="space-y-6 ...">`. Add a desktop cockpit view above (or replace with) the stacked view.

Locate this pattern near the bottom of the session page:
```tsx
return (
  <div className="space-y-6 max-w-screen-xl ...">
```

Add the cockpit layout after the existing header/toolbar row. The cockpit panels are:

**Left panel content:**
- Session info (number, date, status badge)
- Scene Notes (compact text area if it exists in state)
- Quick NPC reference (show `npcs` query results as compact list)

**Center panel content:**
- `TranscriptionStatus` (the live transcript feed)
- `LiveTranscriptionControls` (recording controls)
- Summary / events area

**Right panel content:**
- `EncounterTracker`
- `RulesPanel`
- `DerailmentPanel`

- [ ] **Step 3: Add the import and cockpit section**

At the top of the session page file, add:
```tsx
import { CockpitLayout, CockpitPanelHeader } from '@/components/session/cockpit-layout';
```

Then after the existing stacked view div, add the cockpit layout as a separate desktop-only section. The simplest approach: wrap the existing return in a fragment and add the `CockpitLayout` as the desktop-only view:

```tsx
return (
  <>
    {/* Desktop cockpit — lg+ */}
    <CockpitLayout
      left={
        <>
          <CockpitPanelHeader title="Session" />
          <div className="p-3 space-y-3 flex-1">
            {/* Session meta */}
            <div className="stone-card">
              <div className="stone-card-body text-center">
                <div className="stat-value">#{session.sessionNumber}</div>
                <div className="stat-label">Session</div>
              </div>
            </div>
            {/* Status badge */}
            <div className="flex justify-center">
              {/* existing status badge */}
            </div>
          </div>
        </>
      }
      center={
        <>
          <CockpitPanelHeader title="Transcript" />
          <div className="flex-1 overflow-y-auto p-3">
            <TranscriptionStatus sessionId={sessionId} campaignId={campaignId} />
          </div>
          <div className="p-3 shrink-0" style={{ borderTop: '1px solid hsl(35 35% 18%)' }}>
            <LiveTranscriptionControls sessionId={sessionId} campaignId={campaignId} />
          </div>
        </>
      }
      right={
        <>
          <CockpitPanelHeader title="Combat" />
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <EncounterTracker sessionId={sessionId} campaignId={campaignId} />
            <RulesPanel campaignId={campaignId} />
          </div>
        </>
      }
    />

    {/* Mobile/tablet fallback — existing stacked layout */}
    {/* lg:hidden wrapper: find the outermost div in the current return and add lg:hidden to it */}
    {/* The existing return looks like: <div className="space-y-6 max-w-screen-xl px-4 ..."> */}
    {/* Change that div to: <div className="lg:hidden space-y-6 max-w-screen-xl px-4 ..."> */}
    {/* CockpitLayout already applies hidden lg:grid, so no other changes needed */}
  </>
);
```

**Concrete change to make:** In the session page's existing `return (`, find the root `<div>` wrapper (typically `<div className="space-y-6 ...">`) and:
1. Wrap the entire existing return JSX in `<>...</>` fragment
2. Add `<CockpitLayout ...>` before the existing root div
3. Add `className="lg:hidden"` to the existing root div

`CockpitLayout` already applies `hidden lg:grid` so the two layouts are mutually exclusive without any other changes.

- [ ] **Step 4: TypeScript check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

- [ ] **Step 5: Visual check**

Navigate to a session at 1440px. Expected:
- Three-column layout renders
- Transcript feed in center column
- Encounter tracker in right column
- Session number stat in left column

- [ ] **Step 6: Commit**

```bash
cd E:/Projects/QuiverDM && git add src/components/session/cockpit-layout.tsx src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/page.tsx
git commit -m "feat(ui): session cockpit 3-panel layout for desktop (lg+)"
```

---

## Chunk 3: DM Brain Page — Stone Card Redesign

The brain page at `src/app/(app)/campaigns/[slug]/brain/page.tsx` uses a mix of `Card`/`glass-panel`. Replace with `stone-card` pattern and improve the overview tab layout to match the design system.

### Task 6: Apply stone card design to brain page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/brain/page.tsx`

The current page uses `<Card className="glass-panel">` throughout. Replace with the stone card pattern.

**Replacement map:**
```
<Card className="glass-panel">                     →  <div className="stone-card">
  <CardHeader className="pb-3">                   →    <div className="stone-card-header">
    <CardTitle className="text-sm ...">           →      <span className="stone-card-title">
    </CardTitle>                                  →      </span>
  </CardHeader>                                   →    </div>
  <CardContent>                                   →    <div className="stone-card-body">
  </CardContent>                                  →    </div>
</Card>                                           →  </div>
```

Remove `Card`, `CardContent`, `CardHeader`, `CardTitle` imports since they'll no longer be used (the brain page is the only consumer of these from shadcn on that route).

- [ ] **Step 1: Replace all Card usages in brain/page.tsx**

The brain page has approximately 8 `<Card className="glass-panel">` blocks. Replace each one with the stone-card equivalent following the map above.

Specific replacements:

For `Session Seed Card` section — it calls `<SessionSeedCard>` component, no change needed.

For `World Pressure` card:
```tsx
// Before:
<Card className="glass-panel">
  <CardHeader className="pb-3">
    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      World Pressure
    </CardTitle>
  </CardHeader>
  <CardContent>
    ...
  </CardContent>
</Card>

// After:
<div className="stone-card">
  <div className="stone-card-header">
    <span className="stone-card-title">World Pressure</span>
  </div>
  <div className="stone-card-body">
    ...
  </div>
</div>
```

Apply same pattern to: Open Hooks, Entities, Entity Counts, Recent Changes, Entity Relationship Graph, Entity Appearances by Session, Continuity Warnings.

- [ ] **Step 2: Remove unused imports from brain/page.tsx**

First verify what's still in use:
```bash
grep -n "Separator\|CardContent\|CardHeader\|CardTitle\|<Card" src/app/\(app\)/campaigns/\[slug\]/brain/page.tsx
```

Remove `Card`, `CardContent`, `CardHeader`, `CardTitle` imports once all usages are replaced. For `Separator`: if only one usage remains (the Entity Counts divider), replace it with:
```tsx
<div className="section-rule my-1" />
```
Then remove the `Separator` import. If there are other `<Separator />` usages, replace each one individually before removing the import.

- [ ] **Step 3: Improve entity count list divider**

Find the `<Separator />` in the entity counts section and replace:
```tsx
// Before:
<Separator className="my-1" />

// After:
<div className="section-rule my-1" />
```

- [ ] **Step 4: TypeScript check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Visual check**

Navigate to `/campaigns/[slug]/brain`. Expected:
- Stone card styling (dark gradient background, amber-tinted borders, 3px radius)
- `stone-card-title` overline labels on each card section
- Consistent visual treatment matching the campaign overview page

- [ ] **Step 6: Commit**

```bash
cd E:/Projects/QuiverDM && git add src/app/\(app\)/campaigns/\[slug\]/brain/page.tsx
git commit -m "refactor(ui): DM Brain page stone card design system — replace Card with stone-card"
```

---

## Chunk 4: Campaign Overview — Enhanced Layout (Optional)

This chunk enhances the campaign overview page to show more intelligence data inline, pulling from the brain/state query.

### Task 7: Add world pressure preview to campaign overview

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/page.tsx`

The current overview shows: stat strip, last session card, quick actions. Add a third column with world pressure preview (pressure gauges) for DMs who have brain data.

- [ ] **Step 1: Add brain state query to campaign overview (DM only)**

```tsx
// In CampaignOverviewPage, add:
const stateQuery = trpc.brain.state.get.useQuery(
  { campaignId },
  { enabled: isDM, staleTime: 60_000 }
);
```

- [ ] **Step 2: Update the grid to 3 columns when state data exists**

```tsx
// Change grid from md:grid-cols-3 to md:grid-cols-3 with optional 4th column
// Only show pressure when isDM and state has data with non-zero pressures

const pressures = stateQuery.data as any;
// Schema stores pressures as Float 0.0–1.0 fields named pressurePolitical etc.
const hasPressures = isDM && pressures && Object.values({
  political: pressures.pressurePolitical,
  supernatural: pressures.pressureSupernatural,
  economic: pressures.pressureEconomic,
  cosmic: pressures.pressureCosmic,
  social: pressures.pressureSocial,
}).some((v) => typeof v === 'number' && v > 0);
```

- [ ] **Step 3: Add pressure preview card to the grid layout**

```tsx
{hasPressures && (
  <div className="stone-card md:col-span-1">
    <div className="stone-card-header">
      <span className="stone-card-title">World Pressure</span>
    </div>
    <div className="stone-card-body space-y-2">
      {([
        ['Political', 'pressurePolitical'],
        ['Supernatural', 'pressureSupernatural'],
        ['Economic', 'pressureEconomic'],
        ['Cosmic', 'pressureCosmic'],
        ['Social', 'pressureSocial'],
      ] as const).map(([label, field]) => {
        const raw = typeof (pressures as any)[field] === 'number' ? (pressures as any)[field] : 0;
        const value = Math.round(raw * 100); // 0.0–1.0 → 0–100
        if (value === 0) return null;
        return (
          <div key={field} className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{label}</span>
              <span className="text-xs font-mono text-amber-400/80">{value}%</span>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${value}%`,
                  background: value > 75
                    ? 'hsl(0 62% 50%)'
                    : value > 50
                    ? 'hsl(35 80% 55%)'
                    : 'hsl(35 50% 40%)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 4: TypeScript check + visual check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -10
```

- [ ] **Step 5: Commit**

```bash
cd E:/Projects/QuiverDM && git add src/app/\(app\)/campaigns/\[slug\]/page.tsx
git commit -m "feat(ui): campaign overview — world pressure preview panel for DMs"
```

---

## Implementation Order

1. **Chunk 1** (NPC Split Inspector) — No dependencies, cleanest first win
2. **Chunk 2** (Session Cockpit) — Purely additive layout, low risk
3. **Chunk 3** (DM Brain stone cards) — Search/replace pattern, fast
4. **Chunk 4** (Campaign Overview pressure) — Optional enhancement

## Testing

After all chunks:

```bash
# TypeScript
cd E:/Projects/QuiverDM && npx tsc --noEmit

# E2E smoke test
npx playwright test tests/workflows/brain.workflow.spec.ts --headed
npx playwright test tests/personas/veteran-dm.persona.spec.ts --headed
```

Key manual checks:
- NPC split inspector: select/deselect NPC, search, faction filter
- Session cockpit at 1440px: all three panels visible with correct content
- DM Brain at 1440px: stone card styling throughout
- All three screens at 390px: mobile fallback layout works correctly
