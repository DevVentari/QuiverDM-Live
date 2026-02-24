# Foundry VTT Import API Research

Date: 2026-02-24
Status: research_gate=pending (to be reviewed by product)

---

## 1. REST API Options

### Does Foundry VTT have a native REST API?

No. Foundry VTT is an Electron-based local application (or self-hosted Node.js server). It
has no built-in external REST API. All data manipulation happens through its JavaScript API
inside the running Electron/browser context, or via community modules that expose HTTP
endpoints from within a running world.

### Community modules that expose HTTP endpoints

#### A. `foundryvtt-rest-api` (ThreeHats)

- **GitHub:** https://github.com/ThreeHats/foundryvtt-rest-api
- **Foundry package:** https://foundryvtt.com/packages/foundry-rest-api
- **Architecture:** WebSocket relay model. The Foundry module connects to a relay server
  (publicly hosted at `https://foundryvtt-rest-api-relay.fly.dev` or self-hostable). External
  apps call the relay server via REST; the relay forwards operations to the Foundry module via
  WebSocket. This avoids direct HTTP port exposure from Foundry.
- **Auth:** `x-api-key` header on every request to the relay. All non-`/clients` endpoints
  also require a `clientId` query parameter identifying which connected Foundry instance to
  target.
- **Endpoints:** Documented via a downloadable Postman collection
  (`Foundry REST API Documentation.postman_collection.json`). Full endpoint list not published
  in plain wiki — requires importing the collection. Based on module description, supports
  general-purpose CRUD on Foundry documents (actors, items, journal entries).
- **Maintenance:** Actively maintained as of 2024. Listed on official Foundry package portal.
- **Assessment:** Most viable community option. Relay architecture is a dependency (relay
  server must be running and reachable), and adds latency. Self-hosting the relay is possible
  but adds ops burden.

#### B. `fvtt-module-api` (kakaroto)

- **GitHub:** https://github.com/kakaroto/fvtt-module-api
- **Foundry package:** https://foundryvtt.com/packages/api
- **Architecture:** Exposes a single HTTP endpoint `/modules/api/api.html` at Foundry's own
  port. Accepts `name` (API function) + `arg0`–`arg9` (JSON-encoded arguments). Essentially a
  passthrough to the Foundry JavaScript API.
- **Auth:** No built-in authentication described. Proof-of-concept quality.
- **Endpoints:** Any Foundry API function by name (e.g., `Actor.create`, `game.actors.get`).
- **Maintenance:** Last release June 2023. README states "still a proof of concept." **Not
  recommended for production use.**
- **Assessment:** Not suitable. No auth, no active maintenance.

#### C. `planeshift` (cclloyd)

- **GitHub:** https://github.com/cclloyd/planeshift
- **Architecture:** REST API layer that connects to a running Foundry instance. Runs as a
  separate service, requires a dedicated Foundry player account (`APIUser`) to operate.
- **Auth:** Discord OAuth, generic OIDC, or API keys. Can be run with no auth (not recommended).
- **Endpoints:** All endpoints under `/api`. Exposes an `evaluate` endpoint that passes
  arbitrary expressions to Foundry, plus entity-specific routes. Exact endpoint list not
  published in README — extensible via plugins.
- **Maintenance:** Active (37+ commits, CI configured), though exact last-updated date unclear.
- **Assessment:** More complete auth story than kakaroto, but depends on Foundry account
  credential management and a separate process. Complexity is higher than ThreeHats approach.

### Can a Foundry module run its own HTTP server?

Yes, in principle — Foundry runs on Node.js and modules can `require()` or `import` Node.js
built-ins. A module could start an `express` or `http.createServer` listener on a spare port.
However:
- Foundry v12+ restricts some Node.js globals inside module scripts (sandboxing is partial).
- The approach is not officially supported and could break across Foundry versions.
- More reliable: use Foundry's built-in socket system (`game.socket.emit/on`) for
  module-to-module IPC, and expose HTTP via the relay pattern (see ThreeHats) rather than
  directly.

**Our existing sidecar module** (QuiverDM Companion, `module.json` id: `quiverdm`) already
uses outbound HTTP (POSTing events to QuiverDM). Adding inbound HTTP is the natural extension
for write-back — see Section 7.

---

## 2. Document Creation APIs (Foundry v11/v12)

All calls below execute inside a Foundry module or macro (browser/Electron JS context).

### `Actor.create(data, options?)`

```js
// Check for existing actor first (avoid duplicates)
const existing = game.actors.find(a => a.name === "Goblin Chief");
if (!existing) {
  await Actor.create({
    name: "Goblin Chief",
    type: "npc",           // "character" | "npc" | "vehicle" | "group"
    img: "icons/svg/mystery-man.svg",
    system: { /* see Section 3 */ }
  });
}
```

