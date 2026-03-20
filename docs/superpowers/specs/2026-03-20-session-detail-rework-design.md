# Session Detail Page — Lifecycle-Aware Rework

**Date:** 2026-03-20
**Status:** Approved

## Problem

The session detail page (`/campaigns/[slug]/sessions/[sessionId]`) is blind to where a session sits in its lifecycle. A session being prepped for next Friday and a session completed three months ago render identical UI — same "Start Session" and "Prep" action buttons, same empty SummaryCard as hero content. The page tries to serve pre-session and post-session jobs simultaneously and does neither well.

Secondary issue: the prep workspace is at a separate URL (`/campaigns/[slug]/sessions/prep?sessionId=...`) with no explicit back link to the session that launched it. The `PrepHeader` back arrow goes to `/sessions` (the list), discarding the session context entirely.

## Solution

Make the session detail page lifecycle-aware without restructuring URLs or the prep workspace itself.

Three targeted changes:

1. **Status-aware header CTAs** — action buttons adapt to session status
2. **PrepStatusCard** — new component, shown only in planning phase, summarises prep completion inline
3. **PrepHeader back link** — add `sessionId` prop so the back arrow returns to the session detail page

---

## Session Lifecycle

Session `status` values (DB): `planning`, `in_progress`, `active`, `completed`, `cancelled`.
`prepStatus` (separate field): `none` | `draft` | `complete` — sub-state of `planning`. `none` and `draft` are treated identically throughout this spec (both mean "prep not yet complete").

| Status | Sub-state | Meaning | Primary job on detail page |
|--------|-----------|---------|---------------------------|
| `planning` | `prepStatus = none/draft` | Prep not started/in progress | Drive DM into prep workspace |
| `planning` | `prepStatus = complete` | Prep done, ready to run | Surface Start Session |
| `in_progress` / `active` | — | Session running now | Link to live cockpit |
| `completed` | — | Session is done | Review summary + recordings |
| `cancelled` | — | Abandoned | Archive view, delete option |

---

## Change 1 — Status-Aware Header CTAs

**File:** `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

Replace the static button block with status-conditional rendering. Only DMs see any action buttons.

| Session status | Sub-state | Primary button | Secondary | Tertiary |
|----------------|-----------|---------------|-----------|---------|
| `planning` | `prepStatus = none/draft` | "Open Prep Workspace" (amber, `btn`) | — | Delete (ghost icon) |
| `planning` | `prepStatus = complete` | "Start Session" (default, `btn`) | "View Prep" (outline) | Delete |
| `in_progress` / `active` | — | "Resume Session" (green tint, `btn`) | "View Prep" (outline) | Delete |
| `completed` | — | "View Prep" (outline, ghost) | — | Delete |
| `cancelled` | — | — | — | Delete |

"Open Prep Workspace" and "View Prep" both link to `/campaigns/${slug}/sessions/${sessionId}/prep`.

"Start Session" / "Resume Session" link to `/campaigns/${slug}/sessions/${sessionId}/live`.

---

## Change 2 — PrepStatusCard

**New file:** `src/components/session/prep-status-card.tsx`

Shown in place of `SummaryCard` when `sessionStatus === 'planning'` (regardless of `prepStatus`).

**Props:**
```ts
interface PrepStatusCardProps {
  session: any;          // full session object from getById
  sessionId: string;
  slug: string;
}
```

**Behaviour:**
- Parses `session.prepData` with `SessionPrepDataSchema.safeParse` (same schema used in `prep-workspace.tsx`)
- Computes section completion using the same logic as `PrepWorkspace.completedSections`:
  - `characters` — any note has `goals` or `notes`
  - `strong-start` — `strongStart` is non-empty string
  - `scenes` — `scenes.length > 0`
  - `secrets` — `secretsAndClues.length > 0`
  - `npcs` — `npcs.length > 0`
  - `monsters` — `monsters.length > 0`
  - `rewards` — `rewards.length > 0`
  - `threads` — `looseThreads.length > 0`
- Displays an 8-cell grid (same section order as `PREP_SECTIONS`) — complete cells use emerald tint, incomplete use muted stone
- Shows "{n}/8 sections" count
- "Continue Prep →" link goes to `/campaigns/${slug}/sessions/${sessionId}/prep`
- `prepStatus` of `none` or `draft` both show the incomplete-prep state (grid + "Continue Prep →" link)
- If `prepStatus === 'complete'`, shows a "Prep Complete" badge instead of the grid CTA, and the card border uses amber tint

**Visual style:** Stone card matching the existing `SummaryCard` style (same border, gradient background, amber overline label).

---

## Change 3 — PrepHeader Back Link

**File:** `src/components/session/prep/prep-header.tsx`

Add optional `sessionId?: string` prop. When present, the back arrow links to `/campaigns/${slug}/sessions/${sessionId}` instead of `/campaigns/${slug}/sessions`.

Pass `sessionId` down through:
- `PrepWorkspace` props → `PrepHeader` props
- `PrepWorkspace` already receives `sessionId` (it's a required prop)

**No other changes to PrepWorkspace or PrepHeader.**

---

## Body Layout Changes

**File:** `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

The two-column body (`main + 272px sidebar`) remains unchanged for `completed` sessions.

For `planning` / `prepped` sessions: render `PrepStatusCard` as the main column content. The sidebar still renders `RecordingsSidebar` (with a contextually appropriate empty state: "No recordings — session hasn't run yet") and omits `DiscordSidebar` (Discord posting is only relevant post-session).

`TranscriptSection` is already null-safe (renders nothing if `session.transcripts` is empty) — no change needed.

---

## Files Changed

| File | Change type |
|------|-------------|
| `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` | Modify — status-aware CTAs + conditional body |
| `src/components/session/prep-status-card.tsx` | New |
| `src/components/session/prep/prep-header.tsx` | Modify — add optional `sessionId` prop |
| `src/components/session/prep/prep-workspace.tsx` | Modify — pass `sessionId` to `PrepHeader` |

---

## Out of Scope

- Changing the prep workspace URL structure
- Sessions list page changes
- Adding new session statuses
- `DmVisibilityControls` — untouched, renders as-is
- `DiscordSidebar` — untouched component, just conditionally rendered
