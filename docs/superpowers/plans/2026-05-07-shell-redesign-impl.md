# Desktop Shell Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current sidebar + header + max-width shell with CommandRail (icon rail) + CommandBar (48px top bar with pressure gauges) + SplitCanvas/BentoCanvas layout components, going full-bleed at 2560×1440.

**Architecture:** Five new layout components replace the sidebar and header. `app-shell.tsx` drops the `<Sidebar>`, the `<header>`, and the max-width wrapper. Each page migrates from `PageLayout` to `SplitCanvas` or `BentoCanvas`. `HeaderStore` gains `isDM` so `CommandBar` can show gauges without prop drilling.

**Tech Stack:** Next.js 15 App Router, React, Tailwind, Zustand (`header-store`), tRPC (`brain.state.get`), Lucide icons, localStorage.

**Spec:** `docs/superpowers/specs/2026-05-07-desktop-layout-design.md`

---

## File Map

| Action | File |
|--------|------|
| Create | `src/components/layout/command-rail.tsx` |
| Create | `src/components/layout/command-bar.tsx` |
| Create | `src/components/layout/canvas-header.tsx` |
| Create | `src/components/layout/split-canvas.tsx` |
| Create | `src/components/layout/bento-canvas.tsx` |
| Modify | `src/store/header-store.ts` |
| Modify | `src/app/(app)/campaigns/[slug]/layout.tsx` |
| Modify | `src/app/(app)/app-shell.tsx` |
| Modify | `src/app/(app)/campaigns/[slug]/sessions/page.tsx` |
| Modify | `src/app/(app)/campaigns/[slug]/npcs/page.tsx` |
| Modify | `src/app/(app)/campaigns/[slug]/encounters/page.tsx` |
| Modify | `src/app/(app)/campaigns/[slug]/members/page.tsx` |
| Modify | `src/app/(app)/campaigns/[slug]/page.tsx` |
| Modify | `src/app/(app)/dashboard/page.tsx` |
| Modify | `src/app/(app)/campaigns/page.tsx` |
| Modify | `src/app/(app)/homebrew/page.tsx` |
| Delete | `src/hooks/use-campaign-page-slot.ts` |

---

## Task 1: Extend HeaderSlot with isDM

The `CommandBar` needs to know whether the current user is DM to decide whether to show pressure gauges. The campaign layout already has this information — we just need to thread it through the store.

**Files:**
- Modify: `src/store/header-store.ts`
- Modify: `src/app/(app)/campaigns/[slug]/layout.tsx`

- [ ] **Step 1.1: Add isDM to HeaderSlot**

Replace the contents of `src/store/header-store.ts` with:

```ts
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
  isDM?: boolean;
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

- [ ] **Step 1.2: Set isDM in campaign layout; remove max-width wrapper**

In `src/app/(app)/campaigns/[slug]/layout.tsx`:

Replace the `setSlot` call (around line 71) with:
```tsx
setSlot({
  label: 'Campaign',
  title: data.name,
  campaignSlug: slug,
  campaignId: data.id,
  isDM,
});
```
(Remove the `stats: statItems` line — campaign-level stats now live in canvas headers, not the command bar.)

Replace the return block's wrapper div:
```tsx
// before
<CampaignProvider value={{ campaignId: data.id, slug, name: data.name, role, isOwner: role === 'OWNER', isDM }}>
  <div className="w-full max-w-[1400px]">
    {children}
  </div>
</CampaignProvider>

// after
<CampaignProvider value={{ campaignId: data.id, slug, name: data.name, role, isOwner: role === 'OWNER', isDM }}>
  {children}
</CampaignProvider>
```

Also fix the loading and error skeleton wrappers (lines 86-101) — remove `max-w-6xl 2xl:max-w-[1500px]` from the wrapper divs, replacing with `className="p-6"`.

- [ ] **Step 1.3: Verify types compile**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 1.4: Commit**

```bash
git add src/store/header-store.ts src/app/(app)/campaigns/[slug]/layout.tsx
git commit -m "feat(shell): add isDM to HeaderSlot, remove max-width from campaign layout"
```

---

## Task 2: CanvasHeader component

A flat 52px header strip used inside SplitCanvas and BentoCanvas. Replaces the tall `PageLayout` hero card.

**Files:**
- Create: `src/components/layout/canvas-header.tsx`

- [ ] **Step 2.1: Create CanvasHeader**

Create `src/components/layout/canvas-header.tsx`:

```tsx
import { cn } from '@/lib/utils';

export interface CanvasHeaderStat {
  label: string;
  value: string | number;
  alert?: boolean;
}

interface CanvasHeaderProps {
  overline: string;
  title: string;
  stats?: CanvasHeaderStat[];
  actions?: React.ReactNode;
  className?: string;
}

