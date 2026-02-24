# Foundry VTT Sidecar Bridge — MVP Spec

**Date:** 2026-02-24
**Status:** `in_mvp_plan`
**Research gate:** pass (see `30-Integration-Candidates/integration-backlog.md`)

---

## Problem

DMs running sessions in Foundry VTT context-switch constantly between Foundry (combat, maps) and
QuiverDM (transcription, recap, NPC notes). There is no live data connection between the two tools.
This means:

- HP/condition changes in Foundry are not reflected in QuiverDM session context.
- Events from Foundry (combat starts, dice rolls, deaths) don't enrich the transcript.
- DMs must manually cross-reference two browser windows.

**Pain signals (3 required to pass research gate):**

1. Creator outreach feedback: "I keep alt-tabbing between Foundry and my notes tool."
2. Usage data: session note pages have 0 Foundry-origin events despite Foundry being the stated VTT.
3. Competitor gap: OwlBear Rodeo has no companion app; Foundry has no native session journal with AI.

---

## Goal (MVP)

Enable a DM running Foundry to open QuiverDM as a persistent companion panel without losing
Foundry focus. In MVP: **link-first, read-mostly**. Foundry sends events to QuiverDM; QuiverDM
displays context. No two-way write-back in MVP.

**Success metric:** At least 3 beta DMs run one full session with the sidecar open and report no
context-switch friction in the post-session survey.

---

## Architecture

### Approach: Foundry Module + QuiverDM Webhook Receiver

```
Foundry VTT (localhost or hosted)
  └─ foundry-quiverdm module (JS)
       ├─ Hooks.on("combatRound", ...)
       ├─ Hooks.on("updateActor", ...)    ← HP changes
       ├─ Hooks.on("createChatMessage", ...) ← rolls, OOC chat
       └─ POST /api/foundry/events  (QuiverDM webhook endpoint)
                                │
                         ─────────────────
                        │  QuiverDM API   │
                         ─────────────────
                                │
                         session context  ← annotates transcript
                         SSE stream       ← pushes events to UI
```

### Opening the sidecar

- Primary: **"Open QuiverDM" button** in Foundry module sidebar → `window.open(url, '_blank')`.
  No iframe — Foundry is loaded in the main window; QuiverDM opens as a new tab/popout.
- Optional (v2): Foundry popout module wraps QuiverDM in a docked Foundry window.
- Optional (v3): iframe embed inside Foundry application frame (CSP + auth challenges, defer).

---

## MVP Scope

### In scope

| # | Feature | Notes |
|---|---------|-------|
| 1 | Foundry module scaffold | Module manifest, `module.js` entry, settings registration |
| 2 | Campaign link config | DM enters QuiverDM campaign slug + API key in module settings |
| 3 | Combat round events | `Hooks.on("combatRound")` → POST to QuiverDM |
| 4 | HP change events | `Hooks.on("updateActor")` delta for HP only |
| 5 | QuiverDM event ingestion API | `POST /api/foundry/events` → validates key, writes to DB |
| 6 | Session event log | New `FoundryEvent` model; stored per session |
| 7 | Live event panel in QuiverDM UI | SSE subscription in session page; event feed sidebar |
| 8 | "Open sidecar" button | In Foundry module sidebar — opens QuiverDM session URL |

### Out of scope (MVP)

- Write-back from QuiverDM → Foundry (conditions, notes)
- Dice roll enrichment (too noisy in MVP)
- Foundry hosted (fvtt.com) support (CSP restrictions — research needed)
- Mobile sidecar
- Two-player co-DM sync

---

## Data Model

### New Prisma model: `FoundryEvent`

```prisma
model FoundryEvent {
  id          String   @id @default(cuid())
  sessionId   String
  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  campaignId  String
  type        String   // "combat_round" | "hp_change" | "actor_death" | "combat_start" | "combat_end"
  payload     Json
  foundryTimestamp DateTime?
  createdAt   DateTime @default(now())

  @@index([sessionId])
  @@index([campaignId, createdAt])
}
```

### Foundry API key: stored in `Campaign.foundryApiKey` (add field)

```prisma
// Add to Campaign model:
foundryApiKey   String?  @unique
foundryModuleVersion String?
```

---

## API Routes

### `POST /api/foundry/events`

**Auth:** `Authorization: Bearer <foundryApiKey>` (campaign-scoped key, not user session).

**Request body:**

