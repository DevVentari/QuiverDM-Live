# Foundry VTT Import API Research

Date: 2026-02-24
Status: research_gate=pending (to be reviewed by product)

## 1. REST API options

### Native Foundry REST API
- No official, documented, general-purpose REST API for world document CRUD was found in Foundry's official API docs.
- Foundry's documented automation surface is primarily in-process JavaScript APIs (`Actor.create`, `Item.create`, etc.) plus internal socket plumbing (`SocketInterface`), not public HTTP routes.
- Inference: external-to-Foundry import requires either a third-party API module, a custom module bridge, or manual script execution.

### Community API modules

1. `fvtt-rest-api` (repo: `docwilco/foundryvtt-rest-api`)
- Endpoints: documented REST document endpoints (create/read/update/delete) and auth middleware.
- Auth: API key in `x-api-key` header.
- Maintenance signal: package listing available; ecosystem appears to have fork/relay variants, suggesting original maintenance fragmentation risk.

2. `foundry-rest-api-relay` (repo: `Pryaxis/foundry-rest-api-relay`)
- Endpoints (README examples):
  - `GET /api/modules/fvtt-rest-api/health`
  - `GET /api/modules/fvtt-rest-api/documents/:type`
  - `POST /api/modules/fvtt-rest-api/documents/:type`
  - `PUT /api/modules/fvtt-rest-api/documents/:type/:id`
  - `DELETE /api/modules/fvtt-rest-api/documents/:type/:id`
- Auth: API key (`x-api-key`) generated in module settings.
- Maintenance signal: appears usable for local module relay pattern; should be treated as third-party dependency risk.

3. Planeshift API (repo: `planeshift/foundryvtt-api`)
- Endpoints: broad API surface with OpenAPI/Swagger docs and operations across worlds/sessions.
- Auth: JWT auth flow.
- Maintenance signal: active docs + npm package path + recent release metadata in project docs; strongest maintenance posture among reviewed API-first options.

### Can a Foundry module run its own HTTP server?
- Foundry runs on Node.js, but module/client code is not documented as a supported place to bind an arbitrary Express server port.
- Supported cross-context transport in Foundry docs is socket-based (`game.socket`/`SocketInterface`) and document APIs.
- Practical implication: for reliability and supportability, prefer either:
  - an existing REST module, or
  - module-managed socket/RPC pattern (module receives authenticated command and performs document creation in-process),
  rather than custom ad-hoc HTTP servers inside module code.

## 2. Document creation APIs

### Core create/update APIs (v11/v12 compatible pattern)
- Create single/multiple documents:
  - `await Actor.create(data)` / `await Actor.createDocuments([data...])`
  - `await JournalEntry.create(data)`
  - `await Item.create(data)`
  - `await Scene.create(data)`
- Lookup-before-create (dedupe):
  - `game.actors.getName(name)` for exact-name lookup
  - or `game.actors.find(a => normalize(a.name) === normalize(name))`
- Update existing:
  - `await actor.update(partialData)` for one actor
  - `await Actor.updateDocuments([{ _id, ...patch }])` for bulk

### Permissions/flags to create from a module
- Module code executes with the current user's privileges.
- The active user must have rights to create/update target document types (typically GM role in default worlds).
- Inference: production-safe import path should route privileged writes through GM context (socket request handled by GM user session), plus module-level auth checks.

### Minimal creation shapes (Foundry-level)

```json
{
  "name": "Goblin Scout",
  "type": "npc",
  "img": "icons/svg/mystery-man.svg",
  "system": {}
}
```

```json
{
  "name": "Session 12 Recap",
  "pages": [
    {
      "name": "Recap",
      "type": "text",
      "text": { "format": 1, "content": "<p>Summary...</p>" }
    }
  ]
}
```

```json
{
  "name": "Frostbrand",
  "type": "weapon",
  "system": {}
}
```

```json
{
  "name": "Cragmaw Hideout",
  "background": { "src": "worlds/myworld/maps/cragmaw.webp" },
  "width": 4000,
  "height": 3000,
  "grid": { "size": 100 }
}
```

## 3. D&D 5e data schemas

### dnd5e actor minimal system objects

Inference from dnd5e schema/templates and common importer behavior:

1. NPC actor (`type: "npc"`) minimal practical payload
```json
{
  "name": "Goblin",
  "type": "npc",
  "img": "icons/svg/mystery-man.svg",
  "system": {
    "attributes": {
      "ac": { "value": 15 },
      "hp": { "value": 7, "max": 7 }
    },
    "abilities": {
      "str": { "value": 8 },
      "dex": { "value": 14 },
      "con": { "value": 10 },
      "int": { "value": 10 },
      "wis": { "value": 8 },
      "cha": { "value": 8 }
    },
    "details": {
      "cr": 0.25,
      "type": { "value": "humanoid" }
    }
  }
}
```

2. Character actor (`type: "character"`) minimal practical payload
```json
{
  "name": "Aria",
  "type": "character",
  "img": "icons/svg/mystery-man.svg",
  "system": {
    "attributes": {
      "ac": { "value": 14 },
      "hp": { "value": 12, "max": 12 }
    },
    "abilities": {
      "str": { "value": 10 },
      "dex": { "value": 16 },
      "con": { "value": 12 },
      "int": { "value": 13 },
      "wis": { "value": 11 },
      "cha": { "value": 14 }
    },
    "details": {
      "level": 3,
      "race": "Elf",
      "background": "Criminal"
    }
  }
}
```

### Field mapping targets requested
- HP: `system.attributes.hp.value`, `system.attributes.hp.max`
- AC: `system.attributes.ac.value`
- Ability scores: `system.abilities.{str|dex|con|int|wis|cha}.value`
- CR (NPC): `system.details.cr`

### Journal Entry page types
- Supported page types include text, image, PDF, and video/media pages (documented in Foundry knowledge base and reflected in page schema concepts).
- Text page shape:

```json
{
  "name": "NPC Lore",
  "type": "text",
  "text": {
    "format": 1,
    "content": "<p>Secret ties to the Zhentarim...</p>"
  }
}
```

### Item types and minimal practical schemas
- Weapon (`type: "weapon"`), spell (`type: "spell"`), feat (`type: "feat"`), equipment (`type: "equipment"`) are valid 5e item types.
- Minimal practical import payload (schema defaults fill rest):

```json
{
  "name": "Shadow Dagger",
  "type": "weapon",
  "system": {
    "description": { "value": "<p>Homebrew weapon.</p>" }
  }
}
```

```json
{
  "name": "Veil Step",
  "type": "spell",
  "system": {
    "level": 2,
    "school": "con",
    "description": { "value": "<p>Teleport 30 ft.</p>" }
  }
}
```

## 4. Import module patterns

### D&D Beyond Importer (MrPrimate)
- Pattern: authenticate source account, then import/update Foundry actors/items/spells in bulk.
- Includes update-vs-create controls and backup/version compatibility guidance.
- Pitfall surfaced by docs: strict module/system/foundry compatibility matrix; version mismatch causes breakage.

### Plutonium (5etools ecosystem)
- Pattern: large compendium-driven bulk imports (actors/items/spells/adventures), with heavy normalization into Foundry document structures.
- Pitfall: frequent upstream data/system changes require ongoing adapter maintenance.

### Monk's Active Tile Triggers (comparison)
- Primarily event/automation logic inside Foundry, not external HTTP ingestion.
- Relevant pattern: robust in-world trigger/action pipelines are easier than external push architecture; external ingest still needs separate auth/transport layer.

### Cross-module pitfalls observed
- Foundry major version upgrades (v11->v12->v13) break module APIs.
- dnd5e system schema changes break import mappings.
- Duplicate detection quality (name-only collisions).
- Permissions/user-role assumptions (imports fail for non-GM contexts).

## 5. Authentication

### If using community REST API module
- Common patterns seen:
  - static API key header (`x-api-key`)
  - JWT bearer token
- Security concerns:
  - key leakage risk if DM hosts world over public URL without TLS/reverse proxy hardening
  - third-party module auth implementation quality varies

### If QuiverDM module handles import commands
- Recommended: keep `foundryApiKey` campaign/world scoped and rotateable (same pattern as sidecar bridge).
- Validate signature or HMAC on each request payload.
- Execute writes only in GM context after auth check.
- Add nonce/timestamp replay protection.

