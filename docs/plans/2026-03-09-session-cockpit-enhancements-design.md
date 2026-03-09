# Session Cockpit Enhancements — Design

**Date:** 2026-03-09
**Status:** Approved

## Context

The session cockpit at `/campaigns/[slug]/sessions/[sessionId]/live` already has most of Phase 3 — Session Mode Dashboard built: 3-column layout, party HP/conditions, live notes with AI hints, combat mode, NPC quick recall, dice roller, and end-session dialog. This plan fills the four remaining gaps.

## Existing Architecture

- **Page:** `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx`
- **Layout:** `src/app/(session)/layout.tsx` — full-screen, no app shell
- **Components:** `src/components/cockpit/` — header, toolbar, party panel, notes, combat, prep reference, NPC recall
- **3-column layout:** Left (party, 240px) | Center (main, flex) | Right (prep+NPCs, 320px)
- **Bottom:** `CockpitToolbar` with mode switcher, dice roller, end session

## What's Being Added

### 1. Panic Tools — Generate NPC + Suggest Twist

**Location:** `CockpitToolbar` — two new buttons next to the dice roller.

**Generate NPC:**
- Opens `GenerateNpcDialog`
- DM optionally types a hint (e.g. "gruff innkeeper")
- Calls `trpc.sessions.generateQuickNpc({ sessionId, hint? })` mutation
- Server: `chatWithAI` with structured JSON prompt → `{ name, role, trait, secret, voiceQuirk }`
- Dialog renders result; "Save to Campaign" calls `trpc.npcs.create`

**Suggest Twist:**
- Opens `SuggestTwistDialog`
- Calls `trpc.sessions.suggestTwist({ sessionId, hint? })` mutation
- Server: sends `quickNotes` + last 200 chars of transcript context to AI → `{ twists: string[] }` (3 items)
- Dialog renders 3 twist options; read-only, no save action

**New tRPC procedures** (added to `sessions` router):
```typescript
generateQuickNpc: protectedProcedure
  .input(z.object({ sessionId: z.string(), hint: z.string().max(200).optional() }))
  .mutation(...)

suggestTwist: protectedProcedure
  .input(z.object({ sessionId: z.string(), hint: z.string().max(200).optional() }))
  .mutation(...)
```

Both verify session ownership via existing `authz` pattern before calling AI.

---

### 2. Brain Panel — Right Panel Third Tab

**Location:** Right panel in `live/page.tsx` — add `Brain` tab alongside existing `Prep` and `NPCs`.

**Contents:**
- **Open Hooks** — `trpc.brain.state.get({ campaignId })`, top 5 open hooks sorted by urgency. Reuses `HookList` component from `src/components/brain/hook-list.tsx`.
- **Active Threats** — `threats` array from WorldState, compact list with urgency bars.
- **Quick Entity Lookup** — debounced search (300ms) calling `trpc.brain.entities.list({ campaignId, search })`. Results show entity name + type badge. Click shows description + properties in an inline popover.

**Guard:** Only renders if `isDM`. If Brain not seeded (0 entities), shows subtle "Seed Brain from campaign settings" note.

**Polling:** `staleTime: 60_000`, `refetchInterval: 60_000` — hooks/threats update every minute during session.

---

### 3. End-Session Pipeline View

**Location:** `CockpitToolbar` → replaces `EndSessionDialog`.

**Two-stage modal:**

**Stage 1 — Confirm:**
- Identical to current dialog: "End session?" + Keep Playing / End Session buttons
- On confirm: calls `sessions.complete` mutation, advances to Stage 2

**Stage 2 — Pipeline Progress:**
- Modal stays open (not closeable until done or timeout)
- Vertical checklist polled every 3s via `trpc.sessions.getById({ id: sessionId }, { refetchInterval: 3000 })`
- Rows and their status sources:

| Row | Field | Done condition |
|-----|-------|---------------|
| Session complete | — | always done after mutation succeeds |
| AI Summary | `session.aiSummaryStatus` | `=== 'done'` |
| Player Recap | `session.playerRecapStatus` | `=== 'done'` |
| Derailment Analysis | `session.derailmentStatus` | `=== 'done'` |
| Brain Ingestion | `worldState.lastIngestedSessionId` | `=== sessionId` |

- Status icons: `✓` (done), spinning loader (processing), `◦` (pending), `✗` (error)
- After all done OR 3-minute timeout: "View Session" button appears → navigates to session detail page
- DM can keep modal open to wrap up at the table

**Note:** If `playerRecapStatus` / `derailmentStatus` don't exist on the session model, infer from `aiHighlights` presence and `derailmentAnalysis` field respectively.

---

### 4. Initiative Tracker

**Location:** `PartyOverviewPanel` — collapsible section below party cards.

**Data model:** Pure local React state — no backend persistence. Resets on page refresh (intentional — initiative is ephemeral per encounter).

**State shape:**
```typescript
interface Combatant {
  id: string;       // uuid
  name: string;
  initiative: number;
  isPlayer: boolean;
  isCurrent: boolean;
}
```

On mount: pre-populate from `getCampaignCharacters` (names only, initiative = 0).

**UI:**
- Collapsed by default; small "Initiative" header to expand/collapse
- When expanded: list sorted by `initiative` descending
- Each row: name, editable initiative input, HP badge (live from session state for PCs), `×` remove button
- Current turn highlighted with amber left border
- "Add creature" row: name input + initiative input → appends to list
- "Next" button (or `N` key while tracker focused) → cycles `isCurrent` forward, wraps around, increments round counter on full cycle
- "Reset" clears initiative values and current-turn marker
- Round counter displayed: `Round 3`

**Keyboard shortcut:** `N` key cycles next turn only when initiative tracker is expanded and no input is focused.

---

## Files Changed

### New files:
- `src/components/cockpit/generate-npc-dialog.tsx`
- `src/components/cockpit/suggest-twist-dialog.tsx`
- `src/components/cockpit/pipeline-progress-dialog.tsx`
- `src/components/cockpit/initiative-tracker.tsx`

### Modified files:
- `src/server/routers/sessions.ts` — add `generateQuickNpc`, `suggestTwist` procedures
- `src/components/cockpit/cockpit-toolbar.tsx` — add Generate NPC + Suggest Twist buttons; replace EndSessionDialog with PipelineProgressDialog
- `src/components/cockpit/party-overview-panel.tsx` — add InitiativeTracker section
- `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx` — add Brain tab to right panel

## Non-Goals

- No backend persistence for initiative (ephemeral per-encounter state)
- No drag-to-reorder initiative list (type-in is faster at the table)
- No new routes or pages
- No changes to the session detail page (`/sessions/[sessionId]`)