```ts
{
  type: "combat_round" | "hp_change" | "actor_death" | "combat_start" | "combat_end",
  sessionId?: string,  // if known; else inferred from active session
  payload: {
    // combat_round
    round?: number,
    combatId?: string,
    // hp_change
    actorId?: string,
    actorName?: string,
    hpBefore?: number,
    hpAfter?: number,
    delta?: number,
    // actor_death
    actorName?: string,
    actorType?: "character" | "npc",
  },
  foundryTimestamp: string, // ISO 8601
}
```

**Response:** `{ ok: true, eventId: string }`

**Rate limit:** 60 events/minute per campaign (prevent runaway hooks).

### `GET /api/foundry/session-url?campaignSlug={slug}`

Returns the active session URL for the campaign (used by the Foundry module to open the sidecar).

**Auth:** `Authorization: Bearer <foundryApiKey>`

**Response:** `{ sessionUrl: string | null, sessionId: string | null }`

### tRPC: `foundry.getEvents`

```ts
// Procedure: campaignMemberProcedure
// Input: { sessionId: string, cursor?: string, limit?: number }
// Returns: FoundryEvent[] with pagination
```

### tRPC: `foundry.generateApiKey`

```ts
// Procedure: campaignDMProcedure
// Generates and stores a new foundryApiKey for the campaign
// Returns: { apiKey: string }
```

---

## Foundry Module

### Directory structure

```
foundry-quiverdm/
  module.json           ← Foundry manifest
  module.js             ← compiled entry
  src/
    index.js            ← hook registrations + settings
    api-client.js       ← POST to QuiverDM /api/foundry/events
    sidecar.js          ← window.open() logic
  README.md
```

### Module manifest (`module.json`)

```json
{
  "id": "quiverdm",
  "title": "QuiverDM Companion",
  "version": "0.1.0",
  "compatibility": { "minimum": "11", "verified": "12" },
  "esmodules": ["module.js"],
  "url": "https://github.com/yourorg/foundry-quiverdm"
}
```

### Key hooks

```js
// Combat round change
Hooks.on("combatRound", (combat, updateData) => {
  client.sendEvent({ type: "combat_round", payload: { round: combat.round, combatId: combat.id } });
});

// HP change
Hooks.on("updateActor", (actor, changes) => {
  if (changes?.system?.attributes?.hp) {
    const hpBefore = actor.system.attributes.hp.value;
    const hpAfter = changes.system.attributes.hp.value;
    client.sendEvent({ type: "hp_change", payload: { actorId: actor.id, actorName: actor.name, hpBefore, hpAfter, delta: hpAfter - hpBefore } });
  }
});
```

---

## QuiverDM UI

### Session page sidebar panel: "Foundry Events"

- SSE connection: `GET /api/sessions/{id}/foundry-stream`
- Renders event feed: "⚔️ Combat Round 3 started", "❤️ Garrek: 45 → 28 HP"
- Empty state: "Connect Foundry VTT to see live combat events here."
- Link to campaign settings to copy API key

### Campaign settings page: "Foundry Integration" section

- Shows generated API key (obfuscated, with copy button + regenerate)
- Shows `moduleId` and setup instructions link
- Shows last event timestamp (heartbeat indicator)

---

## Security

1. `foundryApiKey` is campaign-scoped — compromise exposes one campaign only.
2. Key stored hashed in DB (bcrypt); raw key shown once on generate.
3. Rate limit: 60 events/min per campaign; 429 on breach.
4. All event payloads sanitized (max 4 KB JSON); reject oversized.
5. CORS: `/api/foundry/*` allows `*` origin (Foundry runs on arbitrary localhost ports).

---

## Build sequence

1. **Prisma schema** — Add `FoundryEvent`, `Campaign.foundryApiKey`
2. **API route** — `POST /api/foundry/events`, `GET /api/foundry/session-url`
3. **tRPC router** — `foundry` router with `generateApiKey`, `getEvents`
4. **SSE endpoint** — `GET /api/sessions/[id]/foundry-stream`
5. **UI** — Campaign settings panel + session event feed
6. **Foundry module** — Scaffold in separate `foundry-module/` directory, publish separately

---

## Rollout guardrails

- Feature flag: `FOUNDRY_BRIDGE_ENABLED=true` (env var, off by default)
- Beta DM opt-in only — not shown in UI unless flag is set
- Monitor: event ingestion rate, DB row growth, SSE connection count
- Kill switch: set flag to false to disable all Foundry event ingestion

---

## Open questions

1. Should `foundryApiKey` use bcrypt or store plaintext with encryption at rest? (Prefer
   single-show pattern: hash in DB, show raw once.)
2. If DM is not in an active session, do we buffer events or drop them? (MVP: drop — sessions
   must be started in QuiverDM first.)
3. Foundry hosted (fvtt.com) blocks cross-origin POSTs — do we need a proxy? (Defer to v2.)
