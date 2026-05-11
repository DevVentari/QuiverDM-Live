# Party on Home — Design Spec

> Date: 2026-05-11
> Status: design approved, plan pending
> Related: `docs/superpowers/plans/2026-05-10-v2-home-mockup-impl.md` (V2 Home Mockup)

## Problem

In the V2 home mockup, player characters (PCs) have no presence on the home dashboard, and the only way to reach the Party page is a small `Shield` icon in the `CommandRail` footer. The home page surfaces Sessions, NPCs, Locations, and Items prominently — but not the party that those sessions revolve around.

Two gaps:

1. **Visibility** — `src/app/(app)/page.tsx` renders Hero / WorldActivity / RecentSessions / ActiveCampaignSummary / PrepReminders. None of them show the PCs.
2. **Navigation** — Party lives only in the rail footer (`src/components/layout/command-rail.tsx:231-245`). It's not in the Campaign nav section that contains Overview and Sessions.

The `ActiveCampaignSummary` component (`src/components/home/ActiveCampaignSummary.tsx`) already has a `Shield` icon and a stubbed `Level X → Y` progress bar — the props are accepted but no caller passes them. That card was designed to host party state and is currently half-implemented.

## Goal

Make the active party visible on the home dashboard and promote `Party` to a first-class entry in the rail's Campaign nav section.

## Approach

### A. Home widget — extend `ActiveCampaignSummary`

Add a Party row inside the existing summary card, between the campaign title block and the level progress bar. Wire up the existing `partyLevel` / `levelTarget` props using values derived from the fetched characters.

**Card structure after change** (top → bottom):

1. Shield + campaign name + "Ongoing since…"
2. **NEW: Party row** — overline `PARTY · N active` + portrait strip + empty/CTA state
3. Level progress bar (now active because `partyLevel` is populated)
4. Stat tiles (Sessions / NPCs / Locations / Items — unchanged)
5. `Campaign Overview` button (unchanged)

Stat tiles stay 4-wide. The Party row carries enough visual weight on its own; adding a 5th tile would compete with the avatar strip.

### B. Rail promotion

In `src/components/layout/command-rail.tsx`:

- Add a `RailItem` for Party in the Campaign section, between Overview (`:184`) and Sessions (`:185`).
  - `href={\`/campaigns/${campaignSlug}/players\`}`
  - `label="Party"`
  - `icon={Shield}` (already imported on `:11`)
  - `isActive` when `pathname.startsWith(\`/campaigns/${campaignSlug}/players\`)`
- Remove the Party `Link` block from the footer (`:231-245`). The footer becomes `ThemeToggle` + Settings only.

## Data

**Query** added to `src/app/(app)/page.tsx`:

```ts
const { data: characters } = trpc.characters.getCampaignCharacters.useQuery(
  { campaignId: active?.id ?? '' },
  { enabled: !!active?.id, staleTime: 60_000 },
)
```

**Derivations** (in `src/app/(app)/page.tsx`):

- `activeParty = characters?.filter(cc => cc.status === 'ACTIVE') ?? []`
- `pendingCount = characters?.filter(cc => cc.status === 'PENDING').length ?? 0`
- `partyLevel` = `round(avg(level))` over `activeParty.map(cc => cc.character.level).filter(Boolean)`; `undefined` if no character has a level
- `levelTarget = 20` (D&D max; passed only when `partyLevel` is defined)

These are passed to `ActiveCampaignSummary` as new props.

### Why not derive on the server

The home page already fans out 2 tRPC queries (`campaigns.getActive`, `sessions.getAll`). Adding one more matches the existing pattern. A future optimization could merge characters into `campaigns.getActive`, but that's not required for this slice and changes a shared procedure.

## Component changes — `ActiveCampaignSummary`

`src/components/home/ActiveCampaignSummary.tsx`

**New props:**

```ts
party?: Array<{
  id: string;          // campaignCharacter.id
  characterId: string; // character.id (for future sheet-drawer integration)
  name: string;
  portraitUrl?: string | null;
  level?: number | null;
}>;
pendingPartyCount?: number;
isDM?: boolean;        // controls visibility of pending badge + "Add character" CTA
```

`partyLevel` / `levelTarget` already exist on the props interface — no change.

**Party row layout** (inserted between the title block and the level progress bar):

- Overline (matches existing card overline style — Cinzel, `text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]`):
  - `PARTY · {N} active`
  - If `isDM && pendingPartyCount > 0`: append ` · {pendingPartyCount} pending` in amber (`text-[var(--q-amber)]`)
- Portrait strip:
  - Up to 6 circular 28px avatars, `gap-2`, left-aligned
  - Each avatar uses `next/image` with `object-cover object-top`, `unoptimized` (matches the players page convention)
  - Avatars without a `portraitUrl` render the same gradient + `Users` icon fallback used in `players/page.tsx`
  - If `activeParty.length > 6`, render a `+{N - 6}` chip (28px circle, amber-tinted border, same height as avatars) after the 6th
  - The whole strip is a `Link` to `/campaigns/{slug}/players`
