# DM Brain — Integration Design
_2026-03-09_

## Overview

DM Brain is a persistent world-state intelligence layer that absorbs campaign data (sessions, NPCs, homebrew, encounters) and builds a structured causal model of the world. It powers the Autonomous Co-DM (Phase 4) and Autonomous Story Worlds (Phase 6), and surfaces directly to DMs via enriched existing pages, a campaign Brain tab, a Session Cockpit panel, and a global voice interface.

---

## 1. Data Architecture

### New Prisma Models

**`WorldEntity`**
Polymorphic node for any named world actor.

```prisma
model WorldEntity {
  id          String          @id @default(cuid())
  campaignId  String
  type        WorldEntityType
  name        String
  status      String          @default("active")
  data        Json            // stress, loyalty, motivation, fear, secrets, location, etc.
  lastSeenSessionId String?

  // Optional links back to existing records
  npcId       String?
  characterId String?
  homebrewId  String?

  campaign    Campaign        @relation(fields: [campaignId], references: [id])
  npc         Npc?            @relation(fields: [npcId], references: [id])
  character   Character?      @relation(fields: [characterId], references: [id])
  homebrew    HomebrewContent? @relation(fields: [homebrewId], references: [id])

  outgoingRelationships WorldRelationship[] @relation("FromEntity")
  incomingRelationships WorldRelationship[] @relation("ToEntity")
  stateChanges          WorldStateChange[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([campaignId])
  @@index([npcId])
  @@index([homebrewId])
}

enum WorldEntityType {
  NPC
  PC
  FACTION
  LOCATION
  ITEM
  EVENT
  THREAT
  SECRET
  ARC
}
```

**`WorldRelationship`**
Directed edge between two entities.

```prisma
model WorldRelationship {
  id           String       @id @default(cuid())
  fromEntityId String
  toEntityId   String
  type         String       // tense_alliance, rival, ally, member_of, possesses, located_at, etc.
  strength     Float        @default(0.5) // 0.0–1.0
  history      Json         @default("[]") // [{description, sessionId}]

  fromEntity   WorldEntity  @relation("FromEntity", fields: [fromEntityId], references: [id])
  toEntity     WorldEntity  @relation("ToEntity", fields: [toEntityId], references: [id])

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([fromEntityId])
  @@index([toEntityId])
}
```

**`WorldStateChange`**
Append-only audit log — every field change on any entity.

```prisma
model WorldStateChange {
  id          String      @id @default(cuid())
  entityId    String
  field       String
  oldValue    Json?
  newValue    Json
  source      ChangeSource
  sessionId   String?
  triggeredBy String?     // human-readable cause description

  entity      WorldEntity @relation(fields: [entityId], references: [id])
  session     Session?    @relation(fields: [sessionId], references: [id])

  createdAt   DateTime @default(now())

  @@index([entityId])
  @@index([sessionId])
}

enum ChangeSource {
  TRANSCRIPT
  SUMMARY
  ENCOUNTER
  MANUAL
  INFERENCE
}
```

**`WorldState`**
One row per campaign — global world registers.

```prisma
model WorldState {
  id               String   @id @default(cuid())
  campaignId       String   @unique
  factionInfluence Json     @default("{}") // { factionId: score }
  pressureTracks   Json     @default("{}") // { political, supernatural, economic, cosmic, social }
  unresolvedHooks  Json     @default("[]") // [{ id, description, age, urgency }]

  campaign         Campaign @relation(fields: [campaignId], references: [id])

  updatedAt        DateTime @updatedAt
}
```

### Entity Ingestion Strategy

