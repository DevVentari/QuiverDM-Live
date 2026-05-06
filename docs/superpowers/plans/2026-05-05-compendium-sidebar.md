# Compendium Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Homebrew nav tab and bottom Compendium panel with an inline compendium browser built into the sidebar — expandable per-type sections with search, + New actions, and a unified right-side pin rail supporting all content types with drag-to-reorder.

**Architecture:** New `usePinnedItems` Zustand store (replaces `usePinnedCharacters`) tracks pinned entities of any type with a drag `order` field. A shared `CompendiumItemSheet` (shadcn Sheet, 420px) renders type-specific content and is opened by pin clicks or inline ⊞ icons. `SidebarCompendiumSection` is a reusable expandable section used once per content type in the sidebar. Campaign ID flows through the `header-store` (a new `campaignId` field) set by the campaign layout so the sidebar never has to fetch it separately.

**Tech Stack:** Next.js 15 · tRPC v11 · Zustand · shadcn/ui Sheet · @dnd-kit/core + @dnd-kit/sortable · Vitest · Tailwind

---

## File Map

**Create:**
- `src/store/pinned-items-store.ts` — universal pin store
- `src/components/sidebar/compendium-section.tsx` — expandable per-type sidebar section
- `src/components/sidebar/compendium-search.tsx` — global search bar replacing nav temporarily
- `src/components/compendium/CompendiumItemSheet.tsx` — unified quick-view sheet
- `src/components/sidebar/PinnedItemFlags.tsx` — replaces PinnedCharacterFlags

**Modify:**
- `src/store/header-store.ts` — add `campaignId` field
- `src/app/(app)/campaigns/[slug]/layout.tsx` — set `campaignId` in header store
- `src/components/sidebar.tsx` — full restructure
- `src/app/(app)/app-shell.tsx` — swap old components for new
- `src/app/(app)/campaigns/[slug]/players/page.tsx` — update pin store import

**Delete (Task 7):**
- `src/app/(app)/campaigns/[slug]/homebrew/page.tsx`
- `src/components/compendium/` (entire directory)
- `src/store/compendium-store.ts`
- `src/store/pinned-characters-store.ts`
- `src/components/character/PinnedCharacterFlags.tsx`
- `src/components/character/CharacterSheetDrawer.tsx`

---

## Task 1: usePinnedItems store + install @dnd-kit

**Files:**
- Create: `src/store/pinned-items-store.ts`
- Create: `src/store/__tests__/pinned-items-store.test.ts`

- [ ] **Step 1: Install @dnd-kit packages**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: packages added to `node_modules`, no peer dep errors.

- [ ] **Step 2: Write failing tests**

Create `src/store/__tests__/pinned-items-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePinnedItems } from '../pinned-items-store';

beforeEach(() => {
  usePinnedItems.setState({ pinned: [], activeSheetItem: null });
});

describe('usePinnedItems', () => {
  it('pins an item and assigns next order', () => {
    const { result } = renderHook(() => usePinnedItems());
    act(() => result.current.pin({ id: 'npc-1', entityType: 'npc', name: 'Arveth', order: 0 }));
    expect(result.current.pinned).toHaveLength(1);
    expect(result.current.pinned[0].id).toBe('npc-1');
  });

  it('does not duplicate pins', () => {
    const { result } = renderHook(() => usePinnedItems());
    const item = { id: 'npc-1', entityType: 'npc' as const, name: 'Arveth', order: 0 };
    act(() => result.current.pin(item));
    act(() => result.current.pin(item));
    expect(result.current.pinned).toHaveLength(1);
  });

  it('unpins by id', () => {
    const { result } = renderHook(() => usePinnedItems());
    act(() => result.current.pin({ id: 'npc-1', entityType: 'npc', name: 'Arveth', order: 0 }));
    act(() => result.current.unpin('npc-1'));
    expect(result.current.pinned).toHaveLength(0);
  });

  it('isPinned returns true for pinned items', () => {
    const { result } = renderHook(() => usePinnedItems());
    act(() => result.current.pin({ id: 'item-1', entityType: 'item', name: 'Sword', order: 0 }));
    expect(result.current.isPinned('item-1')).toBe(true);
    expect(result.current.isPinned('npc-1')).toBe(false);
  });

  it('reorder swaps order values', () => {
    const { result } = renderHook(() => usePinnedItems());
    act(() => {
      result.current.pin({ id: 'a', entityType: 'npc', name: 'A', order: 0 });
      result.current.pin({ id: 'b', entityType: 'item', name: 'B', order: 1 });
    });
    act(() => result.current.reorder(['b', 'a']));
    expect(result.current.pinned[0].id).toBe('b');
    expect(result.current.pinned[1].id).toBe('a');
  });

  it('openSheet sets activeSheetItem', () => {
    const { result } = renderHook(() => usePinnedItems());
    act(() => result.current.openSheet({ id: 'npc-1', entityType: 'npc', name: 'Arveth', order: 0 }));
    expect(result.current.activeSheetItem?.id).toBe('npc-1');
  });

  it('closeSheet clears activeSheetItem', () => {
    const { result } = renderHook(() => usePinnedItems());
    act(() => result.current.openSheet({ id: 'npc-1', entityType: 'npc', name: 'Arveth', order: 0 }));
    act(() => result.current.closeSheet());
    expect(result.current.activeSheetItem).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL (store not yet defined)**

```bash
npx vitest run src/store/__tests__/pinned-items-store.test.ts
```

Expected: FAIL — `Cannot find module '../pinned-items-store'`

- [ ] **Step 4: Create the store**

Create `src/store/pinned-items-store.ts`:

```typescript
import { create } from 'zustand';

export type PinnedEntityType = 'npc' | 'item' | 'location' | 'spell' | 'monster' | 'encounter';

export interface PinnedItem {
  id: string;
  entityType: PinnedEntityType;
  name: string;
  iconUrl?: string;
  order: number;
}

interface PinnedItemsStore {
  pinned: PinnedItem[];
  activeSheetItem: PinnedItem | null;
  pin: (item: PinnedItem) => void;
  unpin: (id: string) => void;
  isPinned: (id: string) => boolean;
  reorder: (orderedIds: string[]) => void;
  openSheet: (item: PinnedItem) => void;
  closeSheet: () => void;
}

