# Campaign Switcher — Design Spec

**Date:** 2026-05-10
**Status:** Approved (brainstorm complete, awaiting implementation plan)
**Owner:** Blake

## Problem

In the V2 home rollout (commit `d072403`, 2026-05-08), `/campaigns`, `/dashboard`, `/campaigns/[slug]`, and `/campaigns/[slug]/sessions/[sessionId]` were collapsed into `permanentRedirect('/')`. The new home (`src/app/(app)/page.tsx`) auto-derives a single "active" campaign from `lastSessionDate ?? updatedAt` and renders that one.

Two consequences:

1. **No campaign switcher exists in V2.** A DM with multiple campaigns has no UI to pick which one is active.
2. **No campaigns list page exists.** The CommandRail's "Campaigns" link points to `/campaigns`, which 308-redirects to `/`. Browsers cache that 308 aggressively.

The user is locked into whichever campaign auto-wins by recency.

## Decisions (locked in via brainstorm)

| # | Question | Choice |
|---|---|---|
| 1 | Active-campaign persistence model | UserSettings (DB-persisted, syncs across devices) |
| 2 | Switcher placement | In the CommandRail, between logo and nav |
| 3 | `/campaigns` page scope | Lean grid: cards + create + manage |
| 4 | Post-switch navigation | Always land on `/` |
| 5 | Mobile placement | Top of MobileHeader nav sheet, mirroring the rail |
| 6 | Single-campaign behaviour | Always render the switcher (consistent UI) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser                                                             │
│                                                                     │
│  ┌─────────────────────────────────┐                                │
│  │ CommandRail                     │   ┌──────────────────────────┐ │
│  │  ┌───────────────────────────┐  │   │ HomePage / page.tsx       │ │
│  │  │ <CampaignSwitcher>        │  │──>│ trpc.campaigns.getActive  │ │
│  │  │   - getMyMemberships      │  │   │ renders that campaign     │ │
│  │  │   - getActive             │  │   └──────────────────────────┘ │
│  │  │   - on pick: mutation +   │  │                                 │
│  │  │     router.replace('/')   │  │                                 │
│  │  └───────────────────────────┘  │                                 │
│  └─────────────────────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
                       │  tRPC
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Server                                                              │
│                                                                     │
│  userSettings.setActiveCampaign({ campaignId })                     │
│   ├── verify membership exists for ctx.user                         │
│   ├── upsert UserSettings row                                       │
│   └── return                                                        │
│                                                                     │
│  campaignService.getActiveCampaign(userId)                          │
│   ├── read UserSettings.activeCampaignId                            │
│   ├── if set → verify membership still valid → return               │
│   ├── else fall back to auto-derive (lastSessionDate ?? updatedAt)  │
│   └── if no campaigns → return null                                 │
└─────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
              Postgres: UserSettings.activeCampaignId
                        (FK to Campaign, ON DELETE SET NULL)
