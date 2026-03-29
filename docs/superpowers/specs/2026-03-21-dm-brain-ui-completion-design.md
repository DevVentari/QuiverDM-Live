# DM Brain — UI Completion

**Date:** 2026-03-21
**Status:** Draft

## Dependencies

- **SP1 (Ingestion Pipeline)** must be implemented first — `EntityMergeCandidate` and `EntityMergeRule` models are defined there.
- **SP4 (World Simulation)** must be implemented first or in parallel — `WorldEventProposal` model is defined there. The Events tab requires both models.

## Problem

The Brain UI has the right structure but several critical surfaces are shallow or missing: pressure history displays as static gauges with no context, threats show no trajectory, hooks can't be resolved from the UI, relationship history is recorded but never shown, entity confidence scores are invisible, and there is no way to query the brain with natural language.

## Solution

Six targeted additions to the existing Brain pages and components. No new pages — all changes augment existing structure.

---

## Change 1 — Pressure History Sparklines

**New model:** `WorldPressureHistory`

```prisma
model WorldPressureHistory {
  id           String   @id @default(cuid())
  campaignId   String
  campaign     Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  sessionId    String?
  political    Float
  supernatural Float
  economic     Float
  cosmic       Float
  social       Float
  recordedAt   DateTime @default(now())

  @@index([campaignId, recordedAt])
}
```

**Campaign model addition:**
```prisma
pressureHistory WorldPressureHistory[]
```

Written by `brain-ingestion-worker.ts` (a scheduled script, not a BullMQ queue worker) after each successful campaign ingestion. One row per ingestion run.

**New tRPC procedure:** `brain.pressureHistory.list` — `{ campaignId, limit?: number }` → `WorldPressureHistory[]` ordered by `recordedAt DESC`. Returns last 7 by default.

**New component:** `src/components/brain/pressure-history-row.tsx`

Renders one pressure track row: `[label] [bar at current value] [7-point inline SVG sparkline] [trend arrow ↑↓→]`

Sparkline: 60×20px SVG polyline, 7 data points. Trend arrow: ↑ if last > first by >0.05, ↓ if dropped >0.05, → otherwise.

**Update:** `src/components/brain/pressure-gauges.tsx`

Accept an additional optional `history?: WorldPressureHistory[]` prop. When provided, render `PressureHistoryRow` per track instead of simple bars. `page.tsx` fetches history via `brain.pressureHistory.list` and passes it down.

---

## Change 2 — Threat Trajectory Cards

**`brain-ingestion-worker.ts` addition** (this is a script, not a BullMQ worker — runs directly after inference):

For each THREAT entity with ≥ 2 `WorldStateChange` records in the last 5 sessions:
- Read `properties.stress` or `properties.influence` deltas across changes
- Compute `delta_per_session` (average change per session over the window)
- If `delta_per_session > 0` and current value < 1.0: `sessions_to_critical = ceil((1.0 - current) / delta_per_session)`
- Write to `WorldEntity.properties.trajectory`: `{ delta_per_session, sessions_to_critical, computed_at }`

**New component:** `src/components/brain/threat-trajectory-card.tsx`

Renders for each THREAT entity with a `trajectory` property set. Placed in the right column of the overview tab (below Entity Counts), not the left column (which is already dense with SessionSeedCard, PressureGauges, Hooks, Recent Entities).

```
┌─────────────────────────────────────────────┐
│ ⚠ [entity name]                              │
│ Influence: ████████░░ 0.78                   │
│ +0.12/session · critical in ~2 sessions      │
└─────────────────────────────────────────────┘
```

Amber border. If `sessions_to_critical <= 2`, show red border instead.

---

## Change 3 — Hook Detail Drawer

**New component:** `src/components/brain/hook-detail-drawer.tsx`

A shadcn `<Sheet side="right">` triggered by selecting a hook in `HookList`.

**Props:** `{ hook: WorldHook; campaignId: string; open: boolean; onClose: () => void }`

**Content:**
- Full hook description
- Urgency badge + age ("High urgency · 4 sessions open")
- Linked entity chips (clickable → entity detail in new tab)
- Resolution history from `WorldStateChange` (filtered by hook reference)
- **Actions:**
  - **Resolve** — requires reason text (min 10 chars). Marks hook `status: 'resolved'`. Calls new `brain.hooks.resolve` procedure.
  - **Escalate** — bumps urgency one level. Calls `brain.hooks.escalate`.
  - **Reopen** — available on resolved hooks only. Calls `brain.hooks.reopen`.

**New tRPC procedures** (under `brainRouter`, using `protectedProcedure` with manual ownership checks — consistent with existing `brain.ts` pattern):
- `brain.hooks.resolve` — `{ campaignId, hookId, reason }` → updates hook in `WorldState.hooks`, writes `WorldStateChange`
- `brain.hooks.escalate` — `{ campaignId, hookId }` → bumps urgency, writes `WorldStateChange`
- `brain.hooks.reopen` — `{ campaignId, hookId, reason }` → resets to open, writes `WorldStateChange`

**`HookList` update** (`hook-list.tsx`):

