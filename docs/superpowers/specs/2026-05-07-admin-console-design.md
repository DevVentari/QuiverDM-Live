# Admin Console — Expansion Design Spec

**Date:** 2026-05-07  
**Scope:** Fix existing bugs, add charts, bulk user actions, and a system health panel.

---

## Context

The admin console lives at `/admin` under the `(admin)` route group, separate from the main app shell. Access gate: `platformRole >= WARDEN` (re-queried from DB on each request — no session caching). Five pages exist today: Overview, Users, API Usage, Invites, Rules Sources. All backing routers and procedures are implemented.

---

## Section 1: Bug Fixes

### 1.1 AdminNav double-sidebar

**Problem:** `AdminNav` renders `<nav className="w-56 min-h-screen border-r ...">` — a full sidebar container — but is nested inside the layout's `<aside>` which already provides the sidebar frame. Results in a double-sidebar structure.

**Fix:** Strip the outer container from `AdminNav`. The component renders only the nav link list (no width, height, border, or background). The layout's `<aside>` provides all sidebar framing.

File: `src/components/admin/admin-nav.tsx`

### 1.2 Loading and error states

**Problem:** Overview page (`/admin`) and users page (`/admin/users`) render `data?.x ?? 0` with no feedback while the query is in flight. On error, nothing is shown.

**Fix:**
- Add `Skeleton` placeholders (shadcn) behind each stat card and table row while `isLoading`.
- Add an error card on `isError` with a "Retry" button that calls `refetch()`.
- Apply the same pattern to the user detail page and the API usage page.

### 1.3 Users list Load More

**Problem:** `adminUsers.list` returns `nextCursor` for cursor pagination but the UI uses `useQuery` with no way to trigger the next page. After 50 users, the rest are invisible.

**Fix:** Switch to `trpc.adminUsers.list.useInfiniteQuery`. Add a "Load more" button below the table that calls `fetchNextPage()`. Button disabled and labeled "Loading…" while `isFetchingNextPage`. Hidden when `!hasNextPage`.

File: `src/app/(admin)/admin/users/page.tsx`

### 1.4 API usage page — missing stat card fallback

**Problem:** The 4th stat card conditionally renders only when `byProvider[0]` exists. If no API usage data exists, the stat grid has an empty slot.

**Fix:** Replace the conditional `slice(0,1).map()` with a static "Top Provider" card that shows "—" when data is empty.

File: `src/app/(admin)/admin/api-usage/page.tsx`

---

## Section 2: Charts

### Dependencies

- Install `recharts` package.
- Add shadcn chart component: `npx shadcn@latest add chart`. This provides `ChartContainer`, `ChartTooltip`, `ChartLegend`, and associated config types that match the existing design token system.

### 2.1 New router procedure — `adminOverview.getTimeline`

Returns `{ date: string, newUsers: number, apiCost: number }[]` for the last N days.

```
adminOverview.getTimeline(input: { days: number })
```

Implementation:
- `User` — group by `DATE(createdAt)` where `createdAt >= since`, count per day.
- `ApiUsageLog` — group by `DATE(createdAt)` where `createdAt >= since`, sum `estimatedCost` per day.
- Merge by date, fill gaps with zeros.
- Return sorted ascending by date.

Uses `prisma.$queryRaw` with parameterised SQL (no injection risk).

### 2.2 Overview page charts

Two new `Card` components below the existing stat cards:

**Signups over time** — `BarChart` (Recharts via shadcn chart). X-axis: date label (e.g. "May 1"). Y-axis: new users count. Bar fill: `hsl(var(--primary))`. Period selector reuses the existing days filter (default 30).

**API cost trend** — `LineChart`. X-axis: date. Y-axis: cost in dollars (formatted `$0.00`). Line stroke: `hsl(var(--primary))`. Dot shown on hover.

File: `src/app/(admin)/admin/page.tsx` — add period selector state (`useState(30)`), call `adminOverview.getTimeline`.

### 2.3 New router procedure — `adminApiUsage.getCostTimeline`

Returns `{ date: string, provider: string, cost: number }[]` for the selected period.

```
adminApiUsage.getCostTimeline(input: { days: number })
```

Implementation: `ApiUsageLog` grouped by `DATE(createdAt), provider`.

### 2.4 API usage page chart

Stacked `AreaChart` below the existing per-user table. One area per provider (Gemini, OpenAI, Anthropic, Ollama). Colors: use `chartConfig` keys matching `hsl(var(--chart-N))` from shadcn chart tokens. Period synced to the existing `days` selector state.

File: `src/app/(admin)/admin/api-usage/page.tsx`

---

## Section 3: Bulk User Actions

### 3.1 New router procedures — `adminUsers` additions

**`bulkChangeRole(userIds: string[], newRole: PlatformRole)`**  
- Iterate `userIds`. Skip self. For each: apply the same `canDemoteFrom` / `canPromoteTo` guards as the single `changeRole` procedure.  
- Update in a `prisma.$transaction`.  
- Return `{ updated: number, skipped: number }`.

**`bulkChangeTier(userIds: string[], tier: string)`**  
- `prisma.user.updateMany({ where: { id: { in: userIds } }, data: { tier } })`.  
- Return `{ updated: number }`.

**`bulkSuspend(userIds: string[], suspended: boolean)`**  
- Exclude self and Mythkeepers from the `where` clause.  
- `prisma.user.updateMany`.  
- Return `{ updated: number }`.