export function CanvasHeader({ overline, title, stats, actions, className }: CanvasHeaderProps) {
  return (
    <div
      className={cn('relative flex-shrink-0 overflow-hidden border-b', className)}
      style={{
        borderColor: 'hsl(35 35% 13%)',
        background: 'linear-gradient(135deg, hsl(240 12% 9% / 0.98) 0%, hsl(240 12% 5.5% / 0.96) 100%)',
      }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 60% 80% at 0% 0%, hsl(35 80% 55% / 0.09), transparent 55%)',
            'radial-gradient(ellipse 30% 60% at 92% 10%, hsl(260 50% 45% / 0.06), transparent 40%)',
          ].join(', '),
        }}
      />

      <div className="relative flex items-center justify-between gap-4 px-5 py-3">
        {/* Left: overline + title */}
        <div className="min-w-0">
          <p
            className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.22em] font-display"
            style={{ color: 'hsl(35 80% 55% / 0.6)' }}
          >
            {overline}
          </p>
          <h1
            className="text-lg font-bold leading-none tracking-[0.04em] font-display truncate"
            style={{ color: 'hsl(35 30% 92%)' }}
          >
            {title}
          </h1>
        </div>

        {/* Right: stats + actions */}
        {(stats?.length || actions) && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {stats?.map((stat) => (
              <div
                key={stat.label}
                className="rounded border px-2.5 py-1.5 text-center min-w-[44px]"
                style={{
                  borderColor: stat.alert ? 'hsl(35 60% 45% / 0.35)' : 'hsl(255 10% 100% / 0.07)',
                  background: stat.alert ? 'hsl(35 60% 45% / 0.07)' : 'hsl(255 10% 100% / 0.025)',
                }}
              >
                <p
                  className="text-sm font-bold tabular-nums leading-none"
                  style={{ color: stat.alert ? 'hsl(35 70% 65%)' : 'hsl(35 30% 78%)' }}
                >
                  {stat.value}
                </p>
                <p
                  className="mt-0.5 text-[9px] uppercase tracking-[0.14em] leading-none"
                  style={{ color: 'hsl(35 40% 45% / 0.6)' }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2.2: Verify types**

```bash
npx tsc --noEmit
```

- [ ] **Step 2.3: Commit**

```bash
git add src/components/layout/canvas-header.tsx
git commit -m "feat(shell): add CanvasHeader component — flat strip replaces PageLayout hero"
```

---

## Task 3: SplitCanvas component

The 26/74% two-pane layout shell used by list pages (Sessions, NPCs, Encounters, Members, Campaigns, Homebrew).

**Files:**
- Create: `src/components/layout/split-canvas.tsx`

- [ ] **Step 3.1: Create SplitCanvas**

Create `src/components/layout/split-canvas.tsx`:

```tsx
import { cn } from '@/lib/utils';
import { CanvasHeader, type CanvasHeaderStat } from './canvas-header';

interface SplitCanvasProps {
  // Canvas header
  overline: string;
  title: string;
  stats?: CanvasHeaderStat[];
  actions?: React.ReactNode;
  // Left pane — full content ownership by the page
  leftPane: React.ReactNode;
  // Canvas pane body
  children: React.ReactNode;
  className?: string;
}

export function SplitCanvas({
  overline,
  title,
  stats,
  actions,
  leftPane,
  children,
  className,
}: SplitCanvasProps) {
  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      <CanvasHeader overline={overline} title={title} stats={stats} actions={actions} />

      {/* Split body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane — 26% */}
        <div
          className="flex flex-col overflow-hidden"
          style={{
            width: '26%',
            flexShrink: 0,
            borderRight: '1px solid hsl(35 35% 11%)',
            background: 'hsl(240 12% 4.2%)',
          }}
        >
          {leftPane}
        </div>

        {/* Canvas pane — 74% */}
        <div
          className="flex flex-1 flex-col overflow-hidden"
          style={{ background: 'hsl(240 12% 5%)' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.2: Verify types**

```bash
npx tsc --noEmit
```

- [ ] **Step 3.3: Commit**

```bash
git add src/components/layout/split-canvas.tsx
git commit -m "feat(shell): add SplitCanvas layout component"
```

---

## Task 4: BentoCanvas component

Full-width canvas shell for overview/dashboard pages. No left pane — everything is in the canvas body.

**Files:**
- Create: `src/components/layout/bento-canvas.tsx`

- [ ] **Step 4.1: Create BentoCanvas**

Create `src/components/layout/bento-canvas.tsx`:

```tsx
import { cn } from '@/lib/utils';
import { CanvasHeader, type CanvasHeaderStat } from './canvas-header';

interface BentoCanvasProps {
  overline: string;
  title: string;
  stats?: CanvasHeaderStat[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function BentoCanvas({
  overline,
  title,
  stats,
  actions,
  children,
  className,
}: BentoCanvasProps) {
  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      <CanvasHeader overline={overline} title={title} stats={stats} actions={actions} />
      <div className="flex-1 overflow-y-auto p-5">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2: Verify types**

```bash
npx tsc --noEmit
```

- [ ] **Step 4.3: Commit**

```bash
git add src/components/layout/bento-canvas.tsx
git commit -m "feat(shell): add BentoCanvas layout component"
```

---

## Task 5: CommandRail component

Replaces the current sidebar. 72px default (collapsed, icon-only), pins to 260px via localStorage. Shows campaign nav when inside a campaign, global nav otherwise.

**Files:**
- Create: `src/components/layout/command-rail.tsx`

- [ ] **Step 5.1: Create CommandRail**

Create `src/components/layout/command-rail.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Swords, BookOpen, ScrollText,
  Home, CalendarDays, Drama, Library, Brain,
  Shield, Settings, PanelLeft, PanelLeftClose,
} from 'lucide-react';
import { QuiverLogo } from '@/components/logo/quiver-logo';
import { useHeaderStore } from '@/store/header-store';
import { useLogoVariant } from '@/hooks/use-logo-variant';

const RAIL_KEY = 'quiver.rail.pinned';

function RailItem({
  href,
  label,
  icon: Icon,
  isActive,
  pinned,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  pinned: boolean;
}) {
  return (
    <Link
      href={href}
      title={!pinned ? label : undefined}
      className={cn(
        'relative flex items-center gap-3 transition-colors',
        pinned ? 'px-4 py-2.5' : 'justify-center py-2.5',
        isActive
          ? 'text-amber-400/90'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
      )}
      style={isActive ? { background: 'hsl(35 80% 55% / 0.08)' } : undefined}
    >
      {isActive && (
        <span
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
          style={{ background: 'hsl(35 80% 55%)', boxShadow: '0 0 8px hsl(35 80% 48% / 0.5)' }}
        />
      )}
      <Icon
        className={cn('h-4 w-4 shrink-0', isActive ? 'text-amber-400/90' : 'opacity-60')}
        strokeWidth={1.8}
      />
      {pinned && (
        <span className="text-sm font-medium font-sans leading-none">{label}</span>
      )}
    </Link>
  );
}

function RailDivider() {
  return <div className="mx-3 my-1.5 border-t" style={{ borderColor: 'hsl(35 35% 14%)' }} />;
}

export function CommandRail() {
  const pathname = usePathname();
  const slot = useHeaderStore((s) => s.slot);
  const [pinned, setPinned] = useState(false);
  const logoVariant = useLogoVariant();
  const isLiveSession = pathname.match(/\/sessions\/[^/]+\/live$/) !== null;

  useEffect(() => {
    const saved = localStorage.getItem(RAIL_KEY);
    if (saved === 'true') setPinned(true);
  }, []);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem(RAIL_KEY, String(next));
  };

  const campaignSlug = slot?.campaignSlug;
  const inCampaign = !!campaignSlug;
  const width = pinned ? 260 : 72;

  return (
    <aside
      className="relative hidden md:flex flex-col border-r flex-shrink-0 transition-all duration-200"
      style={{
        width,
        borderColor: 'hsl(35 35% 18%)',
        background: 'hsl(240 12% 4.5%)',
      }}
    >
      {/* Ambient gradients */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse 140% 25% at 50% 0%, hsl(35 80% 38% / 0.12), transparent)',
        }}
      />
      <div
        className="absolute top-0 right-[-1px] w-px h-full pointer-events-none z-10"
        style={{
          background: 'linear-gradient(180deg, transparent, hsl(35 80% 55% / 0.30) 30%, hsl(35 80% 55% / 0.30) 65%, transparent)',
        }}
      />

      {/* Logo row */}
      <div
        className="relative z-10 flex items-center border-b flex-shrink-0"
        style={{
          height: 48,
          borderColor: 'hsl(35 35% 18%)',
          padding: pinned ? '0 16px' : '0',
          justifyContent: pinned ? 'space-between' : 'center',
        }}
      >
        {pinned ? (
          <>
            <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
              <QuiverLogo variant={isLiveSession ? 'gilded' : logoVariant} size="md" />
              <div className="flex flex-col min-w-0">
                <span
                  className="font-display text-[12px] font-bold tracking-[0.1em] leading-none"
                  style={{ color: 'hsl(35 70% 88%)', textShadow: '0 0 18px hsl(35 80% 48% / 0.35)' }}
                >
                  QUIVER<span style={{ color: 'hsl(35 80% 62%)' }}>DM</span>
                </span>
                <span
                  className="font-sans text-[8px] uppercase tracking-[0.14em] mt-1"
                  style={{ color: 'hsl(240 5% 36%)' }}
                >
                  Campaign Companion
                </span>
              </div>
            </Link>
            <button
              onClick={togglePin}
              title="Collapse rail"
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/[0.05] transition-colors"
            >
              <PanelLeftClose className="h-3.5 w-3.5 opacity-40" strokeWidth={1.8} />
            </button>
          </>
        ) : (
          <>
            <Link href="/dashboard" aria-label="QuiverDM">
              <QuiverLogo variant={isLiveSession ? 'gilded' : logoVariant} size="sm" />
            </Link>
            <button
              onClick={togglePin}
              title="Pin rail"
              className="absolute right-1 h-6 w-6 flex items-center justify-center rounded hover:bg-white/[0.05] transition-colors"
            >
              <PanelLeft className="h-3 w-3 opacity-40" strokeWidth={1.8} />
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden py-1">
        {inCampaign ? (
          <>
            <RailItem href={`/campaigns/${campaignSlug}`}          label="Overview"   icon={Home}         isActive={pathname === `/campaigns/${campaignSlug}`}                              pinned={pinned} />
            <RailItem href={`/campaigns/${campaignSlug}/sessions`} label="Sessions"   icon={CalendarDays} isActive={pathname.startsWith(`/campaigns/${campaignSlug}/sessions`)}           pinned={pinned} />
            <RailItem href={`/campaigns/${campaignSlug}/npcs`}     label="NPCs"       icon={Drama}        isActive={pathname.startsWith(`/campaigns/${campaignSlug}/npcs`)}               pinned={pinned} />
            <RailItem href={`/campaigns/${campaignSlug}/encounters`} label="Encounters" icon={Swords}     isActive={pathname.startsWith(`/campaigns/${campaignSlug}/encounters`)}          pinned={pinned} />
            <RailDivider />
            <RailItem href={`/campaigns/${campaignSlug}/world`}    label="World Lore" icon={Library}      isActive={pathname.startsWith(`/campaigns/${campaignSlug}/world`)}               pinned={pinned} />
            <RailItem href={`/campaigns/${campaignSlug}/brain`}    label="DM Brain"   icon={Brain}        isActive={pathname.startsWith(`/campaigns/${campaignSlug}/brain`)}               pinned={pinned} />
          </>
        ) : (
          <>
            <RailItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} isActive={pathname === '/dashboard'} pinned={pinned} />
            <RailItem href="/campaigns" label="Campaigns" icon={Swords}          isActive={pathname.startsWith('/campaigns')}  pinned={pinned} />
            <RailItem href="/homebrew"  label="Homebrew"  icon={BookOpen}         isActive={pathname.startsWith('/homebrew')}   pinned={pinned} />
            <RailItem href="/recap"     label="Recaps"    icon={ScrollText}       isActive={pathname.startsWith('/recap')}      pinned={pinned} />
          </>
        )}
      </nav>

      {/* Footer */}
      <div
        className="relative z-10 border-t flex items-center gap-1 px-2 py-2 flex-shrink-0"
        style={{ borderColor: 'hsl(35 35% 18%)' }}
      >
        {inCampaign && (
          <Link
            href={`/campaigns/${campaignSlug}/players`}
            title="Party"
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded text-xs transition-colors',
              pathname.startsWith(`/campaigns/${campaignSlug}/players`)
                ? 'text-amber-400/90 bg-amber-500/[0.07]'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
            )}
          >
            <Shield className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            {pinned && <span>Party</span>}
          </Link>
        )}
        <Link
          href="/settings"
          title="Settings"
          className={cn(
            'flex items-center justify-center p-1.5 rounded transition-colors',
            pathname.startsWith('/settings') ? 'text-amber-400/90' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
          )}
        >
          <Settings className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5.2: Verify types**

```bash
npx tsc --noEmit
```

- [ ] **Step 5.3: Commit**

```bash
git add src/components/layout/command-rail.tsx
git commit -m "feat(shell): add CommandRail — icon rail replacing sidebar"
```

---

## Task 6: CommandBar component

48px top bar. Shows campaign name + campaign-switcher dropdown + 4 world pressure gauges (DM only) on campaign pages. Shows breadcrumb on global pages.

**Files:**
- Create: `src/components/layout/command-bar.tsx`

- [ ] **Step 6.1: Create CommandBar**

Create `src/components/layout/command-bar.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useHeaderStore } from '@/store/header-store';
import { UserMenu } from '@/components/user-menu';
import { VoiceButton } from '@/components/voice/voice-button';
import { trpc } from '@/lib/trpc';

const PRESSURE_TRACKS = [
  { key: 'pressurePolitical',     label: 'Political' },
  { key: 'pressureSupernatural',  label: 'Supernatural' },
  { key: 'pressureEconomic',      label: 'Economic' },
  { key: 'pressureCosmic',        label: 'Cosmic' },
] as const;

function pressureColor(value: number): string {
  if (value > 0.75) return 'hsl(0 60% 50%)';
  if (value > 0.5)  return 'hsl(35 80% 55%)';
  return 'hsl(240 10% 30%)';
}

function PressureGauges({ campaignId }: { campaignId: string }) {
  const stateQuery = trpc.brain.state.get.useQuery({ campaignId }, { staleTime: 60_000 });
  const state = stateQuery.data as Record<string, number> | undefined;
  if (!state) return null;

  const active = PRESSURE_TRACKS.filter(({ key }) => (state[key] ?? 0) > 0);
  if (!active.length) return null;

  return (
    <div className="flex items-center gap-4 px-4 flex-1">
      {active.map(({ key, label }) => {
        const raw = state[key] ?? 0;
        const pct = Math.round(raw * 100);
        const color = pressureColor(raw);
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <span
              className="text-[8px] uppercase tracking-[0.2em] leading-none"
              style={{ color: 'hsl(240 5% 30%)' }}
            >
              {label}
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className="rounded-full overflow-hidden"
                style={{ width: 40, height: 3, background: 'hsl(255 10% 100% / 0.05)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span
                className="text-[8px] font-bold tabular-nums leading-none"
                style={{ color }}
              >
                {pct}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CampaignDropdown({ slot }: { slot: { title: string; campaignSlug: string; isDM?: boolean; campaignId?: string } }) {
  const router = useRouter();
  const campaigns = trpc.campaigns.getMyMemberships.useQuery(undefined, { staleTime: 300_000 });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex flex-col text-left hover:opacity-75 transition-opacity focus:outline-none flex-shrink-0">
          <span
            className="text-[8px] font-bold uppercase tracking-[0.22em] leading-none mb-0.5"
            style={{ color: 'hsl(35 60% 45%)' }}
          >
            Campaign
          </span>
          <div className="flex items-center gap-1">
            <span
              className="text-[13px] font-bold leading-tight"
              style={{ color: 'hsl(35 30% 90%)' }}
            >
              {slot.title}
            </span>
            <ChevronsUpDown className="h-3 w-3 flex-shrink-0" style={{ color: 'hsl(35 20% 45%)' }} strokeWidth={1.8} />
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {campaigns.data?.map((c) => (
          <DropdownMenuItem
            key={c.slug}
            onClick={() => router.push(`/campaigns/${c.slug}`)}
            className="gap-2"
          >
            {c.slug === slot.campaignSlug
              ? <Check className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              : <span className="w-3.5 flex-shrink-0" />}
            <span className="truncate">{c.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/campaigns')}>
          All campaigns
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CommandBar() {
  const slot = useHeaderStore((s) => s.slot);
  const inCampaign = !!slot?.campaignSlug;

  return (
    <header
      className="relative flex h-12 flex-shrink-0 items-center gap-3 px-4 border-b"
      style={{
        borderColor: 'hsl(35 35% 14%)',
        background: 'linear-gradient(180deg, hsl(240 12% 7% / 0.98), hsl(240 12% 5.5% / 0.96))',
      }}
    >
      {/* Amber glow along the bottom border */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(35 80% 55% / 0.20) 30%, hsl(35 80% 55% / 0.25) 50%, transparent)',
        }}
      />

      {inCampaign && slot?.campaignSlug ? (
        <>
          {/* Campaign dropdown */}
          <CampaignDropdown slot={slot as { title: string; campaignSlug: string; isDM?: boolean; campaignId?: string }} />

          {/* Vertical divider */}
          <div className="h-6 w-px flex-shrink-0" style={{ background: 'hsl(240 10% 18%)' }} />

          {/* Pressure gauges — DM only */}
          {slot.isDM && slot.campaignId && (
            <PressureGauges campaignId={slot.campaignId} />
          )}
          {(!slot.isDM || !slot.campaignId) && <div className="flex-1" />}
        </>
      ) : (
        <div className="flex-1" />
      )}

      {/* Right: voice + user */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
        <VoiceButton />
        <UserMenu />
      </div>
    </header>
  );
}
```

- [ ] **Step 6.2: Verify types**

```bash
npx tsc --noEmit
```

- [ ] **Step 6.4: Commit**

```bash
git add src/components/layout/command-bar.tsx
git commit -m "feat(shell): add CommandBar — 48px bar with campaign switcher and pressure gauges"
```

---

## Task 7: Wire new components into app-shell.tsx

Replace `<Sidebar>` + `<header>` + the max-width `<div>` wrapper with the new components. The `CampaignTitleDropdown` inline in app-shell is now handled by `CommandBar` — delete that function.

**Files:**
- Modify: `src/app/(app)/app-shell.tsx`

- [ ] **Step 7.1: Rewrite app-shell.tsx**

Replace the entire file with:

```tsx
'use client';

import { CommandRail } from '@/components/layout/command-rail';
import { CommandBar } from '@/components/layout/command-bar';
import { MobileSidebar } from '@/components/sidebar';
import { OnboardingCheck } from '@/components/onboarding-check';
import { ErrorBoundary } from '@/components/error-boundary';
import { NavigationProgress } from '@/components/navigation-progress';
import { ConsoleLogCapture } from '@/components/feedback/console-log-capture';
import { FeedbackWidget } from '@/components/feedback/feedback-widget';
import { PinnedItemFlags } from '@/components/sidebar/PinnedItemFlags';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { CampaignVoiceShell } from '@/components/voice/campaign-voice-shell';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CampaignVoiceShell>
      <OnboardingCheck>
        <NavigationProgress />
        <div className="flex h-screen overflow-hidden">
          <CommandRail />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            {/* Mobile menu trigger */}
            <div
              className="md:hidden flex h-12 items-center px-4 border-b"
              style={{ borderColor: 'hsl(35 35% 18%)', background: 'hsl(240 12% 6% / 0.98)' }}
            >
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open navigation menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="glass-shell w-60 p-0 border-r border-border">
                  <div className="flex h-16 items-center px-4 border-b border-border">
                    <span className="font-display text-lg font-bold text-foreground">QuiverDM</span>
                  </div>
                  <MobileSidebar />
                </SheetContent>
              </Sheet>
            </div>

            {/* Desktop command bar */}
            <div className="hidden md:block">
              <CommandBar />
            </div>

            {/* Main content — no max-width, no padding (canvas components own their padding) */}
            <main className="flex-1 overflow-hidden">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>
        </div>
        <ConsoleLogCapture />
        <FeedbackWidget />
        <PinnedItemFlags />
      </OnboardingCheck>
    </CampaignVoiceShell>
  );
}
```

- [ ] **Step 7.2: Verify types**

```bash
npx tsc --noEmit
```

- [ ] **Step 7.3: Start dev server and open the app**

```bash
npm run dev
```

Open http://localhost:3847/dashboard. Verify:
- CommandRail renders on the left (72px, icon-only by default)
- CommandBar renders at top with UserMenu visible
- Main content area is present (pages may look unstyled until migrated)

- [ ] **Step 7.4: Commit**

```bash
git add src/app/(app)/app-shell.tsx
git commit -m "feat(shell): wire CommandRail and CommandBar into app shell"
```

---

## Task 8: Migrate Sessions page

Replace `PageLayout` + the internal `-mx-8` grid with `SplitCanvas`. Remove the `useCampaignPageSlot` call.

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/page.tsx`

- [ ] **Step 8.1: Update imports**

Remove the `PageLayout` import and `useCampaignPageSlot` import. Add:
```tsx
import { SplitCanvas } from '@/components/layout/split-canvas';
```

- [ ] **Step 8.2: Remove useCampaignPageSlot call**

Delete the `useCampaignPageSlot(...)` call from the component body.

- [ ] **Step 8.3: Restructure the return**

Replace the `return (` block. The current structure is:
```tsx
return (
  <PageLayout overline="Sessions" title="Sessions" stats={heroStats} actions={newSessionAction}>
    {/* Mobile list */}
    <div className="md:hidden ...">...</div>
    {/* Desktop master-detail */}
    <div className="hidden md:grid h-[calc(100vh-220px)] overflow-hidden border-t ... -mx-8 grid-cols-[280px_1fr]">
      {/* Left pane */}
      <div className="flex flex-col overflow-hidden border-r ...">
        {/* filter row */}
        {/* scrollable list */}
      </div>
      {/* Right pane */}
      <SessionInspectorPanel ... />
    </div>
  </PageLayout>
);
```

Replace with:
```tsx
// Build the left pane content as a variable for clarity
const leftPane = (
  <div className="flex flex-col h-full overflow-hidden">
    {/* Filter pills */}
    <div
      className="flex flex-wrap gap-1 px-2 py-2 flex-shrink-0 border-b"
      style={{ borderColor: 'hsl(35 35% 18%)' }}
    >
      {(['all', 'in_progress', 'completed', 'planning'] as FilterStatus[]).map((f) => (
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
            filter === f
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          }`}
        >
          {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
          <span className="ml-1 opacity-70">{counts[f]}</span>
        </button>
      ))}
    </div>

    {/* Session list */}
    <div className="flex-1 overflow-y-auto">
      {sessionsQuery.isLoading ? (
        <div className="space-y-1 p-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 w-full rounded" />)}
        </div>
      ) : sessions.length > 0 ? (
        <motion.div variants={listVariants} initial="hidden" animate="visible">
          {/* ...existing session row rendering, unchanged... */}
        </motion.div>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">No sessions match this filter.</p>
      )}
    </div>
  </div>
);

return (
  <>
    {/* Mobile: full-page list (unchanged) */}
    <div className="md:hidden p-4 space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {(['all', 'in_progress', 'completed', 'planning'] as FilterStatus[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="rounded-full h-7 px-3 text-xs">
            {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
            <span className="ml-1.5 opacity-70">{counts[f]}</span>
          </Button>
        ))}
      </div>
      <MobileSessionList sessions={sessions} allSessions={allSessions} slug={slug} isDM={isDM} filter={filter} />
    </div>

    {/* Desktop: SplitCanvas */}
    <div className="hidden md:flex h-full">
      <SplitCanvas
        overline="Sessions"
        title="Sessions"
        stats={heroStats}
        actions={newSessionAction}
        leftPane={leftPane}
      >
        <SessionInspectorPanel
          session={selectedSession}
          slug={slug}
          isDM={isDM}
          onDeselect={() => setSelectedSession(null)}
        />
      </SplitCanvas>
    </div>
  </>
);
```

Note: the session row rendering inside `leftPane` is moved verbatim from the existing `hidden md:grid` block. Preserve all the existing motion variants, `session.id === selectedId` logic, and `setSelectedSession` calls unchanged.

- [ ] **Step 8.4: Verify types**

```bash
npx tsc --noEmit
```

- [ ] **Step 8.5: Check visually**

Open `/campaigns/[any-slug]/sessions`. Verify:
- CommandRail + CommandBar are rendered at shell level
- Sessions page shows left pane (filter pills + list) + right canvas (inspector panel)
- Selecting a session highlights the row and shows the inspector
- Mobile shows the old single-column list (unchanged)

- [ ] **Step 8.6: Commit**

```bash
git add src/app/(app)/campaigns/[slug]/sessions/page.tsx
git commit -m "feat(shell): migrate Sessions page to SplitCanvas"
```

---

## Task 9: Migrate Campaign Overview page

Replace `PageLayout` with `BentoCanvas`. The bento grid cards are unchanged.

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/page.tsx`

- [ ] **Step 9.1: Update imports**

Remove `PageLayout` import. Add:
```tsx
import { BentoCanvas } from '@/components/layout/bento-canvas';
```

- [ ] **Step 9.2: Replace PageLayout in return**

```tsx
// before
return (
  <PageLayout
    overline="Campaign"
    title={(campaign as any)?.name ?? 'Campaign'}
    subtitle={...}
    stats={heroStats}
    actions={isDM ? <span ...>Dungeon Master</span> : undefined}
  >
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* bento cards */}
    </div>
  </PageLayout>
);

// after
return (
  <BentoCanvas
    overline="Campaign"
    title={(campaign as any)?.name ?? 'Campaign'}
    stats={heroStats}
    actions={isDM ? <span className="rounded-full border border-amber-500/35 bg-amber-500/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Dungeon Master</span> : undefined}
  >
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* bento cards — unchanged */}
    </div>
  </BentoCanvas>
);
```

Remove the `subtitle` prop (not in CanvasHeader spec).

- [ ] **Step 9.3: Verify types and visuals**

```bash
npx tsc --noEmit
```

Open `/campaigns/[slug]`. Verify the overview page renders correctly inside BentoCanvas.

- [ ] **Step 9.4: Commit**

```bash
git add src/app/(app)/campaigns/[slug]/page.tsx
git commit -m "feat(shell): migrate Campaign Overview to BentoCanvas"
```

---

## Task 10: Migrate Dashboard page

Replace `PageLayout` with `BentoCanvas`. The two-column layout inside is kept intact.

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 10.1: Update imports**

Remove `PageLayout`. Add:
```tsx
import { BentoCanvas } from '@/components/layout/bento-canvas';
```

- [ ] **Step 10.2: Replace PageLayout**

```tsx
// before
return (
  <PageLayout overline="Dashboard" title="Command Table" subtitle="..." stats={heroStats} actions={<Button asChild>...</Button>}>
    <div className="flex gap-6 items-start">
      {/* left sidebar + right content */}
    </div>
  </PageLayout>
);

// after
return (
  <BentoCanvas
    overline="Dashboard"
    title="Command Table"
    stats={heroStats}
    actions={<Button asChild><Link href="/campaigns/new"><Plus className="mr-2 h-4 w-4" />New Campaign</Link></Button>}
  >
    <div className="flex gap-6 items-start">
      {/* left sidebar + right content — unchanged */}
    </div>
  </BentoCanvas>
);
```

- [ ] **Step 10.3: Verify types + visual check**

```bash
npx tsc --noEmit
```

- [ ] **Step 10.4: Commit**

```bash
git add src/app/(app)/dashboard/page.tsx
git commit -m "feat(shell): migrate Dashboard to BentoCanvas"
```

---

## Task 11: Migrate Members page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/members/page.tsx`

- [ ] **Step 11.1: Read the current members page**

```bash
cat src/app/(app)/campaigns/[slug]/members/page.tsx
```

Identify: the PageLayout call, the master-detail grid (if present from 88e6ef0), and the `useCampaignPageSlot` call.

- [ ] **Step 11.2: Update imports**

Remove `PageLayout`, `useCampaignPageSlot`. Add:
```tsx
import { SplitCanvas } from '@/components/layout/split-canvas';
```

- [ ] **Step 11.3: Remove useCampaignPageSlot call**

Delete it from the component body.

- [ ] **Step 11.4: Wrap in SplitCanvas**

The left pane is the member list; the right canvas is the member detail panel (or the existing inline content if there's no inspector yet). Pattern is identical to Sessions — move the desktop grid content into `leftPane` prop and the detail panel into children.

If the members page doesn't yet have a desktop inspector panel, put the full content in the left pane and show an empty-state placeholder in children:
```tsx
<SplitCanvas overline="Members" title="Party & Members" stats={heroStats} actions={inviteButton} leftPane={<MemberList />}>
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
    Select a member to view details
  </div>
</SplitCanvas>
```

- [ ] **Step 11.5: Verify types + visual**

```bash
npx tsc --noEmit
```

- [ ] **Step 11.6: Commit**

```bash
git add src/app/(app)/campaigns/[slug]/members/page.tsx
git commit -m "feat(shell): migrate Members page to SplitCanvas"
```

---

## Task 12: Migrate NPCs page

The NPCs page already has a master-detail grid from `88e6ef0`. Migration is minimal: replace `PageLayout` with `SplitCanvas`, move left/right grid content into the props.

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/npcs/page.tsx`

- [ ] **Step 12.1: Read the current NPCs page**

```bash
cat src/app/(app)/campaigns/[slug]/npcs/page.tsx
```

Identify the PageLayout + grid structure.

- [ ] **Step 12.2: Swap PageLayout for SplitCanvas**

Follow the same pattern as Sessions (Task 8). Move the 280px left column into `leftPane` prop, NPC detail into children.

- [ ] **Step 12.3: Remove useCampaignPageSlot if present**

Delete the call from the component body.

- [ ] **Step 12.4: Verify types + visual**

```bash
npx tsc --noEmit
```

- [ ] **Step 12.5: Commit**

```bash
git add src/app/(app)/campaigns/[slug]/npcs/page.tsx
git commit -m "feat(shell): migrate NPCs page to SplitCanvas"
```

---

## Task 13: Migrate Encounters page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/encounters/page.tsx`

- [ ] **Step 13.1: Read the current encounters page**

```bash
cat src/app/(app)/campaigns/[slug]/encounters/page.tsx
```

- [ ] **Step 13.2: Swap PageLayout for SplitCanvas**

Follow the same pattern as Sessions. Left pane: encounter list with filter pills. Canvas body: encounter detail or empty state.

- [ ] **Step 13.3: Remove useCampaignPageSlot if present**

- [ ] **Step 13.4: Verify types + visual**

```bash
npx tsc --noEmit
```

- [ ] **Step 13.5: Commit**

```bash
git add src/app/(app)/campaigns/[slug]/encounters/page.tsx
git commit -m "feat(shell): migrate Encounters page to SplitCanvas"
```

---

## Task 14: Migrate /campaigns list page

**Files:**
- Modify: `src/app/(app)/campaigns/page.tsx`

- [ ] **Step 14.1: Read the file**

```bash
cat src/app/(app)/campaigns/page.tsx
```

- [ ] **Step 14.2: Swap PageLayout for BentoCanvas (or SplitCanvas)**

If the page is a simple grid of campaign cards: use `BentoCanvas`.
If the spec wants a left-sidebar pattern with filters: use `SplitCanvas` with a stats/filter sidebar in `leftPane`.

For simplicity, use `BentoCanvas` with the campaign card grid unchanged — the left-sidebar enhancement can come in a follow-up.

- [ ] **Step 14.3: Verify types + visual**

```bash
npx tsc --noEmit
```

- [ ] **Step 14.4: Commit**

```bash
git add src/app/(app)/campaigns/page.tsx
git commit -m "feat(shell): migrate Campaigns list page to BentoCanvas"
```

---

## Task 15: Migrate /homebrew page

**Files:**
- Modify: `src/app/(app)/homebrew/page.tsx`

- [ ] **Step 15.1: Read the file**

```bash
cat src/app/(app)/homebrew/page.tsx
```

- [ ] **Step 15.2: Swap PageLayout for SplitCanvas**

Left pane: type filter sidebar (All / Items / Spells / Creatures / etc.) + Add content links.
Canvas: search bar + card grid (existing content).

- [ ] **Step 15.3: Verify types + visual**

```bash
npx tsc --noEmit
```

- [ ] **Step 15.4: Commit**

```bash
git add src/app/(app)/homebrew/page.tsx
git commit -m "feat(shell): migrate Homebrew page to SplitCanvas"
```

---

## Task 16: Delete use-campaign-page-slot hook + final cleanup

Now that all migrated pages set their stats via canvas header props (not the header slot), `useCampaignPageSlot` is unused.

**Files:**
- Delete: `src/hooks/use-campaign-page-slot.ts`
- Verify: no other files import from it

- [ ] **Step 16.1: Check for remaining usages**

```bash
rg "use-campaign-page-slot" src/
```

If any results remain: those pages haven't been migrated yet. Remove the call from each one.

- [ ] **Step 16.2: Delete the hook file**

```bash
rm src/hooks/use-campaign-page-slot.ts
```

- [ ] **Step 16.3: Full type check + build**

```bash
npx tsc --noEmit
npm run build
```
Expected: no errors.

- [ ] **Step 16.4: Run persona specs**

```bash
npx playwright test tests/personas/veteran-dm.persona.spec.ts --headed
```

Fix any failures before proceeding.

- [ ] **Step 16.5: Commit**

```bash
git add -A
git commit -m "feat(shell): delete use-campaign-page-slot — superseded by canvas header props"
```

- [ ] **Step 16.6: Push to production**

```bash
git push origin main
```

---

## Verification Checklist

Before calling this done, confirm:

- [ ] 2560×1440: canvas fills the full width — no gutters wider than 24px
- [ ] CommandRail collapses to 72px on first load; clicking the pin icon expands to 260px; persists across page reload
- [ ] CommandBar shows campaign name + pressure gauges when signed in as DM on a campaign page
- [ ] CommandBar shows nothing in the center when on Dashboard or /campaigns
- [ ] All 8 migrated pages render the flat CanvasHeader (≤60px) — no tall hero banners
- [ ] Sessions/NPCs/Encounters/Members: left pane scrolls independently from canvas body
- [ ] Mobile (≤768px): existing MobileSidebar sheet works; pages render as single-column stacks
- [ ] `npm run build` passes clean
