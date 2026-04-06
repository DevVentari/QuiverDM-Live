# RecapForge Phase 7 — Recap Dashboard Design

## Goal

A new top-level `/recap` route that surfaces all recaps across all of a DM's campaigns in one place, with campaign cards, cross-campaign session list, status filters, and pending-review badges.

## Architecture

### New Route

`src/app/(app)/recap/page.tsx` — top-level, outside campaign context (`[slug]` tree). Uses `protectedProcedure` (user's own campaigns only).

### New tRPC Procedures (add to `src/server/routers/recap.ts`)

- `recap.getDashboard` — returns all campaigns where the authed user is OWNER or CO_DM, with per-campaign aggregated stats:
  - `campaignId`, `campaignName`, `slug`
  - `totalRecaps: number`
  - `pendingReview: number` (status `AUTO_GENERATED` — generated but not yet approved)
  - `lastRecapDate: Date | null`
  - `lastSessionTitle: string | null`
  Implementation: two Prisma queries — (1) fetch all campaigns where user is OWNER/CO_DM, (2) `groupBy` `SessionRecap.campaignId` to get counts and latest date — merged in the router handler. Prisma `groupBy` does not support joins, so merge in TypeScript.

- `recap.getRecentAcrossCampaigns` — paginated list of `SessionRecap` rows across all DM'd campaigns. Params: `campaignIds[]`, `status?: RecapStatus`, `cursor?` (for pagination). Returns: `recapId`, `sessionId`, `sessionTitle`, `sessionDate`, `campaignId`, `campaignName`, `slug`, `status`, `style`, `availableStyles[]` (all styles with `AUTO_GENERATED`+). Ordered by session date desc.

### Sidebar Nav Change

`src/components/layout/sidebar.tsx` (or equivalent nav component):
- Add "Recaps" entry with `ScrollText` icon, linking to `/recap`
- Badge: total `pendingReview` count across all campaigns (from `recap.getDashboard`)
- Badge hidden when count is 0

**No new Prisma models** — all data from existing `SessionRecap`, `Campaign`, `Session`, `CampaignMember` joins.

## UI Components

### `/recap` Page Layout

**Header:**
- Amber overline label: "Recaps"
- `h1`: "All Campaigns" (Cinzel display font, standard heading style)

**Campaign cards row (`flex-wrap`, horizontal scroll on mobile):**
- One card per DM'd campaign
- Card content: campaign name, total recap count, pending review badge (amber, numeric), last recap date
- Clicking a card filters the session list below to that campaign
- All campaigns selected by default (multi-select — clicking again deselects)
- Active card: amber border highlight

**Filter bar:**
- Status filter chips: All / Pending Review / Approved / Quick-fire
- Matches existing pill style from recap page style picker
- Clears to "All" when campaign selection changes

**Session recap list:**
- Each row: session title | campaign name (shown when "all" view) | date | style dots (one per available style) | status badge | "View" link → `/campaigns/[slug]/sessions/[id]/recap`
- Pending Review rows: subtle amber left border (`border-l-2 border-amber-500/40`)
- Paginated — "Load more" button at bottom (cursor-based)
- Ordered by session date descending

**Empty state (no recaps at all):**
```
[ScrollText icon]
No recaps yet.
Generate one from any session page.
```

**Empty state (filters active, no matches):**
```
No recaps match these filters.
```

### Sidebar Badge

- Rendered next to "Recaps" nav label in the global sidebar component
- Makes its own `recap.getDashboard` query (staleTime: 60s) — sidebar renders globally, not just on `/recap`
- Zero count: badge not rendered
- If query fails or is loading: badge not rendered (non-blocking)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No campaigns (new user) | Card area shows "Create a campaign to get started" |
| `getDashboard` fails | Skeleton cards shown, non-blocking toast |
| `getRecentAcrossCampaigns` fails | List area shows retry button |
| Sidebar badge query fails | Badge simply not rendered |

## Testing

**New workflow spec:** `tests/workflows/recapforge-dashboard.workflow.spec.ts`
- `/recap` loads, shows campaign cards with correct counts
- Clicking campaign card filters session list
- Status filter narrows list correctly
- Sidebar badge shows pending review count
- "View" link navigates to correct recap page

**Persona update:** `tests/personas/veteran-dm.persona.spec.ts`
- Add checkpoint: navigate to `/recap`, see campaign cards, filter by pending review