File: `src/server/routers/admin-users.ts`

### 3.2 Users page UI

**Checkbox column** — add a `<Checkbox>` as the first column. Header checkbox selects/deselects all visible rows.

**Selection state** — `useState<Set<string>>` of selected user IDs. Cleared on filter change.

**Bulk action bar** — conditionally rendered `<div>` that appears above the table when `selectedIds.size > 0`. Contains:
- "X users selected" label + "Clear" button.
- Role dropdown → "Apply to selected" button → calls `bulkChangeRole.mutate`.
- Tier dropdown → "Apply to selected" button → calls `bulkChangeTier.mutate`.
- "Suspend selected" / "Unsuspend selected" button (two separate buttons or a toggle) → calls `bulkSuspend.mutate`.

On mutation success: toast, clear selection, refetch.

File: `src/app/(admin)/admin/users/page.tsx`

---

## Section 4: System Health Panel

### 4.1 New route

File: `src/app/(admin)/admin/health/page.tsx`  
Nav entry: "Health" with `Activity` icon (Lucide), added to `NAV_ITEMS` in `AdminNav`.

### 4.2 New router — `adminHealth`

File: `src/server/routers/admin-health.ts`  
Procedure: `getStatus` (wardenProcedure, no input).

**Queue depths** — for each queue name in a `QUEUE_NAMES` constant, instantiate `new Queue(name, { connection: getRedisConnection() })` (import `getRedisConnection` from `@/lib/queue/queue`), call `queue.getJobCounts('waiting', 'active', 'failed', 'delayed')`. Return array of `{ name, waiting, active, failed, delayed }`. Use `Promise.all` over all queues. Close each queue instance after fetching with `queue.close()`.

All 20 queues: `ai-summary`, `brain-ingestion`, `co-dm-analysis`, `co-dm-prep`, `combat-copilot`, `context-extraction`, `ddb-chapter-extract`, `ddb-sourcebook-sync`, `ddb-sync-review`, `derailment-detection`, `embeddings`, `feedback-triage`, `image-generation`, `multi-track-processing`, `obsidian-import`, `pdf-processing`, `player-recap`, `recap-generation`, `session-events`, `sourcebook-scene-extraction`, `transcript-cleanup`, `transcription-processing`, `webhooks`, `world-simulation`.

**DB table counts** — `Promise.all` of `prisma.X.count()` for: User, Campaign, GameSession, HomebrewContent, WorldEntity, ApiUsageLog, Transcript, NPC, HomebrewContent (PDFs). Return as `{ table, count }[]`.

**Recent failed jobs** — for each queue, call `queue.getFailed(0, 4)` (4 per queue max). Flatten, sort by `finishedOn` desc, take top 15. Return `{ queue, jobName, failedAt, error }[]` (error truncated to 200 chars).

Register in `_app.ts`: `adminHealth: adminHealthRouter`.

**Redis connection:** import `getRedisConnection` from `@/lib/queue/queue` — this is the shared factory used by all existing queue files. Pass the result as `connection` when instantiating each `Queue`.

### 4.3 Health page UI

Three card sections, auto-refresh every 30s:

**Queue Health** — grid of queue cards. Each card: queue name, three pill badges (waiting / active / failed counts). Color logic:
- `failed === 0`: badge variant `secondary`
- `0 < failed <= 10`: badge variant `outline` with amber text
- `failed > 10`: badge variant `destructive`

**Database Snapshot** — compact 3-column grid of `{ table, count }` items. No actions — read-only diagnostic.

**Recent Failed Jobs** — collapsible list. Each row: queue name badge, job name, relative time ("3m ago"), error message (truncated, monospace). Empty state: "No failed jobs" with green check icon.

---

## Files Affected

| File | Change |
|------|--------|
| `src/components/admin/admin-nav.tsx` | Remove outer container, add Health nav item |
| `src/app/(admin)/admin/page.tsx` | Loading/error states, timeline charts |
| `src/app/(admin)/admin/users/page.tsx` | Loading/error states, infinite query, checkboxes, bulk action bar |
| `src/app/(admin)/admin/users/[userId]/page.tsx` | Loading/error states |
| `src/app/(admin)/admin/api-usage/page.tsx` | Loading/error states, static fallback card, cost timeline chart |
| `src/app/(admin)/admin/health/page.tsx` | New page |
| `src/server/routers/admin-overview.ts` | Add `getTimeline` procedure |
| `src/server/routers/admin-api-usage.ts` | Add `getCostTimeline` procedure |
| `src/server/routers/admin-users.ts` | Add `bulkChangeRole`, `bulkChangeTier`, `bulkSuspend` |
| `src/server/routers/admin-health.ts` | New router |
| `src/server/routers/_app.ts` | Register `adminHealth` |
| `package.json` | Add `recharts` |

---

## Testing

No new persona spec — this is an internal operator surface. The existing `tests/workflows/admin-console.workflow.spec.ts` should be extended to cover:
- Login as WARDEN, navigate all 6 pages — expect 200, no JS errors
- Change a user's role from the users list
- Bulk suspend two users and verify status column updates
- Health page renders queue cards

---

## Out of Scope

- Worker heartbeat table (would require schema migration + changes to 25 workers)
- Audit log of admin actions
- Impersonate-user flow completion (backend stub exists, no UI)