export const usePinnedItems = create<PinnedItemsStore>((set, get) => ({
  pinned: [],
  activeSheetItem: null,
  pin: (item) =>
    set((s) => ({
      pinned: s.pinned.some((p) => p.id === item.id)
        ? s.pinned
        : [...s.pinned, { ...item, order: s.pinned.length }],
    })),
  unpin: (id) =>
    set((s) => ({
      pinned: s.pinned.filter((p) => p.id !== id),
      activeSheetItem: s.activeSheetItem?.id === id ? null : s.activeSheetItem,
    })),
  isPinned: (id) => get().pinned.some((p) => p.id === id),
  reorder: (orderedIds) =>
    set((s) => {
      const map = new Map(s.pinned.map((p) => [p.id, p]));
      return {
        pinned: orderedIds
          .map((id, idx) => (map.has(id) ? { ...map.get(id)!, order: idx } : null))
          .filter(Boolean) as PinnedItem[],
      };
    }),
  openSheet: (item) => set({ activeSheetItem: item }),
  closeSheet: () => set({ activeSheetItem: null }),
}));
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx vitest run src/store/__tests__/pinned-items-store.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/pinned-items-store.ts src/store/__tests__/pinned-items-store.test.ts package.json package-lock.json
git commit -m "feat(compendium): add usePinnedItems store + install dnd-kit"
```

---

## Task 2: header-store + campaign layout campaignId

**Files:**
- Modify: `src/store/header-store.ts`
- Modify: `src/app/(app)/campaigns/[slug]/layout.tsx`

- [ ] **Step 1: Add campaignId to header store**

Edit `src/store/header-store.ts` — add `campaignId` field:

```typescript
import { create } from 'zustand';

export type HeaderStat = {
  label: string;
  value: string | number;
  alert?: boolean;
};

export type HeaderSlot = {
  label: string;
  title: string;
  campaignSlug?: string;
  campaignId?: string;
  badge?: { text: string; color: 'amber' | 'sky' };
  stats?: HeaderStat[];
} | null;

interface HeaderStore {
  slot: HeaderSlot;
  setSlot: (slot: HeaderSlot) => void;
}

export const useHeaderStore = create<HeaderStore>((set) => ({
  slot: null,
  setSlot: (slot) => set({ slot }),
}));
```

- [ ] **Step 2: Set campaignId in campaign layout**

In `src/app/(app)/campaigns/[slug]/layout.tsx`, find the `setSlot` call (line ~71) and add `campaignId`:

```typescript
    setSlot({
      label: 'Campaign',
      title: data.name,
      campaignSlug: slug,
      campaignId: data.id,
      stats: statItems,
    });
```

- [ ] **Step 3: Verify TypeScript passes**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/store/header-store.ts src/app/(app)/campaigns/[slug]/layout.tsx
git commit -m "feat(compendium): expose campaignId in header store"
```

---

## Task 3: CompendiumItemSheet

**Files:**
- Create: `src/components/compendium/CompendiumItemSheet.tsx`

The sheet is opened by pin clicks and ⊞ icons. It fetches its own data based on `entityType` + `entityId`, renders type-specific content, and provides Pin toggle + Open page buttons.

- [ ] **Step 1: Create the sheet component**

Create `src/components/compendium/CompendiumItemSheet.tsx`:

```typescript
'use client';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Pin, PinOff, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { usePinnedItems, type PinnedEntityType } from '@/store/pinned-items-store';
import { useCampaign } from '@/components/campaign/campaign-context';
import { cn } from '@/lib/utils';

interface CompendiumItemSheetProps {
  entityType: PinnedEntityType;
  entityId: string;
  open: boolean;
  onClose: () => void;
}

export function CompendiumItemSheet({ entityType, entityId, open, onClose }: CompendiumItemSheetProps) {
  const router = useRouter();
  const { slug } = useCampaign();
  const { isPinned, pin, unpin } = usePinnedItems();
  const pinned = isPinned(entityId);

  const npc = trpc.npcs.getById.useQuery(
    { id: entityId },
    { enabled: open && entityType === 'npc' }
  );
  const homebrew = trpc.homebrew.getContentById.useQuery(
    { id: entityId },
    { enabled: open && ['item', 'location', 'spell', 'monster'].includes(entityType) }
  );
  const encounter = trpc.encounterPlans.getById.useQuery(
    { planId: entityId },
    { enabled: open && entityType === 'encounter' }
  );

  function getEntityName(): string {
    if (entityType === 'npc') return (npc.data as any)?.name ?? '…';
    if (entityType === 'encounter') return (encounter.data as any)?.name ?? '…';
    return (homebrew.data as any)?.name ?? '…';
  }

  function getPagePath(): string {
    const base = `/campaigns/${slug}`;
    if (entityType === 'npc') return `${base}/npcs/${entityId}`;
    if (entityType === 'encounter') return `${base}/encounters/${entityId}`;
    return `${base}/homebrew/${entityId}`;
  }

  function handlePinToggle() {
    if (pinned) {
      unpin(entityId);
      onClose();
    } else {
      pin({ id: entityId, entityType, name: getEntityName(), order: 0 });
    }
  }

  const entityName = getEntityName();

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] p-0 flex flex-col bg-[hsl(240,10%,8%)] border-l border-[hsl(35_35%_18%)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[hsl(35_35%_16%)] flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <EntityIcon entityType={entityType} name={entityName} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{entityName}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{entityType}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePinToggle}
              className={cn(
                'h-7 text-[11px] gap-1',
                pinned ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/15' : ''
              )}
            >
              {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              {pinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { router.push(getPagePath()); onClose(); }}
              className="h-7 text-[11px] gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {entityType === 'npc' && <NpcContent data={npc.data as any} loading={npc.isLoading} />}
          {['item', 'location', 'spell', 'monster'].includes(entityType) && (
            <HomebrewContent data={homebrew.data as any} loading={homebrew.isLoading} entityType={entityType} />
          )}
          {entityType === 'encounter' && <EncounterContent data={encounter.data as any} loading={encounter.isLoading} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EntityIcon({ entityType, name }: { entityType: PinnedEntityType; name: string }) {
  const typeConfig: Record<PinnedEntityType, { bg: string; border: string; text: string; icon?: string; round: boolean }> = {
    npc:      { bg: 'bg-amber-500/15',  border: 'border-amber-500/30',  text: 'text-amber-400',  round: true },
    item:     { bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-400', icon: '⚔',  round: false },
    location: { bg: 'bg-emerald-500/15',border: 'border-emerald-500/30',text: 'text-emerald-400',icon: '🗺', round: false },
    spell:    { bg: 'bg-violet-500/15', border: 'border-violet-500/30', text: 'text-violet-400', icon: '✦',  round: false },
    monster:  { bg: 'bg-red-500/15',    border: 'border-red-500/30',    text: 'text-red-400',    icon: '💀', round: false },
    encounter:{ bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', icon: '⚡', round: false },
  };
  const cfg = typeConfig[entityType];
  return (
    <div className={cn(
      'w-8 h-8 flex items-center justify-center border text-sm font-bold flex-shrink-0',
      cfg.bg, cfg.border, cfg.text,
      cfg.round ? 'rounded-full' : 'rounded-md'
    )}>
      {cfg.icon ?? name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded p-2 text-center">
      <p className="text-sm font-bold text-foreground">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-2">{label}</p>;
}

function NpcContent({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data) return null;
  const stats = data.stats ?? {};
  return (
    <div className="space-y-4">
      {(stats.hp || stats.ac || stats.speed) && (
        <div>
          <SectionLabel label="Combat" />
          <div className="grid grid-cols-4 gap-2">
            {stats.hp    && <StatBlock label="HP"    value={stats.hp} />}
            {stats.ac    && <StatBlock label="AC"    value={stats.ac} />}
            {stats.prof  && <StatBlock label="Prof"  value={`+${stats.prof}`} />}
            {stats.speed && <StatBlock label="Speed" value={stats.speed} />}
          </div>
        </div>
      )}
      {stats.abilities && (
        <div>
          <SectionLabel label="Abilities" />
          <div className="grid grid-cols-6 gap-1.5 text-center">
            {(['STR','DEX','CON','INT','WIS','CHA'] as const).map((a) => (
              <div key={a}>
                <p className="text-sm font-bold text-foreground">{stats.abilities[a.toLowerCase()] ?? '—'}</p>
                <p className="text-[9px] text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.description && (
        <div>
          <SectionLabel label="Description" />
          <p className="text-xs text-muted-foreground leading-relaxed">{data.description}</p>
        </div>
      )}
      {data.faction && (
        <div>
          <SectionLabel label="Faction" />
          <p className="text-xs text-foreground">{data.faction}</p>
        </div>
      )}
      {data.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(data.tags as string[]).map((t) => (
            <Badge key={t} variant="outline" className="text-[10px] py-0">{t}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function HomebrewContent({ data, loading, entityType }: { data: any; loading: boolean; entityType: PinnedEntityType }) {
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data) return null;
  const d = data.data ?? {};
  const labels: Record<string, string[]> = {
    item:     ['type', 'rarity', 'attunement', 'weight', 'cost'],
    location: ['region', 'type', 'population'],
    spell:    ['level', 'school', 'castingTime', 'range', 'duration', 'components'],
    monster:  ['cr', 'type', 'alignment', 'hp', 'ac'],
  };
  const fields = labels[entityType] ?? [];
  return (
    <div className="space-y-4">
      {fields.some((f) => d[f]) && (
        <div className="grid grid-cols-2 gap-2">
          {fields.filter((f) => d[f]).map((f) => (
            <div key={f} className="bg-white/[0.03] border border-white/[0.06] rounded p-2">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{f}</p>
              <p className="text-xs text-foreground mt-0.5">{String(d[f])}</p>
            </div>
          ))}
        </div>
      )}
      {(d.description ?? data.description) && (
        <div>
          <SectionLabel label="Description" />
          <p className="text-xs text-muted-foreground leading-relaxed">{d.description ?? data.description}</p>
        </div>
      )}
      {data.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(data.tags as string[]).map((t) => (
            <Badge key={t} variant="outline" className="text-[10px] py-0">{t}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function EncounterContent({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data) return null;
  return (
    <div className="space-y-4">
      {(data.difficulty || data.partySize || data.partyLevel) && (
        <div className="grid grid-cols-3 gap-2">
          {data.difficulty  && <StatBlock label="Difficulty" value={data.difficulty} />}
          {data.partySize   && <StatBlock label="Party"      value={data.partySize} />}
          {data.partyLevel  && <StatBlock label="Level"      value={data.partyLevel} />}
        </div>
      )}
      {data.participants?.length > 0 && (
        <div>
          <SectionLabel label="Creatures" />
          <div className="space-y-1">
            {(data.participants as any[]).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-white/[0.04]">
                <span className="text-foreground">{p.name}</span>
                <span className="text-muted-foreground">HP {p.maxHp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.notes && (
        <div>
          <SectionLabel label="Notes" />
          <p className="text-xs text-muted-foreground leading-relaxed">{data.notes}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors from the new file. If `useCampaign` context isn't available in sheet (sheet may render outside campaign provider), swap to reading slug from pathname: `const pathname = usePathname(); const slug = pathname.match(/\/campaigns\/([^/]+)/)?.[1] ?? '';`

- [ ] **Step 3: Commit**

```bash
git add src/components/compendium/CompendiumItemSheet.tsx
git commit -m "feat(compendium): add CompendiumItemSheet component"
```

---

## Task 4: SidebarCompendiumSection

**Files:**
- Create: `src/components/sidebar/compendium-section.tsx`

A reusable expandable section. Accepts content type + campaign ID, queries the right tRPC endpoint, renders a filter input + item list + "+ New" + "+N more" link.

- [ ] **Step 1: Create the component**

Create `src/components/sidebar/compendium-section.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Pin, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { usePinnedItems, type PinnedEntityType } from '@/store/pinned-items-store';
import { CompendiumItemSheet } from '@/components/compendium/CompendiumItemSheet';
import type { LucideIcon } from 'lucide-react';

interface CompendiumSectionProps {
  label: string;
  entityType: PinnedEntityType;
  icon: LucideIcon;
  campaignId: string;
  slug: string;
  listHref: string;
  createHref?: string;
  collapsed: boolean;
}

const HOMEBREW_TYPES: PinnedEntityType[] = ['item', 'location', 'spell', 'monster'];