### `JournalEntry.create(data)` — v10+ (pages model)

Since Foundry v10, journal entries contain a `pages` array of `JournalEntryPage` documents.

```js
await JournalEntry.create({
  name: "Session 12 Recap",
  pages: [{
    name: "Summary",
    type: "text",          // "text" | "image" | "pdf" | "video"
    text: {
      content: "<p>The party descended into the dungeon...</p>",
      format: 1           // CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML = 1
    }
  }]
});
```

### `Item.create(data)` — weapon and spell examples (see Section 3)

### Updating existing documents

```js
// Find and update an actor
const actor = game.actors.getName("Goblin Chief");
await actor.update({ "system.attributes.hp.value": 12 });

// Bulk update (v11+)
await Actor.updateDocuments([
  { _id: actor.id, "system.attributes.hp.value": 12 }
]);
```

### Permissions

- Creating documents from a module requires the active user to have the `GAMEMASTER` or
  `ASSISTANT` role in Foundry.
- The QuiverDM module is DM-only (consistent with `isDM` check in campaign context), so this
  is not a constraint.
- Documents created by a module inherit the world's default ownership settings unless
  `ownership` is specified in the create payload.

---

## 3. D&D 5e Data Schemas

### Minimal NPC Actor

```json
{
  "name": "Goblin",
  "type": "npc",
  "system": {
    "abilities": {
      "str": { "value": 8 },
      "dex": { "value": 14 },
      "con": { "value": 10 },
      "int": { "value": 10 },
      "wis": { "value": 8 },
      "cha": { "value": 8 }
    },
    "attributes": {
      "hp": { "value": 7, "max": 7, "formula": "2d6" },
      "ac": { "flat": 15 }
    },
    "details": {
      "cr": 0.25,
      "type": { "value": "humanoid", "subtype": "goblinoid" },
      "biography": { "value": "<p>NPC description here.</p>" }
    },
    "traits": {
      "languages": { "value": ["goblin", "common"] }
    }
  }
}
```

CR values: `0`, `0.125`, `0.25`, `0.5`, `1`, `2`, ... `30` (fractional as decimals).

### Minimal Player Character Actor

```json
{
  "name": "Aria Brightwood",
  "type": "character",
  "system": {
    "abilities": {
      "str": { "value": 10 },
      "dex": { "value": 16 },
      "con": { "value": 14 },
      "int": { "value": 12 },
      "wis": { "value": 13 },
      "cha": { "value": 8 }
    },
    "attributes": {
      "hp": { "value": 18, "max": 18 },
      "ac": { "flat": null }
    },
    "details": {
      "race": "Elf",
      "background": "Outlander",
      "biography": { "value": "" }
    },
    "traits": {
      "languages": { "value": ["common", "elvish"] }
    }
  }
}
```

Characters have no `cr` field. AC is typically calculated from equipped items (set `flat: null`
to allow auto-calculation, or `flat: <number>` to override).

### Journal Entry Pages

Page types: `"text"`, `"image"`, `"pdf"`, `"video"`.

```json
{
  "name": "NPC Lore: Goblin Chief",
  "type": "text",
  "text": {
    "content": "<h2>Background</h2><p>The chief rose to power...</p>",
    "format": 1
  },
  "title": { "show": true, "level": 1 }
}
```

### Minimal Spell Item

```json
{
  "name": "Fireball",
  "type": "spell",
  "system": {
    "level": 3,
    "school": "evocation",
    "ability": "int",
    "activation": { "type": "action", "cost": 1 },
    "duration": { "value": null, "units": "inst" },
    "range": { "value": 150, "units": "ft" },
    "target": { "value": null, "type": "sphere", "radius": 20 },
    "description": { "value": "<p>A bright streak flashes...</p>" }
  }
}
```

### Minimal Weapon Item

```json
{
  "name": "Longsword",
  "type": "weapon",
  "system": {
    "type": { "value": "martialM" },
    "damage": { "base": { "formula": "1d8" } },
    "range": { "value": null, "units": "melee" },
    "properties": ["ver"],
    "description": { "value": "<p>A versatile blade.</p>" }
  }
}
```

---

## 4. Import Module Patterns

### ddb-importer (MrPrimate)

- **GitHub:** https://github.com/MrPrimate/ddb-importer
- **Pattern:** Fetches structured JSON from D&D Beyond's character/monster endpoints, maps
  fields to the dnd5e `system` schema, calls `Actor.create()` / `Actor.updateDocuments()`.
  Uses `game.actors.find(a => a.name === x)` to detect existing actors before creating.
- **Items:** Creates embedded items on actors (weapons, spells, features) as part of the same
  actor creation call via the `items` array field.
