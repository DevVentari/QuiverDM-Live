# RecapForge Phase 7 — Recap Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new top-level `/recap` route showing all session recaps across all of a DM's campaigns, with campaign cards, status filters, and a sidebar badge for pending reviews.

**Architecture:** Two new tRPC procedures (`recap.getDashboard`, `recap.getRecentAcrossCampaigns`) power the page. Both use `protectedProcedure` (not campaign-scoped). The dashboard fetches campaigns where the user is OWNER or CO_DM, then separately aggregates recap counts. The sidebar adds a "Recaps" nav entry with a live pending-review badge.

**Tech Stack:** tRPC v11, Prisma (two-query merge in router), Next.js App Router, React `useState` for filter state.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/server/routers/recap.ts` | Modify | Add `getDashboard` and `getRecentAcrossCampaigns` (uses `protectedProcedure`) |
| `src/server/trpc.ts` | Check | Confirm `protectedProcedure` is already exported (it is — line 69) |
| `src/server/routers/_app.ts` | Check | Confirm `recapRouter` is registered (it is — line 56) |
| `src/app/(app)/recap/page.tsx` | Create | Full dashboard page |
| `src/components/sidebar.tsx` | Modify | Add Recaps to globalNav + badge with pending count |
| `tests/workflows/recapforge-dashboard.workflow.spec.ts` | Create | Workflow spec stubs |

---

### Task 1: Add getDashboard procedure

**Files:**
- Modify: `src/server/routers/recap.ts`

- [ ] **Step 1: Import protectedProcedure**

In `src/server/routers/recap.ts`, the current import is:
```ts
import { router, campaignDMProcedure } from '../trpc';
```

Change to:
```ts
import { router, campaignDMProcedure, protectedProcedure } from '../trpc';
```

- [ ] **Step 2: Add getDashboard procedure**

Add before the closing `});` of the router:

```ts
  getDashboard: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // 1. All campaigns where user is DM or owner
    const memberships = await prisma.campaignMember.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'CO_DM'] },
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    const campaignIds = memberships.map((m) => m.campaignId);
    if (campaignIds.length === 0) return [];

    // 2. Aggregate recap counts per campaign
    const recapGroups = await prisma.sessionRecap.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: campaignIds } },
      _count: { id: true },
    });

    // 3. Latest recap date per campaign
    const latestRecaps = await prisma.sessionRecap.findMany({
      where: { campaignId: { in: campaignIds } },
      orderBy: { createdAt: 'desc' },
      distinct: ['campaignId'],
      select: {
        campaignId: true,
        createdAt: true,
        session: { select: { title: true, sessionNumber: true } },
      },
    });

    // 4. Merge
    return memberships.map((m) => {
      const groups = recapGroups.filter((g) => g.campaignId === m.campaignId);
      const totalRecaps = groups.reduce((sum, g) => sum + g._count.id, 0);
      const pendingReview = groups
        .filter((g) => g.status === 'AUTO_GENERATED')
        .reduce((sum, g) => sum + g._count.id, 0);
      const latest = latestRecaps.find((r) => r.campaignId === m.campaignId);
      const lastSessionTitle = latest
        ? (latest.session.title ?? `Session ${latest.session.sessionNumber}`)
        : null;
      return {
        campaignId: m.campaignId,
        campaignName: m.campaign.name,
        slug: m.campaign.slug,
        totalRecaps,
        pendingReview,
        lastRecapDate: latest?.createdAt ?? null,
        lastSessionTitle,
      };
    });
  }),
```

- [ ] **Step 3: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "recap" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/recap.ts
git commit -m "feat(recap): add getDashboard procedure"
```

---

### Task 2: Add getRecentAcrossCampaigns procedure

**Files:**
- Modify: `src/server/routers/recap.ts`

- [ ] **Step 1: Add getRecentAcrossCampaigns**

Add after `getDashboard`:

```ts
  getRecentAcrossCampaigns: protectedProcedure
    .input(
      z.object({
        campaignIds: z.array(z.string()).optional(),
        status: z.nativeEnum(RecapStatus).optional(),
        cursor: z.number().default(0), // offset-based
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Verify user is DM in requested campaigns (or fetch all if none specified)
      const memberships = await prisma.campaignMember.findMany({
        where: {
          userId,
          role: { in: ['OWNER', 'CO_DM'] },
          ...(input.campaignIds?.length
            ? { campaignId: { in: input.campaignIds } }
            : {}),
        },
        select: { campaignId: true },
      });
      const allowedCampaignIds = memberships.map((m) => m.campaignId);
      if (allowedCampaignIds.length === 0) return { items: [], nextCursor: null };

      const recaps = await prisma.sessionRecap.findMany({
        where: {
          campaignId: { in: allowedCampaignIds },
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: [{ session: { date: 'desc' } }, { createdAt: 'desc' }],
        skip: input.cursor,
        take: input.limit + 1,
        include: {
          session: {
            select: {
              title: true,
              sessionNumber: true,
              date: true,
            },
          },
          campaign: {
            select: { name: true, slug: true },
          },
        },
      });

      const hasMore = recaps.length > input.limit;
      const items = hasMore ? recaps.slice(0, -1) : recaps;
      const nextCursor = hasMore ? input.cursor + input.limit : null;

      return {
        items: items.map((r) => ({
          recapId: r.id,
          sessionId: r.sessionId,
          sessionTitle: r.session.title ?? `Session ${r.session.sessionNumber}`,
          sessionDate: r.session.date,
          campaignId: r.campaignId,
          campaignName: r.campaign.name,
          slug: r.campaign.slug,
          status: r.status,
          style: r.style,
        })),
        nextCursor,
      };
    }),
```

- [ ] **Step 2: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "recap" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/recap.ts
git commit -m "feat(recap): add getRecentAcrossCampaigns with cursor pagination"
```

---

### Task 3: Create /recap dashboard page

**Files:**
- Create: `src/app/(app)/recap/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import type { RecapStatus } from '@prisma/client';

const STATUS_FILTERS: Array<{ label: string; value: RecapStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending Review', value: 'AUTO_GENERATED' },
  { label: 'Approved', value: 'REVIEWED' },
  { label: 'Quick-fire', value: 'QUICK_FIRE' },
];

const STATUS_LABELS: Record<string, string> = {
  AUTO_GENERATED: 'Pending Review',
  REVIEWED: 'Approved',
  QUICK_FIRE: 'Quick-fire',
  GENERATING: 'Generating',
  FAILED: 'Failed',
};

const STATUS_COLORS: Record<string, string> = {
  AUTO_GENERATED: 'hsl(35 50% 48%)',
  REVIEWED: 'hsl(35 70% 56%)',
  QUICK_FIRE: 'hsl(50 80% 55%)',
  GENERATING: 'hsl(240 10% 55%)',
  FAILED: 'hsl(0 60% 48%)',
};