- **NPCs**: On ingestion, Brain creates a `WorldEntity` for each `Npc` in the campaign (if not already linked). `WorldEntity.data` holds live state (stress, loyalty, motivation, etc.). `Npc` remains the canonical display/character-sheet record.
- **PCs**: Seeded as lightweight `WorldEntity` nodes (type `PC`). Used as relationship targets only — no full state tracking. `characterId` FK links back to `Character`.
- **Homebrew**: On save of any `HomebrewContent` with type `MONSTER | FACTION | LOCATION | ITEM`, an entity node is automatically upserted. No DM opt-in required.
- **Extracted from sessions**: Ingestion worker AI-extracts additional entities from transcripts + summaries (factions, locations, threats, events) that don't yet have a source record.

---

## 2. Workers

### `brain-ingestion-worker`

**Trigger:** Fires after `ai-summary-worker` completes for a session.

**Steps:**
1. Load session summary + transcript segments
2. AI extraction prompt — identify entity mentions, relationship changes, state deltas
3. Entity resolution — embedding similarity against existing `WorldEntity` names to collapse aliases
4. Upsert `WorldEntity` rows, write `WorldRelationship` edges
5. Append `WorldStateChange` records for each delta
6. Update `WorldState.unresolvedHooks` (add new hooks, age existing)

### `brain-inference-worker`

**Trigger:** Scheduled — runs once after each session's ingestion completes.

**Steps:**
1. For each active entity — detect loyalty/relationship drift (compare last 3 sessions)
2. For each active threat — project trajectory (linear extrapolation of influence delta)
3. Decay urgency on stale/resolved hooks
4. Update `WorldState.pressureTracks` and `factionInfluence`
5. Write `WorldStateChange` records sourced as `INFERENCE`

---

## 3. tRPC Router: `brain`

```ts
brain.state.get({ campaignId })            // WorldState for campaign
brain.entities.list({ campaignId, search, type? }) // paginated entity list
brain.entities.get({ entityId })           // full entity + relationships + change history
brain.entities.upsert({ ... })             // DM manual create/update
brain.query({ campaignId, query: string }) // natural language → structured response
brain.timeline({ entityId, lastNSessions }) // ordered state changes for an entity
brain.hooks.list({ campaignId })           // unresolved hooks sorted by urgency
brain.seed({ campaignId })                 // trigger backfill ingestion over all past summaries
```

---

## 4. App Integration Points

### Campaign Overview — "Brain" Tab

New tab added to the campaign detail page alongside Sessions, NPCs, Homebrew, Members.

**Contents:**
- Entity graph explorer — nodes filterable by type (NPC, Faction, Location, Item…), clickable to expand entity card with full state
- Faction influence chart — line chart per faction over session history
- Pressure track gauges — 5 tracks (political / supernatural / economic / cosmic / social)
- Unresolved hooks list — sorted by urgency, age shown in sessions
- World state changes feed — recent changes with source + trigger description
- Manual entity creation + field override UI (DM corrections write `ChangeSource.MANUAL`)
- "Seed from history" button — triggers `brain.seed` to backfill all past summaries

### NPC Detail Page — "World State" Section

New collapsible section added below existing NPC fields.

**Contents:**
- Stress gauge (0–1 scale, color-coded)
- Loyalty scores: per-party + per-faction
- Motivation, fear (from Brain data, editable)
- Current location (linked `WorldEntity` of type `LOCATION`)
- Secrets list (DM-visible only)
- Relationship edges — connected entities with type + strength
- State change timeline — collapsible per-session history
- Override button — any field editable, writes `ChangeSource.MANUAL` change record

### Homebrew Content — Automatic Brain Seeding

On `HomebrewContent` save (create or update):
- If type is `MONSTER | FACTION | LOCATION | ITEM` → upsert `WorldEntity` automatically
- Entity `data` pre-populated from homebrew fields (name, description, faction associations)
- No DM action required — Brain node appears in entity graph immediately

### Session Cockpit — Brain Tab (Right Panel)

New tab in the cockpit right panel (alongside existing prep/notes tabs).