- **Maintains:** Active as of Foundry v13.
- **Key lesson:** All source data is transformed into Foundry-native JSON before any API call.
  No incremental patching — full actor rebuild on re-import.

### 5e Statblock Importer (jbhaywood / Aioros)

- **GitHub:** https://github.com/jbhaywood/5e-statblock-importer /
  https://github.com/Aioros/5e-statblock-importer
- **Pattern:** Parses plain-text statblocks (SRD monster format), extracts fields with regex,
  constructs a minimal `system` object, calls `Actor.create({type:"npc", ...})`.
- **Key lesson:** Even simple text → actor mapping requires careful schema construction.
  The dnd5e system is strict about field paths. Passing unrecognized fields is silently dropped.

### Common pitfalls

1. **Schema drift:** dnd5e system data model changes between major versions (3.x → 4.x).
   Fields like `damage.parts` were refactored in v3.0. Imports targeting older schema silently
   fail or create broken actors in new versions.
2. **Embedded documents:** Items on an actor must be in the `items` array at create time, or
   added via `actor.createEmbeddedDocuments("Item", [...])` after.
3. **Computed fields:** `system.attributes.ac` is computed from equipment in most cases.
   Setting it directly only works with `flat` override mode.
4. **Duplicate detection:** No built-in unique constraint on actor names. Import modules
   implement their own duplicate-check logic.

---

## 5. Authentication for External → Foundry

### Using a community REST API module (Option A)

- **ThreeHats foundryvtt-rest-api:** `x-api-key` header + `clientId`. API key is set in the
  relay server (cloud or self-hosted). QuiverDM would store the relay URL + API key per
  campaign.
- **PlaneShift:** API key or OIDC. Requires a dedicated Foundry player account.
- Neither module has reached 1.0 stability; breaking changes are expected between Foundry
  major versions.

### Using our own QuiverDM module (Option B)

The QuiverDM Companion module already accepts a `foundryApiKey` configured in module settings
(see MVP spec, `Campaign.foundryApiKey`). The natural extension is:

1. Module receives a POST from QuiverDM: `POST localhost:{FOUNDRY_PORT}/modules/quiverdm/import`
   — **but this requires the module to run an HTTP listener**, which is fragile (see Section 1).

2. Better: **Poll-based import** — the module polls a QuiverDM endpoint
   (`GET /api/integrations/foundry/pending-imports?campaignId=X`) on a timer or on DM action.
   No inbound HTTP required. Module fetches the payload and calls `Actor.create()` itself.
   Auth: same `foundryApiKey` bearer token already used for event ingestion.

3. Alternative: **Import-on-demand via Foundry macro** — QuiverDM generates a macro script
   that the DM runs in Foundry (one-time, no persistent HTTP listener needed).

### Can this work without Foundry being open?

No. All Foundry API calls (`Actor.create`, etc.) execute in the running Foundry JavaScript
context. Foundry must be open and the module active. There is no way to modify a Foundry world
while it is not running. This is a fundamental constraint of the Foundry architecture.

---

## 6. Data Mapping Table

| QuiverDM data | Foundry entity | Feasibility | Notes |
|---|---|---|---|
| NPC record (name, description) | Actor (npc type) | **easy** | Minimal schema well-understood; name + description + optional stats |
| Player character | Actor (character type) | **medium** | Character has classes, spell slots, skills — hard to fully replicate without class data; can create a stub actor |
| Session recap | JournalEntry (text page) | **easy** | HTML content maps directly to `text.content` |
| NPC lore note | JournalEntry (text page) | **easy** | Same as session recap |
| Homebrew item | Item (equipment/weapon) | **medium** | Schema varies by item type; weapon/equipment easiest; consumable/container harder |
| Homebrew spell | Item (spell type) | **medium** | School, level, range, save fields needed; all mappable if data is structured |
| Campaign map upload | Scene | **hard** | Scene creation requires image asset upload to Foundry's file storage first; complex schema for walls, lights, tokens |
| Session transcript excerpt | JournalEntry (text page) | **easy** | Wrap in HTML, create as a JournalEntry page |

---

## 7. Recommended Import Architecture

### Recommendation: **Option B — Extend the QuiverDM Foundry module, polling pattern**

**Rationale:**

1. **We already have the module.** The QuiverDM Companion module is specced for the sidecar
   bridge MVP. Adding import capability extends one module rather than introducing a third-party
   dependency.

2. **Option A (community REST module) has unacceptable dependency risk.** None of the
   community REST modules (ThreeHats, PlaneShift, kakaroto) have reached 1.0 stability.
   ThreeHats uses a relay architecture (third cloud service in the critical path). kakaroto is
   proof-of-concept. PlaneShift requires managing a Foundry player credential. Any of these
   could break silently on a Foundry major version update.