export function CompendiumSection({
  label,
  entityType,
  icon: Icon,
  campaignId,
  slug,
  listHref,
  collapsed,
}: CompendiumSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('');
  const [sheetItem, setSheetItem] = useState<{ id: string; name: string } | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { isPinned, pin, unpin } = usePinnedItems();

  const isActive = pathname.startsWith(listHref);

  const npcs = trpc.npcs.getAll.useQuery(
    { campaignId, search: filter || undefined },
    { enabled: expanded && entityType === 'npc', staleTime: 60_000 }
  );

  const encounters = trpc.encounterPlans.getByCampaign.useQuery(
    { campaignId },
    { enabled: expanded && entityType === 'encounter', staleTime: 60_000 }
  );

  const homebrew = trpc.homebrew.getContent.useQuery(
    { campaignId, type: entityType as any, limit: 50 },
    { enabled: expanded && HOMEBREW_TYPES.includes(entityType), staleTime: 60_000 }
  );

  type Item = { id: string; name: string };

  function getItems(): Item[] {
    if (entityType === 'npc') return (npcs.data as any[]) ?? [];
    if (entityType === 'encounter') {
      const all = (encounters.data as any[]) ?? [];
      return filter ? all.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase())) : all;
    }
    const items = (homebrew.data as any)?.items ?? (homebrew.data as any[]) ?? [];
    return filter ? items.filter((i: any) => i.name.toLowerCase().includes(filter.toLowerCase())) : items;
  }

  const allItems = getItems();
  const shown = allItems.slice(0, 8);
  const extra = allItems.length - shown.length;

  if (collapsed) {
    return (
      <Link
        href={listHref}
        title={label}
        className={cn(
          'flex justify-center py-[7px] transition-colors',
          isActive ? 'text-amber-400/90' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
      </Link>
    );
  }

  return (
    <>
      {/* Section header */}
      <div className={cn('flex items-center', isActive && !expanded && 'bg-amber-500/[0.07]')}>
        <Link
          href={listHref}
          className={cn(
            'relative flex flex-1 items-center gap-2.5 px-5 py-[7px] text-sm font-sans font-medium transition-colors',
            isActive ? 'text-amber-400/90' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
          )}
        >
          {isActive && !expanded && (
            <span className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: 'hsl(35 80% 55%)', boxShadow: '0 0 8px hsl(35 80% 48% / 0.55)' }} />
          )}
          <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-amber-400/90' : 'opacity-60')} strokeWidth={1.8} />
          <span>{label}</span>
        </Link>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="px-3 py-[7px] text-muted-foreground hover:text-foreground transition-colors"
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-150', expanded && 'rotate-90')} strokeWidth={2} />
        </button>
      </div>

      {/* Inline list */}
      {expanded && (
        <div className="bg-black/20 border-y border-white/[0.04]">
          {/* Filter input */}
          <div className="px-3 py-1.5">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}…`}
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20"
            />
          </div>

          {/* Items */}
          {shown.map((item) => {
            const active = pathname.includes(`/${item.id}`);
            const pinned = isPinned(item.id);
            return (
              <div
                key={item.id}
                className={cn(
                  'group flex items-center justify-between px-4 py-1.5 cursor-pointer hover:bg-white/[0.04] transition-colors',
                  active && 'border-l-2 border-amber-500/70 bg-amber-500/[0.06] pl-[14px]'
                )}
                onClick={() => router.push(`${listHref}/${item.id}`)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <EntityBadge entityType={entityType} name={item.name} />
                  <span className={cn('text-[11px] truncate', active ? 'text-white' : 'text-muted-foreground')}>{item.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {pinned && <Pin className="h-3 w-3 text-amber-400/60" />}
                  <button
                    onClick={(e) => { e.stopPropagation(); setSheetItem(item); }}
                    className="text-muted-foreground hover:text-foreground p-0.5"
                    title="Quick view"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-1.5">
            <Link href={`${listHref}/new`} className="text-[10px] text-amber-500/70 hover:text-amber-400 transition-colors">
              + New {label.slice(0, -1)}
            </Link>
            {extra > 0 && (
              <Link href={listHref} className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                +{extra} more →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Quick-view sheet */}
      {sheetItem && (
        <CompendiumItemSheet
          entityType={entityType}
          entityId={sheetItem.id}
          open={!!sheetItem}
          onClose={() => setSheetItem(null)}
        />
      )}
    </>
  );
}

function EntityBadge({ entityType, name }: { entityType: PinnedEntityType; name: string }) {
  if (entityType === 'npc') {
    return (
      <span className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-[8px] font-bold text-amber-400 shrink-0">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  const icons: Record<PinnedEntityType, string> = {
    npc: '', item: '⚔', location: '🗺', spell: '✦', monster: '💀', encounter: '⚡',
  };
  return <span className="text-[10px] shrink-0 leading-none">{icons[entityType]}</span>;
}
```

- [ ] **Step 2: Handle new NPC — the NPCs "new" route is `/npcs/new`, not `/npcs/new`. Verify the route exists:**

```bash
ls src/app/\(app\)/campaigns/\[slug\]/npcs/new/
```

If it doesn't exist, change `+ New NPC` link in the footer to open the NPC create sheet instead. Check `src/app/(app)/campaigns/[slug]/npcs/new/page.tsx` — if it exists, keep the link.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Fix any type errors before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar/compendium-section.tsx
git commit -m "feat(compendium): add SidebarCompendiumSection component"
```

---

## Task 5: SidebarCompendiumSearch

**Files:**
- Create: `src/components/sidebar/compendium-search.tsx`

Global search bar at top of sidebar. On input, replaces nav with a flat search result list. Escape/clear restores nav.

- [ ] **Step 1: Create the component**

Create `src/components/sidebar/compendium-search.tsx`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { usePinnedItems, type PinnedEntityType } from '@/store/pinned-items-store';
import { CompendiumItemSheet } from '@/components/compendium/CompendiumItemSheet';

interface CompendiumSearchProps {
  campaignId: string;
  slug: string;
  collapsed: boolean;
  onSearchActive: (active: boolean) => void;
}

const TYPE_LABELS: Record<PinnedEntityType, string> = {
  npc: 'NPCs', item: 'Items', location: 'Locations',
  spell: 'Spells', monster: 'Monsters', encounter: 'Encounters',
};

export function CompendiumSearch({ campaignId, slug, collapsed, onSearchActive }: CompendiumSearchProps) {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const { isPinned } = usePinnedItems();
  const [sheetItem, setSheetItem] = useState<{ id: string; name: string; entityType: PinnedEntityType } | null>(null);

  const active = query.length > 0;

  const npcs = trpc.npcs.getAll.useQuery(
    { campaignId, search: query },
    { enabled: active && !!campaignId, staleTime: 30_000 }
  );

  const homebrew = trpc.homebrew.getContent.useQuery(
    { campaignId, search: query, limit: 20 },
    { enabled: active && !!campaignId, staleTime: 30_000 }
  );

  const encounters = trpc.encounterPlans.getByCampaign.useQuery(
    { campaignId },
    { enabled: active && !!campaignId, staleTime: 60_000 }
  );

  function getPath(entityType: PinnedEntityType, id: string): string {
    const base = `/campaigns/${slug}`;
    if (entityType === 'npc') return `${base}/npcs/${id}`;
    if (entityType === 'encounter') return `${base}/encounters/${id}`;
    return `${base}/homebrew/${id}`;
  }

  type Result = { id: string; name: string; entityType: PinnedEntityType };

  function buildResults(): { type: PinnedEntityType; items: Result[] }[] {
    const groups: { type: PinnedEntityType; items: Result[] }[] = [];

    const npcItems = ((npcs.data as any[]) ?? []).map((n: any) => ({ id: n.id, name: n.name, entityType: 'npc' as const }));
    if (npcItems.length) groups.push({ type: 'npc', items: npcItems.slice(0, 5) });

    const hbItems = ((homebrew.data as any)?.items ?? (homebrew.data as any[]) ?? []);
    const byType = hbItems.reduce((acc: Record<string, Result[]>, i: any) => {
      const t = i.type as PinnedEntityType;
      if (!acc[t]) acc[t] = [];
      acc[t].push({ id: i.id, name: i.name, entityType: t });
      return acc;
    }, {} as Record<string, Result[]>);
    for (const [type, items] of Object.entries(byType)) {
      if (items.length) groups.push({ type: type as PinnedEntityType, items: (items as Result[]).slice(0, 5) });
    }

    const encItems = ((encounters.data as any[]) ?? [])
      .filter((e: any) => e.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)
      .map((e: any) => ({ id: e.id, name: e.name, entityType: 'encounter' as const }));
    if (encItems.length) groups.push({ type: 'encounter', items: encItems });

    return groups;
  }

  const handleClear = useCallback(() => {
    setQuery('');
    onSearchActive(false);
  }, [onSearchActive]);

  if (collapsed) return null;

  return (
    <div className="px-3 py-2 border-b border-[hsl(35_35%_14%)]">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); onSearchActive(e.target.value.length > 0); }}
          onKeyDown={(e) => e.key === 'Escape' && handleClear()}
          placeholder="Search campaign…"
          className="w-full bg-white/[0.05] border border-white/[0.09] rounded px-2.5 py-1.5 pl-7 text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors"
        />
        {active && (
          <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Results */}
      {active && (
        <div className="mt-1 max-h-72 overflow-y-auto">
          {buildResults().length === 0 && !npcs.isLoading && !homebrew.isLoading ? (
            <p className="text-[11px] text-muted-foreground/50 py-2 px-1">No results</p>
          ) : (
            buildResults().map(({ type, items }) => (
              <div key={type}>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 px-1 pt-2 pb-0.5">
                  {TYPE_LABELS[type]}
                </p>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center justify-between px-1 py-1 rounded cursor-pointer hover:bg-white/[0.04] transition-colors"
                    onClick={() => { router.push(getPath(item.entityType, item.id)); handleClear(); }}
                  >
                    <span className="text-[11px] text-muted-foreground group-hover:text-foreground truncate">{item.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSheetItem(item); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {sheetItem && (
        <CompendiumItemSheet
          entityType={sheetItem.entityType}
          entityId={sheetItem.id}
          open={!!sheetItem}
          onClose={() => setSheetItem(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar/compendium-search.tsx
git commit -m "feat(compendium): add CompendiumSearch sidebar component"
```

---

## Task 6: PinnedItemFlags + drag-to-reorder

**Files:**
- Create: `src/components/sidebar/PinnedItemFlags.tsx`

Replaces `PinnedCharacterFlags`. Renders right-edge flag buttons for all pinned entities. Drag-to-reorder via dnd-kit. Clicking a pin opens `CompendiumItemSheet`; clicking the active page's pin unpins it.

- [ ] **Step 1: Create the component**

Create `src/components/sidebar/PinnedItemFlags.tsx`:

```typescript
'use client';

import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePinnedItems, type PinnedItem, type PinnedEntityType } from '@/store/pinned-items-store';
import { CompendiumItemSheet } from '@/components/compendium/CompendiumItemSheet';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const TYPE_STYLES: Record<PinnedEntityType, { bg: string; border: string; activeBorder: string; text: string; icon?: string; round: boolean }> = {
  npc:      { bg: 'bg-[hsl(240,10%,8%)]', border: 'border-amber-800/35',  activeBorder: 'border-amber-500/55',  text: 'text-amber-400', round: true },
  item:     { bg: 'bg-[hsl(240,10%,7%)]', border: 'border-indigo-800/30', activeBorder: 'border-indigo-500/50', text: 'text-indigo-400', icon: '⚔', round: false },
  location: { bg: 'bg-[hsl(240,10%,7%)]', border: 'border-emerald-800/30',activeBorder: 'border-emerald-500/50',text: 'text-emerald-400',icon: '🗺',round: false },
  spell:    { bg: 'bg-[hsl(240,10%,7%)]', border: 'border-violet-800/30', activeBorder: 'border-violet-500/50', text: 'text-violet-400', icon: '✦', round: false },
  monster:  { bg: 'bg-[hsl(240,10%,7%)]', border: 'border-red-800/30',    activeBorder: 'border-red-500/50',    text: 'text-red-400',    icon: '💀',round: false },
  encounter:{ bg: 'bg-[hsl(240,10%,7%)]', border: 'border-orange-800/30', activeBorder: 'border-orange-500/50', text: 'text-orange-400', icon: '⚡',round: false },
};

export function PinnedItemFlags() {
  const { pinned, unpin, reorder } = usePinnedItems();
  const [sheetItem, setSheetItem] = useState<PinnedItem | null>(null);
  const pathname = usePathname();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pinned.findIndex((p) => p.id === active.id);
    const newIndex = pinned.findIndex((p) => p.id === over.id);
    const newOrder = [...pinned];
    const [moved] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, moved);
    reorder(newOrder.map((p) => p.id));
  }

  if (pinned.length === 0) return null;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pinned.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div
            className="fixed right-0 z-40 flex flex-col gap-1.5 pointer-events-none"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            {pinned.map((item) => (
              <SortablePin
                key={item.id}
                item={item}
                pathname={pathname}
                onOpen={(i) => setSheetItem(i)}
                onUnpin={unpin}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {sheetItem && (
        <CompendiumItemSheet
          entityType={sheetItem.entityType}
          entityId={sheetItem.id}
          open={!!sheetItem}
          onClose={() => setSheetItem(null)}
        />
      )}
    </>
  );
}

function SortablePin({
  item,
  pathname,
  onOpen,
  onUnpin,
}: {
  item: PinnedItem;
  pathname: string;
  onOpen: (item: PinnedItem) => void;
  onUnpin: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const cfg = TYPE_STYLES[item.entityType];
  const isActivePage = pathname.includes(`/${item.id}`);

  function handleClick() {
    if (isActivePage) {
      onUnpin(item.id);
    } else {
      onOpen(item);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('group relative pointer-events-auto flex items-center', isDragging && 'opacity-70 z-50')}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex flex-col gap-[3px] px-1 py-2 cursor-grab opacity-20 group-hover:opacity-60 transition-opacity"
      >
        <span className={cn('w-[3px] h-[3px] rounded-full', isActivePage ? 'bg-amber-400' : 'bg-muted-foreground')} />
        <span className={cn('w-[3px] h-[3px] rounded-full', isActivePage ? 'bg-amber-400' : 'bg-muted-foreground')} />
      </div>

      {/* Flag button */}
      <button
        onClick={handleClick}
        title={isActivePage ? `Unpin ${item.name}` : item.name}
        className={cn(
          'flex items-center justify-center w-11 h-[52px] rounded-l-xl border border-r-0 transition-all duration-150',
          'shadow-[-2px_0_8px_rgba(0,0,0,0.4)]',
          cfg.bg,
          isActivePage
            ? cn(cfg.activeBorder, 'shadow-[-2px_0_12px_rgba(0,0,0,0.5)]')
            : cn(cfg.border, 'hover:border-opacity-70')
        )}
      >
        {item.entityType === 'npc' ? (
          item.iconUrl ? (
            <div className="relative h-8 w-8 rounded-full overflow-hidden border border-amber-800/40 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.iconUrl} alt={item.name} className="h-full w-full object-cover object-top" />
            </div>
          ) : (
            <div className={cn('h-8 w-8 rounded-full border flex items-center justify-center shrink-0 text-xs font-bold font-display', cfg.bg, cfg.border, cfg.text)}>
              {item.name.charAt(0).toUpperCase()}
            </div>
          )
        ) : (
          <span className="text-lg leading-none">{TYPE_STYLES[item.entityType].icon}</span>
        )}
      </button>

      {/* Hover tooltip */}
      <div className="absolute right-11 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 whitespace-nowrap z-50">
        <div className="rounded-l-md border border-r-0 border-amber-800/35 bg-[hsl(240,10%,8%)] px-2.5 py-1 text-xs font-medium text-foreground/80 shadow-[-2px_0_8px_rgba(0,0,0,0.4)]">
          {isActivePage ? `Unpin ${item.name}` : item.name}
        </div>
      </div>

      {/* Unpin button (hover, non-active) */}
      {!isActivePage && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnpin(item.id); }}
          className="absolute -top-1 left-[10px] h-4 w-4 rounded-full bg-[hsl(240,10%,14%)] border border-border/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/80 hover:border-destructive/60"
          title="Unpin"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar/PinnedItemFlags.tsx
git commit -m "feat(compendium): add PinnedItemFlags with drag-to-reorder"
```

---

## Task 7: Sidebar restructure

**Files:**
- Modify: `src/components/sidebar.tsx`

Replace `getCampaignNav` with the new structure: CAMPAIGN + WORLD (with chevron sections) + LIBRARY (with chevron sections). Remove Homebrew item and bottom Compendium panel. Add CompendiumSearch and CompendiumSection. Move Characters/Members/Settings to bottom icon row.

- [ ] **Step 1: Rewrite sidebar.tsx**

Replace the entire contents of `src/components/sidebar.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Settings,
  PanelLeftClose,
  PanelLeft,
  CalendarDays,
  ScrollText,
  Brain,
  Shield,
  UsersRound,
  Home,
  Drama,
  Swords,
  Package,
  MapPin,
  Sparkles,
  Skull,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { QuiverLogo } from '@/components/logo/quiver-logo';
import { useLogoVariant } from '@/hooks/use-logo-variant';
import { useHeaderStore } from '@/store/header-store';
import { CompendiumSection } from '@/components/sidebar/compendium-section';
import { CompendiumSearch } from '@/components/sidebar/compendium-search';

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  collapsed: boolean;
  exact?: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'relative flex items-center gap-2.5 px-5 py-[7px] text-sm font-sans font-medium transition-colors',
        isActive
          ? 'text-amber-400/90 bg-amber-500/[0.07]'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
        collapsed && 'justify-center px-0'
      )}
    >
      {isActive && (
        <span
          className="absolute left-0 top-0 bottom-0 w-0.5"
          style={{ background: 'hsl(35 80% 55%)', boxShadow: '0 0 8px hsl(35 80% 48% / 0.55)' }}
        />
      )}
      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-amber-400/90' : 'opacity-60')} strokeWidth={1.8} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="h-3" />;
  return (
    <p className="px-5 pt-4 pb-1.5 text-[11px] font-sans font-bold uppercase tracking-[0.18em]" style={{ color: 'hsl(35 10% 55%)' }}>
      {label}
    </p>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const slot = useHeaderStore((s) => s.slot);

  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];
  const campaignId = slot?.campaignId ?? '';
  const inCampaign = !!campaignSlug && !!campaignId;

  const baseVariant = useLogoVariant();
  const isLiveSession = pathname.match(/\/sessions\/[^/]+\/live$/) !== null;
  const logoVariant = isLiveSession ? 'gilded' : baseVariant;

  return (
    <aside
      className={cn(
        'relative hidden md:flex flex-col border-r border-[hsl(35_35%_18%)] transition-all duration-200',
        'bg-[hsl(240,10%,7%)]',
        collapsed ? 'w-16' : 'w-[240px] 2xl:w-[280px]'
      )}
    >
      {/* Ambient gradients */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{ background: ['radial-gradient(ellipse 140% 30% at 50% 0%, hsl(35 80% 38% / 0.14) 0%, transparent 60%)', 'radial-gradient(ellipse 80% 20% at 85% 0%, hsl(260 50% 45% / 0.09) 0%, transparent 50%)'].join(', ') }} />
      <div className="absolute top-0 right-[-1px] w-px h-full pointer-events-none z-10" style={{ background: 'linear-gradient(180deg, transparent 0%, hsl(35 80% 55% / 0.35) 25%, hsl(35 80% 62% / 0.35) 55%, transparent 100%)' }} />

      {/* Logo */}
      <div className={cn('relative z-10 flex items-center border-b border-[hsl(35_35%_18%)]', collapsed ? 'justify-center px-3 h-14' : 'justify-between px-5 h-14')}>
        {collapsed ? (
          <>
            <Link href="/dashboard" aria-label="QuiverDM"><QuiverLogo variant={logoVariant} size="sm" /></Link>
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} className="absolute right-1 h-7 w-7" aria-label="Expand sidebar">
              <PanelLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
          </>
        ) : (
          <>
            <Link href="/dashboard" className="flex items-center gap-2.5 leading-none min-w-0">
              <QuiverLogo variant={logoVariant} size="md" />
              <div className="flex flex-col min-w-0">
                <span className="font-display text-[13px] font-bold tracking-[0.1em] leading-none" style={{ color: 'hsl(35 70% 88%)', textShadow: '0 0 18px hsl(35 80% 48% / 0.35)' }}>
                  QUIVER<span style={{ color: 'hsl(35 80% 62%)' }}>DM</span>
                </span>
                <span className="font-sans text-[8px] uppercase tracking-[0.14em] mt-1" style={{ color: 'hsl(240 5% 36%)' }}>Campaign Companion</span>
              </div>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} className="h-7 w-7 shrink-0" aria-label="Collapse sidebar">
              <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
          </>
        )}
      </div>

      {/* Search */}
      {inCampaign && (
        <CompendiumSearch
          campaignId={campaignId}
          slug={campaignSlug!}
          collapsed={collapsed}
          onSearchActive={setSearchActive}
        />
      )}

      {/* Navigation */}
      <nav className={cn('relative z-10 flex-1 overflow-y-auto py-1', searchActive && 'invisible h-0 overflow-hidden')}>
        {inCampaign && (
          <>
            <div className="mx-3 my-3 border-t border-[hsl(35_35%_14%)]" />

            <SectionLabel label="Campaign" collapsed={collapsed} />
            <NavItem href={`/campaigns/${campaignSlug}`}         label="Overview"  icon={Home}        isActive={pathname === `/campaigns/${campaignSlug}`} collapsed={collapsed} exact />
            <NavItem href={`/campaigns/${campaignSlug}/sessions`} label="Sessions"  icon={CalendarDays} isActive={pathname.startsWith(`/campaigns/${campaignSlug}/sessions`)} collapsed={collapsed} />
            <NavItem href={`/campaigns/${campaignSlug}/summaries`} label="Summaries" icon={ScrollText}  isActive={pathname.startsWith(`/campaigns/${campaignSlug}/summaries`)} collapsed={collapsed} />

            <SectionLabel label="World" collapsed={collapsed} />
            <CompendiumSection label="NPCs"      entityType="npc"      icon={Drama}  campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/npcs`}       collapsed={collapsed} />
            <NavItem href={`/campaigns/${campaignSlug}/brain`} label="DM Brain" icon={Brain} isActive={pathname.startsWith(`/campaigns/${campaignSlug}/brain`)} collapsed={collapsed} />
            <CompendiumSection label="Encounters" entityType="encounter" icon={Swords} campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/encounters`}  collapsed={collapsed} />

            <SectionLabel label="Library" collapsed={collapsed} />
            <CompendiumSection label="Items"     entityType="item"     icon={Package}   campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/homebrew`}   collapsed={collapsed} />
            <CompendiumSection label="Locations" entityType="location" icon={MapPin}    campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/homebrew`}   collapsed={collapsed} />
            <CompendiumSection label="Spells"    entityType="spell"    icon={Sparkles}  campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/homebrew`}   collapsed={collapsed} />
            <CompendiumSection label="Monsters"  entityType="monster"  icon={Skull}     campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/homebrew`}   collapsed={collapsed} />
          </>
        )}
      </nav>

      {/* Bottom icon row */}
      <div className="relative z-10 border-t border-[hsl(35_35%_18%)] py-2 flex items-center gap-1 px-2">
        {inCampaign && (
          <>
            <Link
              href={`/campaigns/${campaignSlug}/players`}
              title="Party"
              className={cn('flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded text-xs transition-colors', pathname.startsWith(`/campaigns/${campaignSlug}/players`) ? 'text-amber-400/90 bg-amber-500/[0.07]' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]')}
            >
              <Shield className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              {!collapsed && <span>Party</span>}
            </Link>
            <Link
              href={`/campaigns/${campaignSlug}/members`}
              title="Members"
              className={cn('flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded text-xs transition-colors', pathname.startsWith(`/campaigns/${campaignSlug}/members`) ? 'text-amber-400/90 bg-amber-500/[0.07]' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]')}
            >
              <UsersRound className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              {!collapsed && <span>Members</span>}
            </Link>
          </>
        )}
        <Link
          href="/settings"
          title="Settings"
          className={cn('flex items-center justify-center p-1.5 rounded transition-colors', pathname.startsWith('/settings') ? 'text-amber-400/90' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]')}
        >
          <Settings className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const pathname = usePathname();
  const slot = useHeaderStore((s) => s.slot);
  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];
  const campaignId = slot?.campaignId ?? '';
  const inCampaign = !!campaignSlug && !!campaignId;

  const renderLink = (item: { href: string; label: string; icon: React.ElementType }, exact = false) => {
    const isActive = exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link key={item.href} href={item.href} className={cn('relative flex items-center gap-2.5 px-5 py-2 text-sm font-medium transition-colors', isActive ? 'text-amber-400/90 bg-amber-500/[0.07]' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]')}>
        {isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: 'hsl(35 80% 55%)', boxShadow: '0 0 8px hsl(35 80% 48% / 0.55)' }} />}
        <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-amber-400/90' : 'opacity-60')} strokeWidth={1.8} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <nav className="flex flex-col py-2">
      {inCampaign ? (
        <>
          <p className="px-5 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">Campaign</p>
          {renderLink({ href: `/campaigns/${campaignSlug}`,          label: 'Overview',   icon: Home         }, true)}
          {renderLink({ href: `/campaigns/${campaignSlug}/sessions`,  label: 'Sessions',   icon: CalendarDays })}
          {renderLink({ href: `/campaigns/${campaignSlug}/summaries`, label: 'Summaries',  icon: ScrollText   })}
          <p className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">World</p>
          {renderLink({ href: `/campaigns/${campaignSlug}/npcs`,       label: 'NPCs',       icon: Drama  })}
          {renderLink({ href: `/campaigns/${campaignSlug}/brain`,      label: 'DM Brain',   icon: Brain  })}
          {renderLink({ href: `/campaigns/${campaignSlug}/encounters`, label: 'Encounters', icon: Swords })}
          <p className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">Library</p>
          {renderLink({ href: `/campaigns/${campaignSlug}/homebrew`,   label: 'Homebrew',   icon: Package })}
          <p className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">App</p>
          {renderLink({ href: `/campaigns/${campaignSlug}/players`,  label: 'Party',   icon: Shield    })}
          {renderLink({ href: `/campaigns/${campaignSlug}/members`,  label: 'Members', icon: UsersRound})}
          {renderLink({ href: '/campaigns', label: 'All Campaigns', icon: ChevronLeft })}
          {renderLink({ href: '/settings',  label: 'Settings',      icon: Settings    })}
        </>
      ) : (
        <>
          {renderLink({ href: '/settings', label: 'Settings', icon: Settings })}
        </>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Fix any type errors. Common issue: `slot?.campaignId` may be `undefined` — ensure `campaignId` is only used when `inCampaign` is true (it is, via the `inCampaign` guard).

- [ ] **Step 3: Start dev server and verify sidebar renders**

```bash
npm run dev
```

Open http://localhost:3847 in a browser. Navigate into a campaign. Verify:
- CAMPAIGN section shows Overview/Sessions/Summaries
- WORLD shows NPCs (with chevron), DM Brain, Encounters (with chevron)
- LIBRARY shows Items/Locations/Spells/Monsters (each with chevron)
- Bottom row shows Party / Members / Settings
- Clicking a section label navigates correctly
- Clicking a chevron expands the inline list

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat(compendium): restructure sidebar with expandable compendium sections"
```