```

### Three driving principles

1. **Single source of truth on the server.** `getActiveCampaign` is the only function that resolves the active ID. Both HomePage and CampaignSwitcher consume it via the same tRPC query — same cache, same answer, no client-side derivation.
2. **Selection survives reload.** Mutation writes through before the client redirects. By the time `/` re-renders, the DB already reflects the new state.
3. **Deletion-safe by construction.** `getActiveCampaign` re-verifies membership on every call. Set-then-leave silently falls back; no error path needed in the UI.

### 308 cache mitigation

`permanentRedirect` issues HTTP 308 which Chrome/Edge cache aggressively. The browser may keep redirecting `/campaigns` → `/` from cache after the new route ships. Three layers:

- The new `/campaigns/page.tsx` ships with `<meta http-equiv="refresh" content="0;url=/campaigns?fresh=1">` on first server-render. `searchParams.fresh` is checked to short-circuit the meta on subsequent renders to prevent loops.
- The design doc's manual smoke checklist tells the user to hard-reload (`Ctrl+Shift+R`) once after deploy.
- The redirect at `/campaigns/[slug]/page.tsx` and `/campaigns/[slug]/sessions/[sessionId]/page.tsx` is left intact in this slice — separate cache issue, separate follow-up.

## Components inventory

### New files (3)

| Path | Purpose | LoC est. |
|---|---|---|
| `prisma/migrations/<ts>_user_settings_active_campaign/migration.sql` | Adds `activeCampaignId String?` (nullable, FK to Campaign with `ON DELETE SET NULL`) to `user_settings`. | ~10 |
| `src/components/shell/CampaignSwitcher.tsx` | Rail switcher. Reads `getMyMemberships` + `getActive`. Dropdown with campaigns checked, "Manage all" link to `/campaigns`. Two density modes: full (rail expanded) and icon-only (rail collapsed → trigger is a chevron, popover side="right"). Accepts a `mobile` prop that strips chrome and inlines into MobileHeader's nav sheet. | ~140 |
| `src/app/(app)/campaigns/page.tsx` | Replaces the 4-line redirect. Lean card grid + `?create=true` → existing CampaignCreateSheet + per-card kebab. Kebab items: **Set as active** (when not active), **Settings** (link to `/campaigns/[slug]/settings`), **Leave** (non-owner; uses existing `members.leave` from `src/server/routers/members.ts:156`), **Delete campaign** (owner; uses existing `campaigns.delete` from `src/server/routers/campaigns.ts:114`, gated by an `AlertDialog` confirmation). | ~180 |

### Modified files (5)

| Path | Change |
|---|---|
| `prisma/schema.prisma` | `UserSettings { ... activeCampaignId String? activeCampaign Campaign? @relation(fields: [activeCampaignId], references: [id], onDelete: SetNull) }`. Inverse relation on Campaign. |
| `src/server/services/campaign.service.ts` | New `getActiveCampaign(userId)` — reads UserSettings, verifies membership, falls back to auto-derive (current `getDashboardCampaigns` sort), returns hydrated campaign or `null`. |
| `src/server/routers/campaigns.ts` | New `getActive: protectedProcedure.query(({ ctx }) => campaignService.getActiveCampaign(ctx.session.user.id))`. |
| `src/server/routers/user-settings.ts` | New `setActiveCampaign: protectedProcedure.input(z.object({ campaignId: z.string() })).mutation(...)` — verifies membership, upserts UserSettings row. |
| `src/app/(app)/page.tsx` | Drop client-side auto-derive logic. Call `trpc.campaigns.getActive.useQuery()`. Render with returned campaign. Existing empty state unchanged. |
| `src/components/shell/CommandRail.tsx` | Mount `<CampaignSwitcher />` between logo and nav. Pass `collapsed` prop. |
| `src/components/shell/MobileHeader.tsx` | Mount `<CampaignSwitcher mobile />` at top of nav sheet, under "QuiverDM" header bar. |

### Deleted files (1)

| Path | Why |
|---|---|
| `src/components/campaign/campaign-pill.tsx` | V1 unmounted dropdown — superseded by `CampaignSwitcher`. Visual style doesn't match V2. Behavioural ideas (current/check, "All campaigns" link) port over. |

## Data flow

### Sequence A · Cold load on `/`

```
Browser            tRPC client          campaigns router       campaign service       Postgres
   │                   │                      │                       │                  │
   ├─ GET / ──────────>│                      │                       │                  │
   │                   ├─ getActive ─────────>│                       │                  │
   │                   │                      ├─ getActiveCampaign ──>│                  │
   │                   │                      │                       ├─ SELECT us ─────>│
   │                   │                      │                       │<─ {activeId} ────┤
   │                   │                      │                       ├─ verify member ─>│
   │                   │                      │                       │<─ ok ────────────┤
   │                   │                      │                       ├─ hydrate cmpgn ─>│
   │                   │                      │<─ {Campaign}──────────┤                  │
   │                   │<─ {data: Campaign}───┤                       │                  │
   │<─ render ─────────┤                      │                       │                  │
   │                                                                                     │
   │── (CampaignSwitcher mounts in parallel)                                             │
   │                   ├─ getMyMemberships ──>│  (already cached from existing usage)   │