3. **The polling pattern avoids inbound HTTP complexity.** Rather than having QuiverDM push to
   Foundry (which requires the module to run an HTTP listener — fragile in Foundry's runtime),
   the module polls QuiverDM. This reuses the same `foundryApiKey` auth already designed for
   event ingestion.

4. **Option C (macro export) is viable as a fallback MVP** — low implementation cost, no auth
   complexity, works offline. However, it has poor UX (DM must manually run macros) and is
   not automatic. Recommend shipping macro export first as a low-effort v1, then automating
   via polling in v2.

### Proposed architecture (Option B, v2)

```
QuiverDM backend
  POST /api/integrations/foundry/import-queue
  (DM triggers "Push to Foundry" action in QuiverDM UI)
  → writes ImportJob to DB with payload (actors/journals/items)

QuiverDM Foundry module (running in DM's Foundry)
  setInterval(() => {
    const jobs = await fetch("/api/integrations/foundry/pending-imports", {
      headers: { Authorization: "Bearer " + settings.apiKey }
    });
    for (const job of jobs) {
      await processImportJob(job);  // Actor.create / JournalEntry.create / Item.create
      await fetch("/api/integrations/foundry/import-ack/" + job.id, { method: "POST" });
    }
  }, 5000); // poll every 5 seconds while Foundry is open
```

**Phased delivery:**

| Phase | Scope | Effort |
|---|---|---|
| v0 (macro export) | QuiverDM generates JS macro; DM pastes into Foundry console | 1–2 days |
| v1 (NPC + journal push) | Module polls pending-imports; creates Actor (npc) + JournalEntry | 3–4 days |
| v2 (full entity support) | Add items/spells; character stub actors; duplicate detection | 1 week |
| v3 (scenes) | Map upload → Scene creation; asset hosting; complex schema | 2–3 weeks |

---

## Sources

- Foundry REST API package (ThreeHats): https://foundryvtt.com/packages/foundry-rest-api (checked 2026-02-24)
- foundryvtt-rest-api GitHub: https://github.com/ThreeHats/foundryvtt-rest-api (checked 2026-02-24)
- foundryvtt-rest-api-relay GitHub: https://github.com/ThreeHats/foundryvtt-rest-api-relay (checked 2026-02-24)
- kakaroto fvtt-module-api: https://github.com/kakaroto/fvtt-module-api (checked 2026-02-24)
- PlaneShift REST API: https://github.com/cclloyd/planeshift (checked 2026-02-24)
- Foundry HTTP API package: https://foundryvtt.com/packages/api (checked 2026-02-24)
- Foundry VTT API v11 docs: https://foundryvtt.com/api/v11/ (checked 2026-02-24)
- Foundry VTT API v12 docs: https://foundryvtt.com/api/v12/ (checked 2026-02-24)
- JournalEntryPage v10+ changes: https://foundryvtt.com/article/v10-journal-pages/ (checked 2026-02-24)
- foundryvtt/dnd5e GitHub: https://github.com/foundryvtt/dnd5e (checked 2026-02-24)
- dnd5e actor sheets (DeepWiki): https://deepwiki.com/foundryvtt/dnd5e/3.1-actor-sheets (checked 2026-02-24)
- dnd5e item data models (DeepWiki): https://deepwiki.com/foundryvtt/dnd5e/2.2-item-data-models (checked 2026-02-24)
- ddb-importer (MrPrimate): https://github.com/MrPrimate/ddb-importer (checked 2026-02-24)
- 5e Statblock Importer (Aioros): https://github.com/Aioros/5e-statblock-importer (checked 2026-02-24)
- QuiverDM MVP Foundry spec: docs/plans/2026-02-24-mvp-foundry-integration-spec.md

---

## Research Gate Verdict

- **Result:** pass
- **Reason:** Sufficient data exists to design a QuiverDM → Foundry import feature. The Foundry
  JavaScript API for document creation (Actor, JournalEntry, Item) is well-documented. The dnd5e
  system schema for NPCs and basic items is mappable from QuiverDM data with medium engineering
  effort. No critical blockers found. Community REST API modules exist but carry dependency risk;
  extending our own module with a polling pattern is the recommended path.
- **Next action:**
  1. Add `foundry-import-plugin` entry to `feature_registry.json` with status `research_pass`.
  2. Ship macro export (Phase v0) as fast follow-on to the Sidecar Bridge MVP.
  3. Design QuiverDM data → Foundry schema mapping layer (separate spec, ~0.5 day).
  4. Revisit Scene import (Phase v3) only after v1+v2 are validated with beta DMs.