- Empty state (when `activeParty.length === 0`):
  - Faint copy: `No party yet`
  - DM-only inline link: `Add character` → `/campaigns/{slug}/players?add=true`

**Level progress bar:**

- No structural change; only behavior changes because callers now pass `partyLevel`/`levelTarget`
- Keep the existing render guard: bar only shows when both `partyLevel` and `levelTarget` are truthy and `levelTarget > 0`

## Caller change — `src/app/(app)/page.tsx`

The single call site at `:107-115` adds the new props:

```tsx
<ActiveCampaignSummary
  name={active.name}
  slug={active.slug}
  ongoingSince={active.createdAt}
  sessionCount={active.sessionCount}
  npcCount={active.npcCount}
  locationCount={active.locationCount}
  itemCount={active.itemCount}
  partyLevel={partyLevel}
  levelTarget={partyLevel ? 20 : undefined}
  party={activeParty.map(cc => ({
    id: cc.id,
    characterId: cc.character.id,
    name: cc.character.name,
    portraitUrl: cc.character.portraitUrl,
    level: cc.character.level,
  }))}
  pendingPartyCount={pendingCount}
  isDM={active.role === 'OWNER' || active.role === 'CO_DM'}
/>
```

`isDM` is already derived inline at `:39` for the header slot; reuse the same expression.

## Rail change — `src/components/layout/command-rail.tsx`

Inside the `inCampaign` branch (`:181-215`):

```tsx
<RailSectionLabel label="Campaign" pinned={pinned} />
<RailItem href={`/campaigns/${campaignSlug}`}          label="Overview" icon={Home}         isActive={pathname === `/campaigns/${campaignSlug}`}                  pinned={pinned} />
<RailItem href={`/campaigns/${campaignSlug}/players`}  label="Party"    icon={Shield}       isActive={pathname.startsWith(`/campaigns/${campaignSlug}/players`)} pinned={pinned} />
<RailItem href={`/campaigns/${campaignSlug}/sessions`} label="Sessions" icon={CalendarDays} isActive={pathname.startsWith(`/campaigns/${campaignSlug}/sessions`)} pinned={pinned} />
```

Footer block at `:231-245` (the Party `Link`) is removed entirely. Footer keeps only `ThemeToggle` and the Settings link.

## Files

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/app/(app)/page.tsx` | Fetch characters; derive `activeParty`, `pendingCount`, `partyLevel`; pass new props |
| Modify | `src/components/home/ActiveCampaignSummary.tsx` | New props + party row + uses existing level progress |
| Modify | `src/components/layout/command-rail.tsx` | Promote Party to Campaign nav, remove footer entry |
| Modify | `tests/workflows/home.workflow.spec.ts` | Add assertions for party row (populated and empty states) |

No new files. No schema changes. No tRPC changes.

## Edge cases

- **No active campaign** — home falls back to the "No campaigns yet" branch (`:53-64`), unchanged.
- **Active campaign, no characters at all** — `activeParty = []`, `pendingCount = 0`. Party row renders the empty state. Level progress bar is hidden (no `partyLevel`).
- **Only pending characters** — `activeParty = []`, `pendingCount > 0`. Empty state copy still renders; DM sees the `{N} pending` suffix and the `Add character` link is still useful as a path into the players page.
- **Character missing `level`** — excluded from the average. If no character has a level, `partyLevel` is undefined and the level progress bar stays hidden.
- **Character missing `portraitUrl`** — renders the gradient + `Users` icon fallback.
- **More than 6 active characters** — `+N` chip after the 6th avatar; whole strip links to `/players` where they can see everyone.
- **Player role (not DM)** — note: the V2 product direction is DM-only (`memory/project_player_view_removal.md`). `isDM` is plumbed for future-proofing the pending badge and "Add character" CTA, but in practice all current users are DMs.

## Testing

- `tests/workflows/home.workflow.spec.ts`:
  - Existing assertions for hero/sessions/world-activity/prep-reminders unchanged
  - Add: when active campaign has characters, the home page contains `text=PARTY` and at least one avatar image; the strip is a link to `/campaigns/{slug}/players`
  - Add: when active campaign has zero characters, the home page shows `text=No party yet`
- Manual verification on `npm run dev`:
  - Navigate `/`, confirm party row renders for a seeded campaign with characters
  - Navigate `/campaigns/{slug}/players`, confirm the rail's Party item highlights
  - Resize to narrow viewport and confirm the avatar strip + overline still fit inside the card
  - Confirm footer no longer shows the Party shield icon — only Theme + Settings

## Out of scope

- Clicking an avatar to open the character sheet drawer via `usePinnedItems().openSheet` — link to `/players` for V1; sheet integration can come later.
- D&D Beyond sync trigger from the home card.
- Persisting `partyLevel` as a stored field on `Campaign` — compute on read for now.
- Mobile-specific overflow tuning beyond the `+N` chip.
- Updating any non-home page that reuses `ActiveCampaignSummary` — it's only used by the home page (`grep` confirms a single import site).
