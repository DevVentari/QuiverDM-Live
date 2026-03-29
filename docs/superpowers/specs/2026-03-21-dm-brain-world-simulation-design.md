# DM Brain — World Simulation Completion

**Date:** 2026-03-21
**Status:** Draft

## Problem

The world simulation tick generates narrative event text but commits no state changes. The AI response format is a bare JSON array that ignores actor goals and resources. Ticks run only on manual button press. There is no mechanism for the DM to review and selectively approve proposed state changes before they take effect.

## Solution

Upgrade the sim tick to generate structured `effects` alongside narrative text, auto-fire after inference completes, gate all mutations behind a `WorldEventProposal` review queue, and improve the actor prompt to produce coherent goal-pursuit behaviour.

Note: `WorldSimulationEvent` is NOT retired — it stays in the schema for historical records. The new `WorldEventProposal` is a parallel concept for pending/reviewable proposals only. After DM approval, approved events are also written as `WorldSimulationEvent` records so the existing `SessionSeedCard` query continues to work.

---

## Change 1 — New DB Model: WorldEventProposal

```prisma
model WorldEventProposal {
  id             String      @id @default(cuid())
  campaignId     String
  campaign       Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  gameSessionId  String?
  gameSession    GameSession? @relation(fields: [gameSessionId], references: [id], onDelete: SetNull)
  events         Json        // ProposedEvent[]
  status         String      @default("pending") // pending | partially_approved | approved | rejected
  createdAt      DateTime    @default(now())
  reviewedAt     DateTime?

  @@index([campaignId, status])
}
```

**Campaign model addition:**
```prisma
worldEventProposals WorldEventProposal[]
```

**GameSession model addition** (required for the back-relation):
```prisma
worldEventProposals WorldEventProposal[]
```

Note: `Session` in the Prisma schema is the NextAuth authentication session model. D&D game sessions use the `GameSession` model — always use `GameSession` for game-domain relations.

**`ProposedEvent` shape** (stored in `events` JSON):

```ts
interface ProposedEvent {
  id: string;               // nanoid for per-event approval tracking
  actorId: string | null;
  description: string;      // narrative text shown to DM
  effects: ProposedEffect[];
  approved: boolean | null; // null = pending
}

type ProposedEffect =
  | { type: 'pressure_shift'; track: 'political'|'supernatural'|'economic'|'cosmic'|'social'; delta: number }
  | { type: 'hook_resolve'; hookId: string; resolution: string }
  | { type: 'hook_create'; hookDescription: string; urgency: 'low'|'medium'|'high'; linkedEntityIds?: string[] }
  | { type: 'entity_status'; entityId: string; newStatus: string }
  | { type: 'relationship_change'; fromEntityId: string; toEntityId: string; strengthDelta: number; newDescription?: string }
```

---

## Change 2 — Upgraded Sim Tick Worker

**File:** `src/lib/queue/world-simulation-worker.ts`

**Parser update:** The existing `parseSimulationResponse` function expects a bare JSON array. Update it to handle the new format `{ "events": [...] }`:

```ts
function parseSimulationResponse(raw: string): ProposedEvent[] {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  const events = Array.isArray(parsed) ? parsed : (parsed.events ?? []);
  // ... validate and map to ProposedEvent[]
}
```

**AI prompt upgrade** (`src/lib/ai/world-simulation-prompts.ts`):

Update `buildWorldSimulationPrompt` to:
1. Sort actors by urgency DESC, resources DESC before including them
2. For each actor: instruct the AI to take a meaningful goal-directed action (high urgency) or opportunistic action (medium urgency) or no action (low urgency)
3. Require structured `effects` array in each event

New response format instruction:
```
Return JSON: { "events": [ { "actorId": "...", "description": "...", "effects": [...] } ] }
```

**Worker changes:**
1. Parse structured response with updated parser
2. Skip tick if a `pending` `WorldEventProposal` already exists for this campaign
3. Write one `WorldEventProposal` record per tick (all events bundled)
4. Do NOT write `WorldSimulationEvent` records here — those are written on approval

**Auto-trigger:** Add to `brain-inference-worker.ts` at the end of the script's `main()` function (before `prisma.$disconnect()`):

```ts
// Queue world simulation tick after inference completes
await worldSimulationQueue.add('tick', { campaignId });
```

Import `worldSimulationQueue` from `brain-ingestion-queue.ts` (or wherever the queue is defined).

---

## Change 3 — Proposal Approval (New tRPC Procedures)

**Namespace:** `brain.worldSimulation.proposals.*` — nested under existing `worldSimulation` sub-router.

```ts
brain.worldSimulation.proposals.list    // { campaignId } → WorldEventProposal[]
brain.worldSimulation.proposals.approve // { proposalId, eventIds: string[] } → commits selected effects
brain.worldSimulation.proposals.reject  // { proposalId } → marks all events rejected
```

All wrapped in `campaignDMProcedure`.

**`approve` logic:**
1. Load proposal, validate campaign membership
2. For each event where `id` is in `eventIds`: mark `approved: true`
3. Execute each approved effect atomically in a `prisma.$transaction`:
   - `pressure_shift` → update `WorldState` pressure fields + write `WorldPressureHistory` (from SP2)
   - `hook_resolve` → update hook in `WorldState.hooks` array, write `WorldStateChange`
   - `hook_create` → append to `WorldState.hooks`, write `WorldStateChange`
   - `entity_status` → update `WorldEntity.status`, write `WorldStateChange`
   - `relationship_change` → update `WorldRelationship.strength`, append to `history`, write `WorldStateChange`
4. Write each approved event as a `WorldSimulationEvent` record (preserves existing session-seed queries)
5. Mark proposal `status: 'approved'` or `'partially_approved'` depending on whether all events were approved

---

## Change 4 — SessionSeedCard Update

**File:** `src/components/brain/session-seed.tsx`

The existing card queries `WorldSimulationEvent` records filtered by `type: 'threshold_trigger'`. Update to show:
- **Pending proposals:** event descriptions from the most recent `pending` `WorldEventProposal` (narrative text only, no effects detail). Shows "N events awaiting review" with "Review Events →" link to Brain Events tab.
- **Recent approved events:** `WorldSimulationEvent` records from the last 3 approved proposals (existing query, no filter change needed since approved events are still written as `WorldSimulationEvent`)

Keep the "Run Tick" manual button.

---

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `WorldEventProposal`; add `worldEventProposals` to `Campaign` and `session` relation |
| `src/lib/queue/world-simulation-worker.ts` | Update `parseSimulationResponse`; write proposal instead of direct events; skip if pending exists |
| `src/lib/ai/world-simulation-prompts.ts` | Upgrade actor prompt with goal-pursuit logic + effects format |
| `src/lib/queue/brain-inference-worker.ts` | Chain world simulation queue job at end of `main()` |
| `src/server/routers/brain.ts` | Add `worldSimulation.proposals.list/approve/reject` |
| `src/server/services/brain.service.ts` | Add proposal approval mutation logic with `$transaction` |
| `src/components/brain/session-seed.tsx` | Show pending proposals + "Review Events" link |

---

## Out of Scope

- Actor recruitment (actors adding new entities to their cause)
- Multi-tick causal chain tracking
- Simulation replay / undo
- Player-facing world events feed
- Retiring `WorldSimulationEvent` (kept for historical records)
