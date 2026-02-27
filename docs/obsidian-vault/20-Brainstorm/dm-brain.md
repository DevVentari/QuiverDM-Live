# Phase 5 — DM Brain
> Persistent World-State Intelligence Layer

DM Brain is the load-bearing layer between Co-DM (Phase 4) and Autonomous Story Worlds (Phase 6). It is not a feature — it is the memory and reasoning substrate that makes both possible.

Every observation the Co-DM makes gets written here. Every simulation tick in Phase 6 reads from here. It is the campaign's living model of reality.

## What DM Brain Is Not
- Not a chat assistant
- Not a search index (MeiliSearch already handles that)
- Not a session summary (F1 already handles that)

It is a **structured causal world model** — entities, relationships, states, and the history of how they changed.

## Core Data Model

### Entity Graph
Every named thing in the campaign is a node:

```
NPC ─── Location ─── Faction
 │                      │
 └──── Event ───────────┘
         │
       Session
```

Node types: NPC, PC, Faction, Location, Item, Event, Session, Arc, Threat, Secret

### Entity Schema (NPC example)
```json
{
  "id": "npc_temmel",
  "name": "Temmel",
  "type": "NPC",
  "status": "alive",
  "location": "loc_bonfire_keep",
  "faction": ["faction_anchor_flame"],
  "motivation": "Understand the Anchors before the next breach",
  "fear": "Losing control of the ritual",
  "loyalty": { "players": 0.7, "faction": 0.4 },
  "secrets": ["knows_location_of_third_anchor", "partially_corrupted"],
  "stress": 0.61,
  "last_seen": "session_12",
  "last_known_action": "Researching forbidden lore in keep basement",
  "relationship_delta": []
}
```

### Relationship Edges
```json
{
  "from": "npc_temmel",
  "to": "npc_rhea",
  "type": "tense_alliance",
  "strength": 0.3,
  "history": ["trusted — session 8", "betrayal suspected — session 11"]
}
```

### World State Registers
Global tracked values:
- Faction influence scores
- Regional stability indices
- Pressure tracks (political, supernatural, economic, cosmic, social)
- Active threats with urgency + trajectory
- Unresolved hooks with age

## 1. Ingestion Pipeline

DM Brain grows from existing data sources:

| Source | What It Provides |
|--------|-----------------|
| Session transcripts (live + post) | NPC mentions, implied events, tone signals |
| AI session summaries (F1) | Structured narrative deltas |
| Encounter outcomes (F3) | Combat results, NPC survival/death |
| Homebrew entities (F7 rules) | Faction/lore entities to pre-seed graph |
| DM manual input | Explicit overrides, secrets, world facts |

Extraction runs as a background job after each session. No DM effort required.

## 2. Entity Resolution

Multiple mentions → single node.

"Captain Rhea", "Guard Captain Rhea", "the captain" all resolve to `npc_rhea`.

Uses: embedding similarity + name normalization + session context. Builds on F2 narrative search infrastructure.

## 3. State Change Tracking

Every entity state change is versioned:

```
npc_temmel.stress: 0.3 → 0.61
  source: session_13_transcript
  trigger: "failed containment ritual"
  session: 13
```

Full causal history. Co-DM can surface "Temmel's stress has been rising since session 11."

## 4. Inference Layer

Beyond raw facts — DM Brain draws conclusions.

**Relationship inference:** Temmel helped the players in sessions 8-10, then went silent → loyalty drift detected.

**Threat projection:** Cult influence rising 0.12/session for 4 sessions → will reach critical threshold in ~2 sessions.

**Hook decay:** "Missing envoy" hook unresolved for 3 sessions → urgency escalating.

These inferences feed Phase 4 Co-DM suggestions and Phase 6 simulation ticks.

## 5. Query Interface

Internal API consumed by Co-DM and Story Worlds engine:

```
brain.query("who knows about the third anchor?")
→ [npc_temmel (secret), npc_rhea (partial), faction_cult (goal)]

brain.state("faction_cult.influence")
→ { value: 0.74, trajectory: "rising", delta_per_session: 0.12 }

brain.timeline("loc_bonfire_keep", last=5_sessions)
→ [events ordered by session]

brain.unresolved_hooks()
→ [{ hook: "missing_envoy", age: 3, urgency: 0.6 }, ...]
```

## 6. DM-Facing Surface

DM Brain is mostly invisible — it powers other features. But it has one direct UI:

**World State Panel** (accessible from campaign dashboard):
- Entity graph explorer (nodes + edges, filterable by type)
- Faction influence chart over time
- Pressure track gauges
- Unresolved hooks list with age + urgency
- Recent state changes feed

Not a primary play UI — a campaign health monitor.

## 7. Architecture

```
Session transcripts + summaries
        ↓
Ingestion Worker (background job)
        ↓
Entity Extractor + Resolver
        ↓
State Change Writer
        ↓
Entity Graph (Postgres — jsonb + relations)
        ↓
Inference Engine (scheduled, post-session)
        ↓
Query API
        ↓
Co-DM (Phase 4)  +  Story Worlds (Phase 6)
```

### Storage
- Entity nodes + edges: Postgres (new `WorldEntity`, `WorldRelationship`, `WorldStateChange` models)
- Pressure tracks + registers: Postgres (new `WorldState` model, per-campaign)
- Semantic search over entities: F2 embedding infrastructure (already built)

### Workers
- `brain-ingestion-worker` — runs after each session, extracts entities from summary + transcript
- `brain-inference-worker` — runs on schedule, projects threat trajectories, decays old hooks

## 8. Bootstrap Strategy

DM Brain doesn't require fresh campaigns. It can backfill:

1. Run ingestion over all historical session summaries
2. DM reviews auto-generated entity list, marks secrets
3. Brain is live-seeded from day one for existing campaigns

## Dependencies
- Session Summaries (F1) — primary ingestion source ✅
- Narrative Search / Embeddings (F2) — entity resolution similarity ✅
- Transcript infrastructure — raw signal source ✅
- Encounter Builder (F3) — combat outcome feeds ✅

## Unlocks
- Phase 4 — Autonomous Co-DM (needs entity state + inference API)
- Phase 6 — Autonomous Story Worlds (needs world state registers + pressure tracks)
- Session Continuity Graph (Backlog) — becomes a view over DM Brain data