---

## Task 8: app-shell.tsx update + players page + cleanup

**Files:**
- Modify: `src/app/(app)/app-shell.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/players/page.tsx`
- Delete: multiple files

- [ ] **Step 1: Update app-shell.tsx**

In `src/app/(app)/app-shell.tsx`:
- Remove `import { CompendiumPanel } from '@/components/compendium/compendium-panel'`
- Remove `import { PinnedCharacterFlags } from '@/components/character/PinnedCharacterFlags'`
- Add `import { PinnedItemFlags } from '@/components/sidebar/PinnedItemFlags'`
- In the JSX, replace `<CompendiumPanel />` and `<PinnedCharacterFlags />` with `<PinnedItemFlags />`

The relevant section becomes:

```typescript
import { PinnedItemFlags } from '@/components/sidebar/PinnedItemFlags';

// ...inside AppShell return:
      <ConsoleLogCapture />
      <FeedbackWidget />
      <PinnedItemFlags />
    </OnboardingCheck>
```

- [ ] **Step 2: Update players/page.tsx**

Read `src/app/(app)/campaigns/[slug]/players/page.tsx` and find the import of `usePinnedCharacters`. Replace it with `usePinnedItems`:

```typescript
// Remove:
import { usePinnedCharacters } from '@/store/pinned-characters-store';

// Add:
import { usePinnedItems } from '@/store/pinned-items-store';
```