export default function RecapDashboardPage() {
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<RecapStatus | 'ALL'>('ALL');

  const { data: campaigns, isLoading: campaignsLoading } =
    trpc.recap.getDashboard.useQuery(undefined, { staleTime: 60_000 });

  const effectiveCampaignIds =
    selectedCampaignIds.length > 0
      ? selectedCampaignIds
      : (campaigns?.map((c) => c.campaignId) ?? []);

  const {
    data: recapsData,
    isLoading: recapsLoading,
    fetchNextPage,
    hasNextPage,
  } = trpc.recap.getRecentAcrossCampaigns.useInfiniteQuery(
    {
      campaignIds: effectiveCampaignIds,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      limit: 20,
    },
    {
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: effectiveCampaignIds.length > 0,
      staleTime: 30_000,
    }
  );

  const allRecaps = recapsData?.pages.flatMap((p) => p.items) ?? [];

  const toggleCampaign = (id: string) => {
    setSelectedCampaignIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="px-6 py-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <span
          className="text-[10px] uppercase tracking-widest font-semibold"
          style={{ color: 'hsl(35 80% 48%)' }}
        >
          Recaps
        </span>
        <h1
          className="font-display text-2xl font-bold mt-0.5"
          style={{ color: 'hsl(35 20% 90%)' }}
        >
          All Campaigns
        </h1>
      </div>

      {/* Amber rule */}
      <div
        className="h-px"
        style={{ background: 'linear-gradient(90deg, hsl(35 60% 28%) 0%, transparent 60%)' }}
      />

      {/* Campaign cards */}
      {campaignsLoading ? (
        <div className="flex gap-3 flex-wrap">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 w-44 rounded-sm animate-pulse"
              style={{ background: 'hsl(240 10% 11%)' }}
            />
          ))}
        </div>
      ) : !campaigns?.length ? (
        <p className="text-sm" style={{ color: 'hsl(35 10% 40%)' }}>
          No campaigns found. Create a campaign to get started.
        </p>
      ) : (
        <div className="flex gap-3 flex-wrap">
          {campaigns.map((c) => {
            const isSelected = selectedCampaignIds.includes(c.campaignId);
            return (
              <button
                key={c.campaignId}
                onClick={() => toggleCampaign(c.campaignId)}
                className="rounded-sm border text-left px-4 py-3 transition-colors w-44 shrink-0"
                style={{
                  background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)',
                  border: `1px solid ${isSelected ? 'hsl(35 60% 30%)' : 'hsl(240 10% 20%)'}`,
                }}
              >
                <p
                  className="text-xs font-semibold truncate"
                  style={{ color: isSelected ? 'hsl(35 70% 68%)' : 'hsl(35 15% 70%)' }}
                >
                  {c.campaignName}
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'hsl(35 5% 40%)' }}>
                  {c.totalRecaps} recap{c.totalRecaps !== 1 ? 's' : ''}
                </p>
                {c.pendingReview > 0 && (
                  <span
                    className="inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'hsl(35 60% 18%)', color: 'hsl(35 70% 58%)' }}
                  >
                    {c.pendingReview} pending
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className="px-3 py-1.5 rounded-sm text-xs font-medium transition-colors"
              style={{
                background: isActive ? 'hsl(35 80% 18%)' : 'hsl(240 10% 11%)',
                border: `1px solid ${isActive ? 'hsl(35 60% 30%)' : 'hsl(240 10% 20%)'}`,
                color: isActive ? 'hsl(35 80% 70%)' : 'hsl(35 5% 48%)',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Recap list */}
      {recapsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-12 rounded-sm animate-pulse"
              style={{ background: 'hsl(240 10% 11%)' }}
            />
          ))}
        </div>
      ) : allRecaps.length === 0 ? (
        <div
          className="rounded-sm border border-border/40 px-6 py-12 text-center"
          style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)' }}
        >
          <ScrollText className="h-7 w-7 mx-auto mb-3" style={{ color: 'hsl(35 10% 28%)' }} />
          <p className="text-sm" style={{ color: 'hsl(35 10% 40%)' }}>
            {statusFilter !== 'ALL'
              ? 'No recaps match this filter.'
              : 'No recaps yet. Generate one from any session page.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {allRecaps.map((r) => (
            <div
              key={r.recapId}
              className="flex items-center gap-4 rounded-sm border border-border/20 px-4 py-3"
              style={{
                background: 'hsl(240 10% 10%)',
                borderLeft:
                  r.status === 'AUTO_GENERATED'
                    ? '2px solid hsl(35 50% 32%)'
                    : '2px solid transparent',
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'hsl(35 15% 78%)' }}>
                  {r.sessionTitle}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: 'hsl(35 5% 40%)' }}>
                  {r.campaignName}
                  {r.sessionDate
                    ? ` · ${format(new Date(r.sessionDate as string), 'd MMM yyyy')}`
                    : ''}
                </p>
              </div>
              <span
                className="text-[10px] font-medium shrink-0"
                style={{ color: STATUS_COLORS[r.status] ?? 'hsl(35 5% 48%)' }}
              >
                {STATUS_LABELS[r.status] ?? r.status}
              </span>
              <Link
                href={`/campaigns/${r.slug}/sessions/${r.sessionId}/recap`}
                className="text-xs shrink-0 transition-opacity opacity-50 hover:opacity-100"
                style={{ color: 'hsl(35 20% 60%)' }}
              >
                View →
              </Link>
            </div>
          ))}
          {hasNextPage && (
            <div className="pt-3 text-center">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => void fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "recap/page" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/recap/page.tsx
git commit -m "feat(recap): /recap dashboard page with campaign cards + filtered list"
```

---

### Task 4: Add Recaps to sidebar with pending badge

**Files:**
- Modify: `src/components/sidebar.tsx`

- [ ] **Step 1: Add recap query to Sidebar component**

Inside `export function Sidebar()`, after the campaigns query:

```tsx
const recapDashboard = trpc.recap.getDashboard.useQuery(undefined, {
  staleTime: 60_000,
});
const pendingRecapCount =
  recapDashboard.data?.reduce((sum, c) => sum + c.pendingReview, 0) ?? 0;
```

- [ ] **Step 2: Add Recaps to globalNav**

Find in `sidebar.tsx`:
```ts
const globalNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campaigns', icon: Globe },
  { href: '/characters', label: 'Characters', icon: User },
  { href: '/homebrew', label: 'Homebrew', icon: FlaskConical },
];
```

Change to:
```ts
const globalNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campaigns', icon: Globe },
  { href: '/recap', label: 'Recaps', icon: ScrollText },
  { href: '/characters', label: 'Characters', icon: User },
  { href: '/homebrew', label: 'Homebrew', icon: FlaskConical },
];
```

`ScrollText` is already imported at the top of `sidebar.tsx`.

- [ ] **Step 3: Add badge to the Recaps NavItem**

The current `globalNav.map(...)` renders plain `<NavItem>` components. Replace the entire `globalNav.map(...)` block with one that adds a badge for the Recaps entry:

```tsx
{globalNav.map((item) => {
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + '/');
  if (item.href === '/recap' && pendingRecapCount > 0 && !collapsed) {
    return (
      <div key={item.href} className="relative">
        <NavItem {...item} isActive={isActive} collapsed={collapsed} />
        <span
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded-full pointer-events-none"
          style={{ background: 'hsl(35 60% 18%)', color: 'hsl(35 70% 58%)' }}
        >
          {pendingRecapCount}
        </span>
      </div>
    );
  }
  return (
    <NavItem
      key={item.href}
      {...item}
      isActive={isActive}
      collapsed={collapsed}
    />
  );
})}
```

- [ ] **Step 4: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "sidebar" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat(sidebar): add Recaps nav entry with pending review badge"
```

---

### Task 5: Workflow spec + push

**Files:**
- Create: `tests/workflows/recapforge-dashboard.workflow.spec.ts`

- [ ] **Step 1: Create workflow spec**

```ts
import { test } from '@playwright/test';

test.fixme('/recap page loads and shows campaign cards', async ({ page }) => {
  // Phase 7 — requires at least one campaign with recaps in DB
  void page;
});

test.fixme('clicking campaign card filters the recap list', async ({ page }) => {
  // Phase 7
  void page;
});

test.fixme('status filter narrows recap list', async ({ page }) => {
  // Phase 7
  void page;
});

test.fixme('sidebar badge shows pending review count', async ({ page }) => {
  // Phase 7
  void page;
});

test.fixme('View link navigates to correct recap page', async ({ page }) => {
  // Phase 7
  void page;
});
```

- [ ] **Step 2: Final type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 3: Commit and push**

```bash
git add tests/workflows/recapforge-dashboard.workflow.spec.ts
git commit -m "test(recap): Phase 7 dashboard workflow spec stubs"
git push origin main
```