```

`getActive` returns `Campaign | null`. HomePage renders campaign content or "No campaigns yet" empty state. The switcher and HomePage share the `getActive` cache so the rail label and home content stay in sync within one round-trip.

### Sequence B · Click campaign in switcher

```
User clicks dropdown item
        │
        ▼
CampaignSwitcher.onSelect(campaignId)
        │
        ├──▶ trpc.userSettings.setActiveCampaign.mutate({ campaignId })   [pessimistic]
        │       │
        │       ▼
        │    server: verify member → upsert UserSettings.activeCampaignId
        │       │
        │       ▶ ok
        │
        ├──▶ utils.campaigns.getActive.invalidate()                       [refetch active]
        ├──▶ utils.sessions.getAll.invalidate()                           [home reads sessions for active]
        ├──▶ utils.campaigns.getMyMemberships.invalidate()                [refresh "checked" indicator]
        │
        └──▶ router.replace('/')                                          [redirect home]
                │
                ▼
              HomePage refetches getActive → renders new campaign
```

**Pessimistic, not optimistic:** mutation is fast (~50 ms, single UPDATE). Optimistic would mean writing to React Query cache before server confirm. If membership verification fails server-side (rare race with `members.delete`), we'd flicker. Pessimistic is simpler and indistinguishable in practice.

**Three invalidations:** `getActive` (the new active campaign), `getMyMemberships` (so the dropdown checkmark moves to the new campaign without stale render), `sessions.getAll` (home's `RecentSessionsList` is keyed by `active.id`).

**`router.replace` not `router.push`:** push grows history (back button takes user to where they were before the switch — confusing). Replace keeps history clean.

### Sequence C · Set active from `/campaigns` card kebab

Same mutation + invalidations as Sequence B, but `router.push('/')` not replace — user came from `/campaigns` deliberately and may want to back out. Card visual: the active campaign gets an amber "Active" pill in the corner. The kebab "Set as active" item disappears (replaced with greyed "Currently active"). Hover affordance: card border picks up `--q-amber-trace`.

## Error handling

### Mutation failure modes

| Failure | Surface | Handling |
|---|---|---|
| Network drops mid-mutation | Toast "Couldn't switch campaign — try again" | No invalidation, no redirect. State unchanged. |
| 403 membership revoked between dropdown render and click | Toast "You no longer have access to this campaign" | Invalidate `getMyMemberships`. Don't redirect. |
| 404 campaign hard-deleted between render and click | Same as 403 | Same handling. FK constraint will also have nulled their existing setting if applicable. |
| 500 / unknown | Toast "Something went wrong" | Sentry log via existing tRPC error link. |

All four use existing tRPC error path → existing `useToast` hook. Zero new error infrastructure.

### Edge cases

| Case | Behaviour |
|---|---|
| `activeCampaignId` set but user no longer a member | `getActiveCampaign` membership verify fails → null → fallback auto-derive → home shows next-best campaign. No error. |
| Active campaign deleted | FK `ON DELETE SET NULL` clears the column → next read falls through to auto-derive. No error. |
| User has zero campaigns | `getActiveCampaign` returns null → empty state. Switcher hides itself when memberships array is empty (single special case — opposite of "always render with 1+"). |
| Brand-new user, never set active | UserSettings row may not exist. Service does `findUnique({ where: { userId }})` and treats missing as `activeCampaignId: null`. No row creation needed until first explicit set. |
| Campaign created mid-session | Existing CampaignCreateSheet flow lands user on the new campaign's URL. Auto-derive picks the just-created one (most-recent updatedAt). No auto-set. |
| User leaves their active campaign | Existing `members.leave` mutation runs. Add: invalidate `campaigns.getActive` after leave succeeds. Next render falls through. |
| Co-DM gets role removed by owner | Owner's `members.update` already invalidates `getMyMemberships`. Add `getActive` to that invalidation list — same pattern. |
| Stored `activeCampaignId` references hard-deleted membership | Verify returns false → service returns null. Stored ID dangles in UserSettings until next explicit set. Not worth a cleanup job. |
| Concurrent double-click | React Query mutation key dedupes if pending. Different campaigns rapidly — last-write-wins server-side. Fine. |
| Two tabs open, switch in tab A | Tab B is stale until next `getActive` refetch (route change, focus event, or 60s staleTime). No cross-tab broadcast. |
| `/campaigns/[slug]` 308 still cached | Out of scope for this design. Tracked as follow-up. |

### Explicit non-goals

- No optimistic UI on the mutation.
- No cross-tab "active" sync.
- No "recently viewed" history on the switcher dropdown — flat membership list.
- No soft-archive concept introduced. Owner's kebab "Delete campaign" calls existing hard-delete `campaigns.delete` behind an AlertDialog confirmation. A real archive flag is a future slice.

## Testing

### Unit (Vitest)

`tests/services/campaign.service.spec.ts` — `getActiveCampaign`:
- Returns the set campaign when membership valid.
- Returns null when `activeCampaignId` references a campaign user is no longer a member of.
- Returns null when `activeCampaignId` is null.
- Returns null when user has no UserSettings row.
- Pure auto-derive path works when DB is in fallback state.
- Returns null when user has no campaigns at all.

### Integration (Vitest + Prisma test DB)

`tests/routers/user-settings.spec.ts` — `setActiveCampaign`:
- 200 + DB write when caller is a member.
- 403 when caller has no membership row for that campaign.
- 404 when campaign ID doesn't exist.

`tests/routers/campaigns.spec.ts` — `getActive`:
- Returns campaign when set.
- Returns auto-derived campaign when not set.
- Returns null when user has no campaigns.

### E2E workflow spec (Playwright)

`tests/workflows/campaign-switcher.workflow.spec.ts`:

1. Seed: 2 campaigns owned by `dev@blakewales.au`. No active set.
2. Visit `/`. Assert home shows most-recently-updated campaign (auto-derive).
3. Open rail switcher. Assert dropdown lists both, neither checked.
4. Click second campaign. Wait for navigation.
5. Assert URL is `/`. Assert home shows second campaign. Assert switcher trigger label updates.
6. Reload page. Assert second campaign still active (persistence).
7. Visit `/campaigns`. Assert grid renders both cards with "Active" pill on the second.
8. Click first card's kebab → "Set as active". Assert nav to `/`. Assert home shows first.
9. Mobile viewport (375×812): hamburger → switcher visible at top of nav sheet → switch works.

### Persona spec (existing, augment)

`tests/personas/veteran-dm.persona.spec.ts` — Vic owns multiple campaigns. Add a step that exercises the switcher between two of his campaigns during prep workflow. Single assertion. Doesn't bloat the persona.

### Manual smoke checklist (post-deploy)

- Hard-refresh (`Ctrl+Shift+R`) once to clear lingering 308 cache.
- Verify rail switcher renders correctly with 1, 2, and 5+ campaigns.
- Verify mobile nav-sheet switcher.
- Verify `/campaigns` deep-link works (cache-busting meta refresh hits).

## Out of scope / follow-ups

- Restoring `/campaigns/[slug]` and `/campaigns/[slug]/sessions/[sessionId]` from their current `permanentRedirect('/')` state. The slug-specific routes are still 308'd to `/`. Separate slice — separate cache problem.
- Cross-tab active-campaign sync (BroadcastChannel).
- Recently-viewed campaigns ordering on the switcher.
- Soft-archive (vs hard-delete) for owners.
- Reviving a real campaign overview page at `/campaigns/[slug]` (currently every campaign-scoped path under `[slug]` works except the index).