### Can this work without Foundry running?
- Not for direct-to-world writes.
- Foundry (or a persistent hosted instance) must be running and module active to receive commands and create documents.
- Workaround pattern: queue exports in QuiverDM, apply when DM reconnects/runs sync.

## 6. Data mapping table

| QuiverDM data | Foundry entity | Feasibility | Notes |
|---|---|---|---|
| NPC record (name, description) | Actor (NPC type) | easy | Straightforward `Actor.create` with `type: "npc"`; map description to biography/details and fill schema defaults. |
| Player character | Actor (character type) | medium | Requires stronger schema mapping (class/level/proficiency/resources/inventory) and duplicate matching by player + character name. |
| Session recap | JournalEntry (text page) | easy | `JournalEntry.create` with text page content HTML. |
| NPC lore note | JournalEntry (text page) | easy | Same as recap, can link via flags/UUID to NPC actor. |
| Homebrew item | Item | medium | `Item.create` simple for basic records; advanced effects/activities/roll data raise complexity. |
| Homebrew spell | Item (spell type) | medium | Need spell-specific fields (level/school/components/damage/save) for usable sheets. |
| Campaign map upload | Scene | medium | Create scene metadata easily; alignment/grid/walls/lighting require manual tuning or additional tooling. |
| Session transcript excerpt | JournalEntry | easy | Append transcript pages/sections; can chunk by timestamp/speaker. |

## 7. Recommended architecture

Recommended: **Option B — extend QuiverDM Foundry module**

Why:
1. Better long-term control than relying on third-party REST module maintenance.
2. Reuses planned sidecar module install path (single module experience for DMs).
3. Lets us implement auth and import semantics tailored to QuiverDM data model (idempotency keys, dedupe strategy, conflict policy).
4. Avoids direct dependency on externally maintained HTTP schemas that may drift.

Implementation shape (research-based):
- QuiverDM cloud -> authenticated command payload -> Foundry module bridge.
- Module verifies key/signature, then performs in-process Foundry document writes via official APIs.
- Start with idempotent creates/updates for Actors + JournalEntries, then Items, then Scenes.
- Add import queue/retry UX for cases where no active Foundry runtime is available.

## Sources

Checked on 2026-02-24:
- Foundry API reference index: https://foundryvtt.com/api/
- Foundry `Actor` API: https://foundryvtt.com/api/classes/foundry.documents.Actor.html
- Foundry `JournalEntry` API: https://foundryvtt.com/api/classes/foundry.documents.JournalEntry.html
- Foundry `JournalEntryPage` API: https://foundryvtt.com/api/classes/foundry.documents.JournalEntryPage.html
- Foundry `Scene` API: https://foundryvtt.com/api/classes/foundry.documents.Scene.html
- Foundry `SocketInterface` API: https://foundryvtt.com/api/classes/foundry.helpers.SocketInterface.html
- Foundry users/roles KB: https://foundryvtt.com/article/users/
- Foundry journal entries KB (page types): https://foundryvtt.com/article/journal/
- Foundry package: D&D Beyond Importer: https://foundryvtt.com/packages/ddb-importer
- DDB Importer docs (compatibility/import workflow): https://docs.ddb.mrprimate.co.uk/
- dnd5e system repository: https://github.com/foundryvtt/dnd5e
- dnd5e template JSON (schema defaults): https://raw.githubusercontent.com/foundryvtt/dnd5e/master/template.json
- `fvtt-rest-api` package listing: https://foundryvtt.com/packages/fvtt-rest-api/
- `foundry-rest-api-relay` repo: https://github.com/Pryaxis/foundry-rest-api-relay
- Planeshift Foundry API repo: https://github.com/planeshift/foundryvtt-api
- Planeshift docs: https://docs.planeshift.top/
- Plutonium package listing: https://foundryvtt.com/packages/plutonium

## Research Gate Verdict
- Result: pass
- Reason: Viable import path exists via module-mediated document APIs; clear MVP scope for Actors + JournalEntries with manageable auth model.
- Next action: Product/engineering spike to validate Option B with a minimal "import NPC + recap journal" end-to-end proof in Foundry v12 + dnd5e current stable.