Then update any usages: `usePinnedCharacters()` → `usePinnedItems()`. The `pin` method signature changes from `pin({ characterId, campaignId, name, portraitUrl })` to `pin({ id, entityType: 'npc', name, iconUrl, order: 0 })`. Update the call site accordingly. The `isPinned` call changes from `isPinned(characterId)` to `isPinned(id)`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Delete old files**

```bash
git rm src/app/\(app\)/campaigns/\[slug\]/homebrew/page.tsx
git rm src/components/compendium/compendium-panel.tsx
git rm src/components/compendium/chapters-tab.tsx
git rm src/components/compendium/monsters-tab.tsx
git rm src/components/compendium/encounters-tab.tsx
git rm src/components/compendium/items-tab.tsx
git rm src/components/compendium/detail-pane.tsx
git rm src/store/compendium-store.ts
git rm src/store/pinned-characters-store.ts
git rm src/components/character/PinnedCharacterFlags.tsx
git rm src/components/character/CharacterSheetDrawer.tsx
```

- [ ] **Step 5: Type-check after deletions**

```bash
npx tsc --noEmit
```

Fix any remaining import errors (search for `compendium-store`, `pinned-characters`, `CharacterSheetDrawer`, `PinnedCharacterFlags` in the codebase and remove/replace).

- [ ] **Step 6: Run the app and smoke-test**

```bash
npm run dev
```

Verify end-to-end:
1. Open a campaign — sidebar shows new structure
2. Click NPCs chevron — inline list expands, items appear
3. Type in filter input — list narrows
4. Click ⊞ icon on a row — sheet opens from right
5. Click Pin in sheet — pin appears in right rail
6. Drag a pin — order changes
7. Click a non-active pin — sheet opens
8. Navigate to that NPC's page — pin glows amber; clicking it unpins
9. Use top search bar — results appear grouped by type; Escape clears

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(compendium): wire PinnedItemFlags into app-shell, clean up old components"
```

- [ ] **Step 8: Push**

```bash
git push origin main
```
