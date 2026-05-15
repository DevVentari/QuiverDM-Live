# Session 0 Auto-Create — Design

**Date:** 2026-05-15
**Status:** Approved

## Overview

When a DM creates a campaign seeded from a D&D Beyond sourcebook, QuiverDM automatically creates a Session 0 `GameSession` record and asynchronously populates its `prepData` using Claude. The campaign home page shows a hero card directing the DM to their ready-to-review prep.

## User Flow

1. DM creates campaign, selects a sourcebook (e.g. Curse of Strahd)
2. Campaign creation completes instantly — user is redirected to campaign home
3. Session 0 record exists immediately with `prepStatus: 'draft'`
4. Hero card is visible on campaign home with a shimmer loading state
5. BullMQ worker runs in background (~5–15s), populates `prepData`, sets `prepStatus: 'complete'`
6. Hero card refreshes (polling or tRPC invalidation), shows "Review Session 0 Prep →" CTA
7. Once DM creates Session 1, hero card disappears permanently

## Architecture

### 1. Campaign creation trigger

In `src/server/routers/campaigns.ts`, the `create` mutation currently calls `seedFromWorldSourcebook` when a sourcebook is selected. After that call succeeds, add:

```ts
const session0 = await sessionService.createPrepSession({
  campaignId: campaign.id,
  userId: ctx.session.user.id,
  title: 'Session 0',
  sessionNumber: 0,
});

await session0AiPrepQueue.add('generate', {
  sessionId: session0.id,
  sourcebookId: sourcebook.id,
  campaignTitle: campaign.title,
});
```

### 2. BullMQ queue + worker

**Queue:** `session0-ai-prep` (new, follows `quiverdm-worker` skill pattern)

**Worker:** `src/lib/queue/workers/session0-prep.worker.ts`

Job payload:
```ts
{ sessionId: string; sourcebookId: string; campaignTitle: string }
```

Worker logic:
1. Query `SourcebookEntity` for the sourcebook — fetch up to 15 entities, prioritising `NPC`, `LOCATION`, `ARC`, `EVENT` types, ordered by `createdAt ASC` (intro entities first)
2. Build a structured prompt with entity summaries
3. Call `chatWithAI(messages, { forceProvider: 'claude' })` — falls back to openai/groq via standard chain
4. Parse response as `Partial<SessionPrepData>`
5. Update session: `prepData = result`, `prepStatus = 'complete'`
6. On failure: set `prepStatus = 'draft'` (stays shimmer — DM can fill manually), log error

**prepData fields populated:**
- `strongStart` — narrative opening hook for the DM to read/adapt
- `scenes` — 2–3 opening scenes (location, description, possible outcomes)
- `npcs` — 2–3 key intro NPCs with brief DM-facing description
- `secretsAndClues` — 1–2 secrets the DM should know before Session 0

All other fields (`monsters`, `rewards`, `looseThreads`, etc.) left empty.

**Fallback (no entities):** Worker detects `entities.length === 0`, writes a minimal template:
```ts
{
  strongStart: `Welcome to ${campaignTitle}. Add your opening scene here.`,
  scenes: [], npcs: [], secretsAndClues: []
}
```
Sets `prepStatus: 'complete'` so the shimmer resolves.

### 3. Hero card component

**File:** `src/components/campaign/Session0HeroCard.tsx`

**Shown when:** `totalSessionCount === 1` (only Session 0 exists) — checked via a tRPC query on the campaign home.

**States:**
- `prepStatus === 'draft'` — shimmer skeleton with "Preparing your Session 0..." subtitle
- `prepStatus === 'complete'` — full card with CTA
- Dismissed (sessionStorage flag) — hidden until page reload, never permanently dismissed

**Visual:** Centred glass card (backdrop-blur, `oklch(0.17 0.02 265 / 0.85)` background, amber border glow). Matches design system — Cinzel display font for campaign title, amber primary CTA button.

**Card content (complete state):**
```
🕯️  [small glyph]
YOUR CAMPAIGN HAS BEEN CREATED   [overline label, Cinzel]
Curse of Strahd                  [display title]
────────────────────────────────
Session 0 is ready — we've drafted an opening prep from
the sourcebook. Review it, adjust it, then invite your players.

[Review Session 0 Prep →]   [Skip for now]

Seeded from Curse of Strahd · Disappears after first session
```

**Polling:** While `prepStatus === 'draft'`, poll `sessions.getById` every 3s (tRPC query with `refetchInterval`). Stop polling on `complete` or after 60s timeout.

### 4. Campaign home page integration

In the campaign home page (campaign `[slug]` route), check session count:

```tsx
const hasSessions = sessions.filter(s => s.sessionNumber > 0).length > 0;
const session0 = sessions.find(s => s.sessionNumber === 0);

{!hasSessions && session0 && <Session0HeroCard session={session0} />}
```

The card renders above the existing home page content — not replacing it.

## Data Model

No schema changes required. Uses existing:
- `GameSession` — `sessionNumber: 0`, `title: 'Session 0'`, `status: 'planning'`, `prepStatus: 'draft' | 'complete'`, `prepData: Json`
- `SourcebookEntity` — queried by `sourcebookId`, filtered by type

## Error Handling

- Worker failure → `prepStatus` stays `'draft'`, hero card shows shimmer indefinitely. DM can open prep and fill manually. No user-visible error (graceful degradation).
- No sourcebook entities → fallback template, `prepStatus: 'complete'`.
- Campaign created without sourcebook → no Session 0 created, no hero card shown.

## Out of Scope

- Regenerating Session 0 prep after it's been edited
- Session 0 for campaigns created without a sourcebook
- Permanent hero card dismissal (sessionStorage only — card reappears on refresh until Session 1 exists)
- Surfacing AI generation errors to the DM