Add `onSelect?: (hook: WorldHook) => void` prop. Each hook row gains an `onClick` that fires `onSelect`. Add a "Resolved" collapsible section at the bottom showing resolved hooks (strikethrough, muted).

**`page.tsx` update:**

Add `selectedHook` state + `hookDrawerOpen` state. Pass `onSelect` to `HookList`. Render `<HookDetailDrawer>` at page level.

Pass the **full** hooks array (unsliced) to `HookList` — remove the current `.slice(0, 5)` cap so the resolved section can access all hooks. `HookList` handles its own open/resolved split internally.

Remove `handleResolveHook` and the existing `onResolve` prop usage — hook resolution now goes exclusively through `HookDetailDrawer`'s resolve action. This eliminates the duplicate resolve path.

---

## Change 4 — Events Tab (Review Queue)

**Dependency:** Requires `WorldEventProposal` (from SP4) and `EntityMergeCandidate` / `EntityMergeRule` (from SP1).

**New tab** on the Brain page: "Events" between "Warnings" and the existing tabs. Tab label shows badge count of pending items.

**Two sections:**

**World Event Proposals** (from SP4):
- Each proposal card: simulation context, events with narrative + proposed effects list
- Per-event approve/reject toggle
- "Approve All" / "Reject All" buttons
- Approval commits mutations via `brain.worldSimulation.proposals.approve`

**Merge Candidates** (from SP1):
- Each card: Entity A (name, type), Entity B (name, type), similarity score bar, suggested canonical name (editable input)
- Approve → `brain.mergeCandidates.approve`
- Reject → `brain.mergeCandidates.reject`
- Empty state: "No pending merges"

**New tRPC procedures for fetching:**
- `brain.events.pending` — `{ campaignId }` → `{ proposals: WorldEventProposal[]; mergeCandidates: EntityMergeCandidate[] }` — count used for badge

---

## Change 5 — Semantic Query Panel

**New component:** `src/components/brain/brain-query-panel.tsx`

A shadcn `<CommandDialog>` triggered by `Cmd/Ctrl+K` when the user is on any `/brain` route.

**New tRPC procedure:** `brain.query` — `{ campaignId, question: string }` → `{ answer: string; relatedEntities: WorldEntity[] }`

The procedure calls the existing `answerBrainQuery` from `brain-query.ts` for the prose answer, and separately queries for entities whose name, description, or properties contain relevant terms (simple text search, not embedding-based). Returns both.

The existing `brain.voiceQuery` procedure is superseded by this and should be removed from `brain.ts` — it returns a plain string and has no callers in the current UI (the voice module calls `answerBrainQuery` directly, not via tRPC).

**Interaction:**
1. DM types a question: "Who knows about the third anchor?"
2. On Enter → calls `brain.query`
3. Results: prose answer at top, related entity cards below (name, type badge, description snippet)
4. Clicking an entity card → navigates to entity detail
5. Keyboard shortcut handler: `document.addEventListener('keydown', handler)` — only fires if `e.target` is not an `INPUT`, `TEXTAREA`, or `[contenteditable]` element

---

## Change 6 — Entity Detail Additions

**Relationship history** (`src/app/(app)/campaigns/[slug]/brain/entities/[entityId]/page.tsx`):

Below the "Relationships" card, add a collapsible "Relationship History" accordion (collapsed by default). Reads the `history` JSONB array from each relationship and renders as a timeline: `[session N] [change description]`. Shows nothing if all relationships have empty history arrays.

**Confidence badge:**

Next to entity name in the header:
- ≥ 0.9 → small green badge "Confirmed"
- 0.7–0.9 → amber badge "Inferred"
- < 0.7 → red badge "Uncertain"

Tooltip: "Confidence reflects how consistently this entity has been identified across sessions."

---

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `WorldPressureHistory`; add `pressureHistory` back-relation to `Campaign` |
| `src/server/routers/brain.ts` | Add `pressureHistory.list`, `hooks.resolve/escalate/reopen`, `events.pending`, `query` procedures |
| `src/lib/queue/brain-ingestion-worker.ts` | Add threat trajectory computation; write `WorldPressureHistory` after ingestion |
| `src/components/brain/pressure-gauges.tsx` | Accept optional `history` prop; render `PressureHistoryRow` when provided |
| `src/components/brain/pressure-history-row.tsx` | New — sparkline row |
| `src/components/brain/threat-trajectory-card.tsx` | New — threat trajectory card |
| `src/components/brain/hook-detail-drawer.tsx` | New — hook detail sheet |
| `src/components/brain/hook-list.tsx` | Add `onSelect` prop; add resolved section |
| `src/components/brain/brain-query-panel.tsx` | New — Cmd+K query panel |
| `src/app/(app)/campaigns/[slug]/brain/page.tsx` | Add Events tab; threat cards in right column; hook drawer state; query panel shortcut; pressure history fetch |
| `src/app/(app)/campaigns/[slug]/brain/entities/[entityId]/page.tsx` | Relationship history accordion; confidence badge |

---

## Out of Scope

- Interactive graph editor (node dragging)
- Faction influence chart (pressure sparklines cover this)
- Hook priority drag-reorder
