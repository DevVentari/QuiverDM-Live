# UI & Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the disjointed multi-route session flow with a single session hub, fix the sidebar context-switching with a persistent two-zone layout, and enforce a consistent page template across all campaign pages.

**Architecture:** Purely a UI/routing refactor — no new DB models, no new tRPC procedures. A `session-lifecycle.ts` utility derives the current session phase from existing fields (`status`, `aiSummaryStatus`, `recordings.length`). The sidebar renders two zones simultaneously instead of swapping between global and campaign modes. Old session sub-routes redirect to the hub.

**Tech Stack:** Next.js 15 App Router, tRPC v11, React, Tailwind, shadcn/ui, Framer Motion, Vitest

---

## File Map

**New files:**
- `src/lib/session-lifecycle.ts` — pure phase derivation utility
- `src/components/campaign/campaign-pill.tsx` — merged campaign switcher+context pill
- `src/components/campaign/continue-action-card.tsx` — context-aware hero card
- `src/components/session/session-pipeline.tsx` — pipeline indicator (Prep→Ran→Processing→Summary→Recap)
- `src/components/session/phase-prep.tsx` — prep phase content
- `src/components/session/phase-processing.tsx` — upload recording phase
- `src/components/session/phase-summary.tsx` — transcript + AI summary phase
- `src/components/session/phase-recap.tsx` — recap editor + share phase
- `src/components/session/phase-complete-row.tsx` — collapsed completed phase row

**Modified files:**
- `src/components/sidebar.tsx` — two-zone refactor, use CampaignPill
- `src/app/(app)/campaigns/[slug]/page.tsx` — campaign overview redesign
- `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` — full session hub rewrite
- `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx` — redirect to hub
- `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx` — redirect to hub
- `src/app/(app)/recap/upload/page.tsx` — redirect to sessions list
- `src/app/(app)/dashboard/page.tsx` — redirect to last active campaign
- `src/app/(app)/campaigns/page.tsx` — template consistency
- `src/app/(app)/campaigns/[slug]/sessions/page.tsx` — template consistency
- `src/app/(app)/campaigns/[slug]/npcs/page.tsx` — template consistency
- `src/app/(app)/campaigns/[slug]/brain/page.tsx` — template consistency
- `src/app/(app)/homebrew/page.tsx` — template consistency

**Test files:**
- `tests/lib/session-lifecycle.test.ts`

---

## Task 1: Session Lifecycle Utility

**Files:**
- Create: `src/lib/session-lifecycle.ts`
- Create: `tests/lib/session-lifecycle.test.ts`

This pure utility derives which phase a session is currently in. All hub logic depends on it.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/session-lifecycle.test.ts
import { describe, it, expect } from 'vitest';
import { deriveSessionPhase, type SessionForPhase } from '@/lib/session-lifecycle';

const base: SessionForPhase = {
  status: 'planning',
  aiSummaryStatus: 'none',
  aiSummary: null,
  recordingCount: 0,
  hasApprovedRecap: false,
};