**Contents:**
- Active entity cards — NPCs mentioned in current session transcript, surfaced automatically
- Per card: stress gauge, loyalty score, flagged secrets relevant to current context, last known action
- Proactive suggestions — inference-derived nudges: "Temmel's loyalty has drifted 3 sessions — pressure point available"
- Hook alerts — unresolved hooks matching current session context, sorted by urgency
- Entity search — DM can look up any entity by name to get their current state card

---

## 5. Voice Layer

### Architecture

```
Global VoiceProvider (React context — wraps _app)
    ↓
Persistent mic button (app shell toolbar, top-right)
Press-and-hold or toggle activation
    ↓
Web Speech API → transcribed text
    ↓
Intent classifier (Gemini flash — cheap, fast)
    ↓
┌─────────────────┬──────────────────┬─────────────────┐
│  Brain query    │ Cockpit command  │  Prep wizard    │
│  (Phase 5)      │  (Phase 4)       │  (Phase 4)      │
└─────────────────┴──────────────────┴─────────────────┘
    ↓
Response → UI card (toast / panel update) + ElevenLabs TTS
```

### STT / TTS Stack
- **STT:** Web Speech API — browser-native, no API cost, works with existing browser permissions
- **TTS:** ElevenLabs for Brain voice (atmospheric DM Brain persona). Browser `speechSynthesis` as zero-cost fallback.
- **Intent classification:** Single Gemini Flash prompt, <100ms latency acceptable

### Voice Modes

| Mode | Phase | Trigger | Example utterances |
|------|-------|---------|-------------------|
| Brain query | 5 (this) | Any page | "Who knows about the third anchor?", "What's Temmel's loyalty?", "Show me unresolved hooks" |
| Cockpit command | 4 | Cockpit open | "Next initiative turn", "Add 10 damage to Rhea", "Mark Temmel bloodied" |
| Prep wizard | 4 | Prep flow | Brain asks via TTS, DM answers by voice, doc builds conversationally |

**Phase 5 scope:** VoiceProvider infrastructure + Brain query mode only. Cockpit command and prep wizard handlers are Phase 4 work but share the same VoiceProvider.

### VoiceProvider API (React context)

```ts
interface VoiceContextValue {
  isListening: boolean
  transcript: string
  startListening: () => void
  stopListening: () => void
  speak: (text: string) => void  // ElevenLabs or browser TTS
  mode: 'brain' | 'cockpit' | 'prep'
}
```

---

## 6. Bootstrap Strategy

Existing campaigns are not left behind:
1. DM clicks "Seed from history" on Brain tab
2. `brain.seed` queues `brain-ingestion-worker` jobs for all past sessions in chronological order
3. Ingestion runs per-session, building entity graph incrementally
4. DM reviews auto-generated entity list in Brain tab, marks secrets, corrects any alias collapses
5. Brain goes live immediately — no clean-slate requirement

---

## 7. Dependencies

| Dependency | Status |
|-----------|--------|
| Session summaries (`ai-summary-worker`) | ✅ Built |
| Narrative search / embeddings (entity resolution) | ✅ Built |
| Transcript infrastructure | ✅ Built |
| Encounter outcomes | ✅ Built |
| NPC model | ✅ Built |
| Character model | ✅ Built |
| HomebrewContent model | ✅ Built |
| `brain-ingestion-worker` | ❌ New |
| `brain-inference-worker` | ❌ New |
| `brain` tRPC router | ❌ New |
| Brain tab (Campaign Overview) | ❌ New |
| World State section (NPC Detail) | ❌ New |
| Cockpit Brain tab | ❌ New |
| VoiceProvider + Brain query mode | ❌ New |

---

## 8. Unlocks

- **Phase 4 — Autonomous Co-DM**: Cockpit command voice mode + real-time entity inference
- **Phase 6 — Autonomous Story Worlds**: World state registers + pressure tracks as simulation inputs
- **Session Continuity Graph (Backlog)**: Becomes a view over Brain entity graph — no separate implementation needed