describe('deriveSessionPhase', () => {
  it('returns prep when status is planning', () => {
    expect(deriveSessionPhase({ ...base, status: 'planning' })).toBe('prep');
  });

  it('returns ran when status is in_progress', () => {
    expect(deriveSessionPhase({ ...base, status: 'in_progress' })).toBe('ran');
  });

  it('returns ran when status is active', () => {
    expect(deriveSessionPhase({ ...base, status: 'active' })).toBe('ran');
  });

  it('returns processing when completed with no recordings', () => {
    expect(deriveSessionPhase({ ...base, status: 'completed', recordingCount: 0 })).toBe('processing');
  });

  it('returns summary when completed with recording but no AI summary', () => {
    expect(deriveSessionPhase({ ...base, status: 'completed', recordingCount: 1, aiSummaryStatus: 'pending' })).toBe('summary');
  });

  it('returns summary when aiSummaryStatus is processing', () => {
    expect(deriveSessionPhase({ ...base, status: 'completed', recordingCount: 1, aiSummaryStatus: 'processing' })).toBe('summary');
  });

  it('returns recap when summary done but no approved recap', () => {
    expect(deriveSessionPhase({ ...base, status: 'completed', recordingCount: 1, aiSummaryStatus: 'done', aiSummary: 'text', hasApprovedRecap: false })).toBe('recap');
  });

  it('returns complete when summary done and recap approved', () => {
    expect(deriveSessionPhase({ ...base, status: 'completed', recordingCount: 1, aiSummaryStatus: 'done', aiSummary: 'text', hasApprovedRecap: true })).toBe('complete');
  });

  it('returns recap when aiSummaryStatus is error but has summary text', () => {
    expect(deriveSessionPhase({ ...base, status: 'completed', recordingCount: 1, aiSummaryStatus: 'error', aiSummary: 'text', hasApprovedRecap: false })).toBe('recap');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd E:/Projects/QuiverDM && npx vitest run tests/lib/session-lifecycle.test.ts
```
Expected: fails with "Cannot find module '@/lib/session-lifecycle'"

- [ ] **Step 3: Implement the utility**

```ts
// src/lib/session-lifecycle.ts
export type SessionPhase = 'prep' | 'ran' | 'processing' | 'summary' | 'recap' | 'complete';

export interface SessionForPhase {
  status: string;           // planning | in_progress | active | completed
  aiSummaryStatus: string;  // none | pending | processing | done | error
  aiSummary: string | null;
  recordingCount: number;
  hasApprovedRecap: boolean;
}

export function deriveSessionPhase(session: SessionForPhase): SessionPhase {
  if (session.status === 'planning') return 'prep';
  if (session.status === 'in_progress' || session.status === 'active') return 'ran';
  // status === 'completed' (or cancelled — treated as processing for simplicity)
  if (session.recordingCount === 0) return 'processing';
  const summaryDone = session.aiSummaryStatus === 'done' && session.aiSummary !== null;
  if (!summaryDone) return 'summary';
  if (!session.hasApprovedRecap) return 'recap';
  return 'complete';
}

export const PHASE_LABELS: Record<SessionPhase, string> = {
  prep: 'Prep',
  ran: 'Ran',
  processing: 'Processing',
  summary: 'Summary',
  recap: 'Recap',
  complete: 'Complete',
};

export const PHASE_ORDER: SessionPhase[] = ['prep', 'ran', 'processing', 'summary', 'recap'];
```

- [ ] **Step 4: Run tests — all must pass**

```bash
npx vitest run tests/lib/session-lifecycle.test.ts
```
Expected: 9 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/session-lifecycle.ts tests/lib/session-lifecycle.test.ts
git commit -m "feat(ui): session lifecycle phase utility with tests"
```

---

## Task 2: CampaignPill Component

**Files:**
- Create: `src/components/campaign/campaign-pill.tsx`

Replaces the dual `CampaignContext` + `CampaignSwitcher` components in the sidebar. Single component that shows the current campaign name and opens a dropdown to switch.

- [ ] **Step 1: Create the component**

```tsx
// src/components/campaign/campaign-pill.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Campaign {
  slug: string;
  name: string;
  sessionCount?: number | null;
}

interface CampaignPillProps {
  current: Campaign | null;
  campaigns: Campaign[];
  collapsed: boolean;
}

export function CampaignPill({ current, campaigns, collapsed }: CampaignPillProps) {
  const router = useRouter();

  const trigger = collapsed ? (
    <button
      className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-[3px] border border-[hsl(35_35%_18%)] bg-[hsl(240,10%,10%)] text-muted-foreground/60 transition-colors hover:border-[hsl(35_50%_26%)] hover:text-foreground"
      title={current?.name ?? 'Select campaign'}
    >
      <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.8} />
    </button>
  ) : (
    <button
      className="mx-3 mb-1 flex w-[calc(100%-24px)] items-center justify-between gap-2 rounded-[3px] border border-[hsl(35_35%_18%)] px-3 py-2 text-left transition-colors hover:border-[hsl(35_50%_26%)]"
      style={{
        background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
        boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.08)',
      }}
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold" style={{ color: 'hsl(35 20% 88%)' }}>
          {current?.name ?? 'Select Campaign'}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'hsl(35 10% 44%)' }}>
          {current ? `${current.sessionCount ?? 0} sessions · switch` : 'No campaign selected'}
        </p>
      </div>
      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" strokeWidth={1.8} />
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-52">
        {campaigns.map((c) => (
          <DropdownMenuItem
            key={c.slug}
            onClick={() => router.push(`/campaigns/${c.slug}`)}
            className="gap-2"
          >
            {c.slug === current?.slug
              ? <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              : <span className="w-3.5 shrink-0" />}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/campaign/campaign-pill.tsx
git commit -m "feat(ui): CampaignPill — unified campaign switcher component"
```

---

## Task 3: Two-Zone Sidebar Refactor

**Files:**
- Modify: `src/components/sidebar.tsx`

Remove `CampaignContext` and `CampaignSwitcher` components. Add `CampaignPill`. Render both global zone and campaign zone simultaneously when `inCampaign === true` — no more full sidebar swap.

- [ ] **Step 1: Replace the Sidebar component body**

Open `src/components/sidebar.tsx`. Replace the entire `Sidebar` function (lines 273–497) and delete the `CampaignContext` (lines 218–271) and `CampaignSwitcher` (lines 129–216) component definitions. Add the import for `CampaignPill`.

The new `Sidebar` function:

```tsx
import { CampaignPill } from '@/components/campaign/campaign-pill';

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { open: openCompendium, isOpen: compendiumOpen } = useCompendiumStore();

  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];
  const inCampaign = !!campaignSlug;

  const campaigns = trpc.campaigns.getMyMemberships.useQuery(undefined, { staleTime: 300_000 });
  const recapDashboard = trpc.recap.getDashboard.useQuery(undefined, { staleTime: 60_000 });
  const pendingRecapCount = recapDashboard.data?.reduce((sum, c) => sum + c.pendingReview, 0) ?? 0;

  const currentCampaign = campaigns.data?.find((c) => c.slug === campaignSlug) ?? null;
  const campaignNavSections = campaignSlug ? getCampaignNav(campaignSlug) : null;

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
      {/* Ambient gradient */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: [
            'radial-gradient(ellipse 140% 30% at 50% 0%, hsl(35 80% 38% / 0.14) 0%, transparent 60%)',
            'radial-gradient(ellipse 80% 20% at 85% 0%, hsl(260 50% 45% / 0.09) 0%, transparent 50%)',
          ].join(', '),
        }}
      />
      {/* Amber right border */}
      <div
        className="absolute top-0 right-[-1px] w-px h-full pointer-events-none z-10"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, hsl(35 80% 55% / 0.35) 25%, hsl(35 80% 62% / 0.35) 55%, transparent 100%)',
        }}
      />

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

      <nav className="relative z-10 flex-1 overflow-y-auto py-1">
        {/* ── Global zone — always visible ── */}
        <SectionLabel label="Navigate" collapsed={collapsed} />
        {globalNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          if (item.href === '/recap' && pendingRecapCount > 0 && !collapsed) {
            return (
              <div key={item.href} className="relative">
                <NavItem {...item} isActive={isActive} collapsed={collapsed} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded-full pointer-events-none" style={{ background: 'hsl(35 60% 18%)', color: 'hsl(35 70% 58%)' }}>
                  {pendingRecapCount}
                </span>
              </div>
            );
          }
          return <NavItem key={item.href} {...item} isActive={isActive} collapsed={collapsed} />;
        })}

        {/* ── Campaign zone — only when inside a campaign ── */}
        {inCampaign && campaignNavSections && (
          <>
            <div className={cn('border-t border-[hsl(35_35%_18%)]', collapsed ? 'mt-2 pt-2' : 'mt-3 pt-1')}>
              <CampaignPill current={currentCampaign} campaigns={campaigns.data ?? []} collapsed={collapsed} />
            </div>
            <SectionLabel label="Campaign" collapsed={collapsed} />
            {campaignNavSections.campaign.map((item) => (
              <NavItem key={item.href} {...item} isActive={item.exact ? pathname === item.href : pathname.startsWith(item.href + '/')} collapsed={collapsed} />
            ))}
            <SectionLabel label="World" collapsed={collapsed} />
            {campaignNavSections.world.map((item) => (
              <NavItem key={item.href} {...item} isActive={pathname === item.href || pathname.startsWith(item.href + '/')} collapsed={collapsed} />
            ))}
            <SectionLabel label="Library" collapsed={collapsed} />
            {campaignNavSections.library.map((item) => (
              <NavItem key={item.href} {...item} isActive={pathname === item.href || pathname.startsWith(item.href + '/')} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[hsl(35_35%_18%)] py-2">
        <button
          onClick={openCompendium}
          className={cn('flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors rounded-sm mx-1', compendiumOpen ? 'text-[var(--card-amber)]' : 'text-muted-foreground hover:text-foreground hover:bg-white/5', collapsed && 'justify-center px-0')}
          title="Compendium" aria-label="Open Compendium"
        >
          <BookOpen className={cn('h-4 w-4 flex-shrink-0', compendiumOpen && 'drop-shadow-[0_0_4px_hsl(35_80%_48%/0.6)]')} strokeWidth={1.8} />
          {!collapsed && <span className="font-body">Compendium</span>}
        </button>
        <NavItem href="/settings" label="Settings" icon={Settings} isActive={pathname === '/settings' || pathname.startsWith('/settings/')} collapsed={collapsed} />
      </div>
    </aside>
  );
}
```

Also remove `ChevronsUpDown`, `Check`, `ChevronLeft`, `Shield` from the lucide imports at the top (no longer used in sidebar.tsx after the CampaignPill extraction). Keep all other imports.

- [ ] **Step 2: Verify TypeScript**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors related to sidebar.tsx or campaign-pill.tsx

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar.tsx src/components/campaign/campaign-pill.tsx
git commit -m "feat(ui): two-zone sidebar — global + campaign zones always visible"
```

---

## Task 4: ContinueActionCard Component

**Files:**
- Create: `src/components/campaign/continue-action-card.tsx`

The context-aware hero card on the campaign overview. Accepts a pre-computed action prop so the logic stays in the page component (easier to test, no hook needed).

- [ ] **Step 1: Create the component**

```tsx
// src/components/campaign/continue-action-card.tsx
'use client';

import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SessionPhase } from '@/lib/session-lifecycle';

export interface ContinueAction {
  sessionId: string;
  sessionNumber: number;
  sessionTitle: string | null;
  phase: SessionPhase;
  label: string;
  description: string;
  href: string;
  icon: string;
  loading?: boolean;
}

interface ContinueActionCardProps {
  action: ContinueAction | null;
  slug: string;
}

export function ContinueActionCard({ action, slug }: ContinueActionCardProps) {
  if (!action) {
    return (
      <div className="stone-card glass-panel">
        <div className="stone-card-body flex flex-col items-center py-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">No active sessions — start your first!</p>
          <Button size="sm" asChild>
            <Link href={`/campaigns/${slug}/sessions/prep`}>Create Session</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="stone-card glass-panel flex items-center gap-4 px-4 py-3"
      style={{ borderColor: 'hsl(35 60% 28%)', background: 'linear-gradient(120deg, hsl(35 80% 55% / 0.06) 0%, transparent 60%)' }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
        style={{ background: 'hsl(35 80% 55% / 0.12)', border: '1px solid hsl(35 80% 55% / 0.25)' }}
      >
        {action.loading ? <Loader2 className="h-4 w-4 animate-spin text-amber-400/60" /> : action.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="label-overline mb-0.5">Continue where you left off</p>
        <p className="text-sm font-semibold truncate">
          Session {action.sessionNumber}{action.sessionTitle ? ` · ${action.sessionTitle}` : ''}
        </p>
        <p className="text-xs text-muted-foreground">{action.description}</p>
      </div>
      <Button size="sm" asChild className="shrink-0">
        <Link href={action.href}>
          {action.label} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/campaign/continue-action-card.tsx
git commit -m "feat(ui): ContinueActionCard — context-aware hero card for campaign overview"
```

---

## Task 5: Campaign Overview Redesign

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/page.tsx`

Replace the existing sparse layout with: header, ContinueActionCard hero, next session row, world pressure + open hooks two-column grid.

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `src/app/(app)/campaigns/[slug]/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Skeleton } from '@/components/ui/skeleton';
import { ContinueActionCard, type ContinueAction } from '@/components/campaign/continue-action-card';
import { HookDetailDrawer } from '@/components/brain/hook-detail-drawer';
import { useState } from 'react';
import { deriveSessionPhase } from '@/lib/session-lifecycle';

// ── Derive the hero CTA from the most recent actionable session ──────────────
function computeContinueAction(
  sessions: any[],
  slug: string
): ContinueAction | null {
  if (!sessions.length) return null;

  for (const session of sessions) {
    const phase = deriveSessionPhase({
      status: session.status ?? 'planning',
      aiSummaryStatus: session.aiSummaryStatus ?? 'none',
      aiSummary: session.aiSummary ?? null,
      recordingCount: session.recordings?.length ?? 0,
      hasApprovedRecap: false, // getAll doesn't include recap detail; hub handles full state
    });

    if (phase === 'complete') continue;

    const base = { sessionId: session.id, sessionNumber: session.sessionNumber, sessionTitle: session.title ?? null };
    const hub = `/campaigns/${slug}/sessions/${session.id}`;

    const actions: Record<string, Omit<ContinueAction, 'sessionId' | 'sessionNumber' | 'sessionTitle'>> = {
      prep:       { phase, icon: '📋', label: 'Continue Prep', description: 'Finish your session prep before game day', href: hub },
      ran:        { phase, icon: '🎮', label: 'End Session',   description: 'Mark session complete and start post-session', href: hub },
      processing: { phase, icon: '🎙️', label: 'Upload Recording', description: 'Upload your audio to generate transcript and summary', href: hub },
      summary:    { phase, icon: '✨', label: 'View Summary',  description: session.aiSummaryStatus === 'processing' ? 'Transcript processing…' : 'Generate AI summary', href: hub, loading: session.aiSummaryStatus === 'processing' },
      recap:      { phase, icon: '📰', label: 'Review Recap',  description: 'Review and approve your session recap', href: hub },
    };

    return { ...base, ...actions[phase] };
  }

  // All sessions complete — prompt to start the next one
  const next = sessions[0];
  return {
    sessionId: next.id,
    sessionNumber: (next.sessionNumber ?? 0) + 1,
    sessionTitle: null,
    phase: 'prep',
    icon: '📋',
    label: 'New Session',
    description: 'All sessions complete — start planning the next one',
    href: `/campaigns/${slug}/sessions/prep`,
  };
}

// ── World pressure bars ───────────────────────────────────────────────────────
const PRESSURE_TRACKS = [
  ['Political',    'pressurePolitical'],
  ['Supernatural', 'pressureSupernatural'],
  ['Economic',     'pressureEconomic'],
  ['Cosmic',       'pressureCosmic'],
  ['Social',       'pressureSocial'],
] as const;

function pressureColor(value: number) {
  if (value > 0.75) return 'hsl(0 62% 50%)';
  if (value > 0.5)  return 'hsl(35 80% 55%)';
  return 'hsl(35 50% 40%)';
}

export default function CampaignOverviewPage() {
  const { campaignId, slug, isDM } = useCampaign();
  const [selectedHook, setSelectedHook] = useState<any>(null);
  const [hookDrawerOpen, setHookDrawerOpen] = useState(false);

  const campaignQuery = trpc.campaigns.getBySlug.useQuery({ slug }, { staleTime: 300_000 });
  const sessionsQuery = trpc.sessions.getAll.useQuery({ campaignId }, { staleTime: 60_000 });
  const stateQuery    = trpc.brain.state.get.useQuery({ campaignId }, { enabled: isDM, staleTime: 60_000 });

  const campaign  = campaignQuery.data;
  const sessions  = (sessionsQuery.data ?? []) as any[];
  const state     = stateQuery.data as Record<string, any> | undefined;
  const hooks     = (Array.isArray(state?.hooks) ? state.hooks : []) as any[];
  const openHooks = hooks.filter((h: any) => h.status !== 'resolved').sort((a: any, b: any) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.urgency as keyof typeof order] ?? 2) - (order[b.urgency as keyof typeof order] ?? 2);
  }).slice(0, 5);

  const nextSession = sessions.find((s: any) => s.status === 'planning' && (!sessions[0] || s.id !== sessions[0].id));
  const continueAction = computeContinueAction(sessions, slug);

  const hasWorldPressure = PRESSURE_TRACKS.some(([, field]) => (state?.[field] ?? 0) > 0);

  if (campaignQuery.isLoading || sessionsQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Campaign header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">{campaign?.name ?? 'Campaign'}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {sessions.length} sessions
            {campaign?.memberCount ? ` · ${campaign.memberCount} members` : ''}
            {campaign?.createdAt ? ` · Active since ${format(new Date(campaign.createdAt), 'MMM yyyy')}` : ''}
          </p>
        </div>
        {isDM && (
          <span className="text-[9px] font-bold px-2 py-1 rounded-full" style={{ background: 'hsl(35 60% 10%)', border: '1px solid hsl(35 60% 28%)', color: 'hsl(35 70% 52%)' }}>
            DM
          </span>
        )}
      </div>

      {/* Hero: continue where you left off */}
      {isDM && <ContinueActionCard action={continueAction} slug={slug} />}

      {/* Next session row */}
      {nextSession && (
        <Link href={`/campaigns/${slug}/sessions/${nextSession.id}`} className="block">
          <div className="stone-card glass-panel flex items-center gap-3 px-4 py-3 hover:border-foreground/20 transition-colors">
            <div className="text-[10px] font-bold px-2 py-1 rounded shrink-0 tabular-nums" style={{ background: 'hsl(240 10% 14%)', border: '1px solid hsl(240 20% 80% / 0.1)', color: 'hsl(240 5% 55%)' }}>
              {nextSession.date ? format(new Date(nextSession.date), 'EEE MMM d') : 'Upcoming'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Session {nextSession.sessionNumber}{nextSession.title ? ` · ${nextSession.title}` : ''}</p>
              <p className="text-xs text-muted-foreground">
                {nextSession.prepStatus === 'complete' ? 'Prep complete' : nextSession.prepStatus === 'draft' ? 'Prep in progress' : 'No prep yet'}
              </p>
            </div>
            {nextSession.prepStatus !== 'none' && (
              <span className="text-xs font-semibold text-amber-400/70 shrink-0">
                {nextSession.prepStatus === 'complete' ? '100%' : 'Prep →'}
              </span>
            )}
          </div>
        </Link>
      )}

      {/* World state — only render if Brain data exists */}
      {isDM && (hasWorldPressure || openHooks.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* World pressure */}
          {hasWorldPressure && (
            <div className="stone-card glass-panel">
              <div className="stone-card-header pb-2">
                <span className="stone-card-title text-xs">World Pressure</span>
              </div>
              <div className="stone-card-body space-y-2.5">
                {PRESSURE_TRACKS.map(([label, field]) => {
                  const raw = state?.[field] ?? 0;
                  if (raw === 0) return null;
                  const pct = Math.round(raw * 100);
                  return (
                    <div key={field}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{label}</span>
                        <span className="text-xs font-mono text-amber-400/80">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pressureColor(raw) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Open hooks */}
          {openHooks.length > 0 && (
            <div className="stone-card glass-panel">
              <div className="stone-card-header pb-2">
                <span className="stone-card-title text-xs">Open Hooks</span>
              </div>
              <div className="stone-card-body divide-y divide-border/50">
                {openHooks.map((hook: any) => (
                  <button
                    key={hook.id}
                    onClick={() => { setSelectedHook(hook); setHookDrawerOpen(true); }}
                    className="flex w-full items-start gap-2.5 py-2 text-left hover:text-foreground transition-colors first:pt-0 last:pb-0"
                  >
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${hook.urgency === 'high' ? 'bg-red-500' : hook.urgency === 'medium' ? 'bg-amber-400' : 'bg-muted-foreground/40'}`} />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">{hook.text}</p>
                      {hook.ageInSessions != null && (
                        <p className="text-[10px] text-muted-foreground/40 mt-0.5">{hook.ageInSessions} sessions old</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedHook && (
        <HookDetailDrawer hook={selectedHook} open={hookDrawerOpen} onClose={() => setHookDrawerOpen(false)} campaignId={campaignId} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | grep "campaigns/\[slug\]/page"
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/page.tsx
git commit -m "feat(ui): campaign overview redesign — hero continue card + world state"
```

---

## Task 6: SessionPipeline Component

**Files:**
- Create: `src/components/session/session-pipeline.tsx`

The pipeline bar rendered at the top of every session hub page.

- [ ] **Step 1: Create the component**

```tsx
// src/components/session/session-pipeline.tsx
'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { PHASE_ORDER, PHASE_LABELS, type SessionPhase } from '@/lib/session-lifecycle';

interface SessionPipelineProps {
  currentPhase: SessionPhase;
  onPhaseClick?: (phase: SessionPhase) => void;
}

export function SessionPipeline({ currentPhase, onPhaseClick }: SessionPipelineProps) {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  return (
    <div className="flex items-center gap-0 rounded-lg overflow-hidden border border-border/60 bg-card/40">
      {PHASE_ORDER.map((phase, i) => {
        const isDone    = currentIndex > i;
        const isActive  = currentIndex === i;
        const isLocked  = currentIndex < i;

        return (
          <button
            key={phase}
            onClick={() => isDone && onPhaseClick?.(phase)}
            disabled={!isDone}
            className={cn(
              'relative flex-1 flex flex-col items-center gap-1 py-2.5 px-1 text-center transition-colors',
              isDone   && 'cursor-pointer hover:bg-white/5',
              isActive && 'bg-amber-500/[0.08]',
              isLocked && 'opacity-40 cursor-default',
              // connector line between steps
              i > 0 && 'border-l border-border/40'
            )}
          >
            {/* Status dot */}
            <div className={cn(
              'h-2 w-2 rounded-full transition-all',
              isDone   && 'bg-emerald-500',
              isActive && 'bg-amber-400 shadow-[0_0_6px_hsl(35_80%_55%/0.5)]',
              isLocked && 'bg-muted-foreground/30 border border-muted-foreground/20'
            )}>
              {isDone && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
            </div>
            <span className={cn(
              'text-[9px] font-semibold uppercase tracking-[0.1em]',
              isDone   && 'text-emerald-400/70',
              isActive && 'text-amber-400',
              isLocked && 'text-muted-foreground/40'
            )}>
              {PHASE_LABELS[phase]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/session/session-pipeline.tsx
git commit -m "feat(ui): SessionPipeline component"
```

---

## Task 7: Session Phase Components

**Files:**
- Create: `src/components/session/phase-complete-row.tsx`
- Create: `src/components/session/phase-prep.tsx`
- Create: `src/components/session/phase-processing.tsx`
- Create: `src/components/session/phase-summary.tsx`
- Create: `src/components/session/phase-recap.tsx`

Each component handles the UI for one lifecycle phase. The processing and summary phases reuse existing components from the current session detail page.

- [ ] **Step 1: Create phase-complete-row.tsx**

```tsx
// src/components/session/phase-complete-row.tsx
import { Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { SessionPhase } from '@/lib/session-lifecycle';
import { PHASE_LABELS } from '@/lib/session-lifecycle';

interface PhaseCompleteRowProps {
  phase: SessionPhase;
  detail: string;
  editHref?: string;
}

export function PhaseCompleteRow({ phase, detail, editHref }: PhaseCompleteRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
        <Check className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-emerald-400/80">{PHASE_LABELS[phase]}</span>
        <span className="text-xs text-muted-foreground/50 ml-2">{detail}</span>
      </div>
      {editHref && (
        <Button variant="ghost" size="sm" asChild className="h-6 px-2 text-[10px] text-muted-foreground/50 hover:text-foreground">
          <Link href={editHref}><Pencil className="h-3 w-3" /></Link>
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create phase-prep.tsx**

```tsx
// src/components/session/phase-prep.tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PrepStatusCard } from '@/components/session/prep-status-card';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import { Swords } from 'lucide-react';

interface PhasePrepProps {
  session: any;
  slug: string;
  campaignId: string;
  onStatusChange: () => void;
}

export function PhasePrep({ session, slug, campaignId, onStatusChange }: PhasePrepProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const startSession = trpc.sessions.update.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: session.id });
      onStatusChange();
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <PrepStatusCard session={session} campaignId={campaignId} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/campaigns/${slug}/sessions/prep?sessionId=${session.id}`}>Edit Prep</Link>
        </Button>
        <Button
          size="sm"
          onClick={() => startSession.mutate({ id: session.id, status: 'in_progress' })}
          disabled={startSession.isPending}
        >
          <Swords className="mr-1.5 h-3.5 w-3.5" />
          Mark as Run
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create phase-processing.tsx**

```tsx
// src/components/session/phase-processing.tsx
'use client';

import { AudioRecorder } from '@/components/session/audio-recorder';

interface PhaseProcessingProps {
  session: any;
  campaignId: string;
  onUploadComplete: () => void;
}

export function PhaseProcessing({ session, campaignId, onUploadComplete }: PhaseProcessingProps) {
  return (
    <div className="space-y-4">
      <div className="stone-card glass-panel">
        <div className="stone-card-header">
          <span className="stone-card-title text-sm">Upload Recording</span>
        </div>
        <div className="stone-card-body">
          <p className="text-sm text-muted-foreground mb-4">
            Upload your session audio to generate a transcript and AI summary.
            Multi-track files are supported.
          </p>
          <AudioRecorder sessionId={session.id} campaignId={campaignId} onComplete={onUploadComplete} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create phase-summary.tsx**

```tsx
// src/components/session/phase-summary.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface PhaseSummaryProps {
  session: any;
  onSummaryReady: () => void;
}

export function PhaseSummary({ session, onSummaryReady }: PhaseSummaryProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [showTranscript, setShowTranscript] = useState(false);

  const generateSummary = trpc.sessions.generateSummary.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: session.id });
      onSummaryReady();
    },
    onError: (e) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const status = session.aiSummaryStatus as string;
  const transcript = session.transcripts?.[0];

  return (
    <div className="space-y-4">
      {/* Transcript (collapsible) */}
      {transcript && (
        <div className="stone-card glass-panel">
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="stone-card-header flex w-full items-center justify-between hover:text-foreground transition-colors"
          >
            <span className="stone-card-title text-sm">Transcript</span>
            {showTranscript ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showTranscript && (
            <div className="stone-card-body max-h-64 overflow-y-auto text-sm text-muted-foreground whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
              {transcript.correctedText ?? transcript.rawText}
            </div>
          )}
        </div>
      )}

      {/* AI Summary */}
      <div className="stone-card glass-panel">
        <div className="stone-card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-400/70" />
            <span className="stone-card-title text-sm">AI Summary</span>
          </div>
          {status === 'done' && (
            <Button variant="ghost" size="sm" onClick={() => generateSummary.mutate({ id: session.id })} disabled={generateSummary.isPending} className="h-7 px-2 text-xs">
              <RefreshCw className="mr-1 h-3 w-3" /> Regenerate
            </Button>
          )}
        </div>
        <div className="stone-card-body">
          {(status === 'pending' || status === 'processing') && (
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          )}
          {status === 'done' && session.aiSummary && (
            <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground">
              <ReactMarkdown>{session.aiSummary}</ReactMarkdown>
            </div>
          )}
          {(status === 'none' || !status) && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">No summary generated yet.</p>
              <Button size="sm" onClick={() => generateSummary.mutate({ id: session.id })} disabled={generateSummary.isPending}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate Summary
              </Button>
            </div>
          )}
          {status === 'error' && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">Summary generation failed.</p>
              <Button size="sm" variant="outline" onClick={() => generateSummary.mutate({ id: session.id })} disabled={generateSummary.isPending}>
                <RefreshCw className="mr-1.5 h-3 w-3" /> Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create phase-recap.tsx**

```tsx
// src/components/session/phase-recap.tsx
'use client';

import { RecapCard } from '@/components/recap/recap-card';

interface PhaseRecapProps {
  session: any;
  campaignId: string;
}

export function PhaseRecap({ session, campaignId }: PhaseRecapProps) {
  return (
    <div className="space-y-4">
      <RecapCard sessionId={session.id} campaignId={campaignId} />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/session/phase-complete-row.tsx src/components/session/phase-prep.tsx src/components/session/phase-processing.tsx src/components/session/phase-summary.tsx src/components/session/phase-recap.tsx
git commit -m "feat(ui): session phase components — prep, processing, summary, recap, complete-row"
```

---

## Task 8: Session Hub Page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

Full rewrite of the session detail page. Imports all phase components, renders the pipeline, shows completed-phase rows for done phases, renders the current phase component.

- [ ] **Step 1: Rewrite the page**

Replace the entire file:

```tsx
// src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionPipeline } from '@/components/session/session-pipeline';
import { PhaseCompleteRow } from '@/components/session/phase-complete-row';
import { PhasePrep } from '@/components/session/phase-prep';
import { PhaseProcessing } from '@/components/session/phase-processing';
import { PhaseSummary } from '@/components/session/phase-summary';
import { PhaseRecap } from '@/components/session/phase-recap';
import { DmVisibilityControls } from '@/components/session/dm-visibility-controls';
import { deriveSessionPhase } from '@/lib/session-lifecycle';
import { format, formatDistanceToNow } from 'date-fns';

export default function SessionHubPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { campaignId, slug, isDM } = useCampaign();

  const sessionQuery = trpc.sessions.getById.useQuery({ id: sessionId }, { staleTime: 30_000 });
  const utils = trpc.useUtils();

  const session = sessionQuery.data as any;

  if (sessionQuery.isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }

  if (!session) {
    return <p className="text-sm text-muted-foreground">Session not found.</p>;
  }

  const phase = deriveSessionPhase({
    status: session.status ?? 'planning',
    aiSummaryStatus: session.aiSummaryStatus ?? 'none',
    aiSummary: session.aiSummary ?? null,
    recordingCount: session.recordings?.length ?? 0,
    hasApprovedRecap: session.recaps?.some((r: any) => r.approvedAt !== null) ?? false,
  });

  const refresh = () => void utils.sessions.getById.invalidate({ id: sessionId });

  // ── Completed phase summary rows ──────────────────────────────────────────
  const prepDone = phase !== 'prep';
  const ranDone  = !['prep', 'ran'].includes(phase);
  const procDone = !['prep', 'ran', 'processing'].includes(phase);
  const sumDone  = !['prep', 'ran', 'processing', 'summary'].includes(phase);

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Page header */}
      <div>
        <p className="label-overline mb-1">Session {session.sessionNumber}</p>
        <div className="section-rule" />
        <h1 className="font-display text-xl font-bold mt-3 tracking-wide">
          {session.title ?? `Session ${session.sessionNumber}`}
        </h1>
        {session.date && (
          <p className="text-xs text-muted-foreground mt-1">{format(new Date(session.date), 'EEEE, MMMM d yyyy')}</p>
        )}
      </div>

      {/* Pipeline */}
      <SessionPipeline currentPhase={phase} />

      {/* Completed phase rows */}
      <div className="space-y-2">
        {prepDone && (
          <PhaseCompleteRow
            phase="prep"
            detail={session.prepStatus === 'complete' ? 'Prep complete' : 'Skipped'}
            editHref={`/campaigns/${slug}/sessions/prep?sessionId=${session.id}`}
          />
        )}
        {ranDone && (
          <PhaseCompleteRow
            phase="ran"
            detail={session.date ? `Ran ${formatDistanceToNow(new Date(session.date), { addSuffix: true })}` : 'Session complete'}
          />
        )}
        {procDone && (
          <PhaseCompleteRow
            phase="processing"
            detail={`${session.recordings?.length ?? 0} file${(session.recordings?.length ?? 0) !== 1 ? 's' : ''} uploaded`}
          />
        )}
        {sumDone && (
          <PhaseCompleteRow
            phase="summary"
            detail="AI summary generated"
          />
        )}
      </div>

      {/* Current phase content */}
      {phase === 'prep' && isDM && (
        <PhasePrep session={session} slug={slug} campaignId={campaignId} onStatusChange={refresh} />
      )}
      {phase === 'ran' && isDM && (
        <PhaseProcessing session={session} campaignId={campaignId} onUploadComplete={refresh} />
      )}
      {phase === 'processing' && isDM && (
        <PhaseProcessing session={session} campaignId={campaignId} onUploadComplete={refresh} />
      )}
      {phase === 'summary' && (
        <PhaseSummary session={session} onSummaryReady={refresh} />
      )}
      {phase === 'recap' && (
        <PhaseRecap session={session} campaignId={campaignId} />
      )}
      {phase === 'complete' && (
        <div className="stone-card glass-panel">
          <div className="stone-card-body text-center py-6">
            <p className="text-sm text-muted-foreground">This session is complete.</p>
          </div>
        </div>
      )}

      {/* DM visibility controls always accessible */}
      {isDM && (
        <div className="pt-2">
          <DmVisibilityControls sessionId={sessionId} campaignId={campaignId} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | grep "sessions/\[sessionId\]/page"
```
Expected: no errors (if AudioRecorder's `onComplete` prop doesn't exist, check its interface and adjust the prop name in phase-processing.tsx to match)

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/page.tsx
git commit -m "feat(ui): session hub page — single URL, lifecycle pipeline"
```

---

## Task 9: Route Redirects

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx`
- Modify: `src/app/(app)/recap/upload/page.tsx`

Old sub-routes redirect to the hub. Use server-side `redirect()` so there's no client flash.

- [ ] **Step 1: Redirect prep sub-route**

Replace the entire content of `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';

export default function PrepRedirectPage({ params }: { params: { slug: string; sessionId: string } }) {
  redirect(`/campaigns/${params.slug}/sessions/${params.sessionId}`);
}
```

- [ ] **Step 2: Redirect recap sub-route**

Replace the entire content of `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';

export default function RecapRedirectPage({ params }: { params: { slug: string; sessionId: string } }) {
  redirect(`/campaigns/${params.slug}/sessions/${params.sessionId}`);
}
```

- [ ] **Step 3: Redirect /recap/upload**

Read `src/app/(app)/recap/upload/page.tsx` first to understand its current form. Then replace its default export with a redirect:

```tsx
import { redirect } from 'next/navigation';

export default function UploadRedirectPage() {
  // Recording upload now lives in the session hub (Processing phase)
  redirect('/campaigns');
}
```

Note: If the upload page has a `searchParams.sessionId` pattern, redirect to that session's hub instead:
```tsx
export default function UploadRedirectPage({ searchParams }: { searchParams: { sessionId?: string; slug?: string } }) {
  if (searchParams.sessionId && searchParams.slug) {
    redirect(`/campaigns/${searchParams.slug}/sessions/${searchParams.sessionId}`);
  }
  redirect('/campaigns');
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/prep/page.tsx src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/recap/page.tsx src/app/\(app\)/recap/upload/page.tsx
git commit -m "feat(ui): redirect old session sub-routes to hub"
```

---

## Task 10: Dashboard Redirect

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

If the user has at least one campaign, redirect to the most recently active one. Otherwise show the existing dashboard content (campaigns list + invites).

- [ ] **Step 1: Add server-side redirect to dashboard layout**

The cleanest place for this is in the server component. In `src/app/(app)/dashboard/page.tsx`, the component is currently client-side. Convert the approach: add an async server component wrapper that redirects, keeping the existing client component for the "no campaigns" state.

Create `src/app/(app)/dashboard/page.tsx` — read the file first, then prepend the redirect logic. The key addition is fetching the most recent campaign server-side:

Since the page is `'use client'`, add the redirect inside the `DashboardPage` component using an effect-free approach — the server layout can handle this more cleanly. The simplest approach: update `src/app/(app)/layout.tsx` to detect the active campaign and redirect.

Actually the cleanest client-side approach is to use the existing campaigns query and redirect in a `useEffect`:

Add to `DashboardPage`, after the campaigns query resolves:

```tsx
// At top of DashboardPage component, after the campaigns query:
const router = useRouter();
useEffect(() => {
  if (!campaigns.isLoading && campaigns.data && campaigns.data.length > 0) {
    const mostRecent = [...campaigns.data].sort((a, b) => {
      const aDate = a.lastSessionDate ? new Date(a.lastSessionDate).getTime() : new Date(a.updatedAt).getTime();
      const bDate = b.lastSessionDate ? new Date(b.lastSessionDate).getTime() : new Date(b.updatedAt).getTime();
      return bDate - aDate;
    })[0];
    if (mostRecent?.slug) {
      router.replace(`/campaigns/${mostRecent.slug}`);
    }
  }
}, [campaigns.isLoading, campaigns.data, router]);
```

Add `import { useEffect } from 'react';` and `import { useRouter } from 'next/navigation';` to the imports (check if they're already imported).

Also add the page header template (overline + section rule) before the existing content for the "no campaigns" state.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat(ui): dashboard redirects to last active campaign"
```

---

## Task 11: Page Template Consistency Sweep

**Files:**
- Modify: `src/app/(app)/campaigns/page.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/sessions/page.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/npcs/page.tsx`
- Modify: `src/app/(app)/campaigns/[slug]/brain/page.tsx`
- Modify: `src/app/(app)/homebrew/page.tsx`

Apply the standard page header (overline + section rule + h1) and replace raw `rounded-lg border border-border` cards with `stone-card glass-panel`. Do one page at a time.

**Standard header pattern to apply:**

```tsx
<div>
  <p className="label-overline mb-1">SECTION LABEL</p>
  <div className="section-rule" />
  <div className="flex items-center justify-between mt-3">
    <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wide">Page Title</h1>
    {/* optional CTA button */}
  </div>
</div>
```

**Standard card replacement:** Change `className="rounded-lg border border-border ..."` → `className="stone-card glass-panel"`. Use `stone-card-header` / `stone-card-body` for internal structure.

- [ ] **Step 1: campaigns/page.tsx — read, apply header template**

Read the file. Find the current page heading. Apply the overline+rule+h1 pattern. Verify no raw border-border cards remain.

```bash
npx tsc --noEmit 2>&1 | grep "campaigns/page"
```

- [ ] **Step 2: sessions/page.tsx — already has good structure, add overline+rule**

The sessions list already has a well-structured header. Add `label-overline` + `section-rule` above the existing `h1`. Sessions list cards already use `glass-panel` — no card changes needed.

- [ ] **Step 3: npcs/page.tsx — read, apply header, check cards**

Read the file. Apply header pattern. Check `NpcListRow` component for raw border cards and replace if found.

- [ ] **Step 4: brain/page.tsx — read, apply header**

The brain page uses tabs. Apply the header pattern above the `<Tabs>` component.

- [ ] **Step 5: homebrew/page.tsx — read, apply header**

Read and apply the standard header.

- [ ] **Step 6: Final type check and commit**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors

```bash
git add src/app/\(app\)/campaigns/page.tsx src/app/\(app\)/campaigns/\[slug\]/sessions/page.tsx src/app/\(app\)/campaigns/\[slug\]/npcs/page.tsx src/app/\(app\)/campaigns/\[slug\]/brain/page.tsx src/app/\(app\)/homebrew/page.tsx
git commit -m "chore(ui): apply consistent page header template across campaign pages"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Two-zone sidebar, both zones always visible | Task 3 |
| Campaign switcher pill | Task 2 |
| Dashboard → last active campaign | Task 10 |
| Campaign overview hero card | Task 4, 5 |
| Next session row | Task 5 |
| World pressure + open hooks on overview | Task 5 |
| Session hub — single URL | Task 8 |
| Pipeline indicator | Task 6 |
| Phase content per lifecycle stage | Task 7 |
| Completed phases collapse to rows | Task 7, 8 |
| /recap/upload, /prep, /recap redirects | Task 9 |
| Page template consistency | Task 11 |

**Placeholder check:** No TBDs. All steps contain code or exact commands.

**Type consistency:** `SessionForPhase` defined in Task 1 and imported consistently in Tasks 5 and 8. `SessionPhase` used across pipeline (Task 6), phase-complete-row (Task 7), and campaign overview (Task 5). `ContinueAction` interface defined in Task 4 and consumed in Task 5.

**Known edge cases for implementer:**
- `AudioRecorder` component's `onComplete` prop name — verify against the actual component interface before using in phase-processing.tsx
- `HookDetailDrawer` — check its actual props interface before using in campaign overview (it's used in brain/page.tsx — copy the usage pattern from there)
- The `trpc.sessions.update` mutation in phase-prep.tsx — verify the input schema accepts `{ id, status }` against `src/server/routers/sessions.ts`
