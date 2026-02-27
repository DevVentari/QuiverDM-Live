# Foundry VTT Import API — Research Brief

Date: 2026-02-24
Output file: docs/obsidian-vault/10-Research/2026-02-24-foundry-import-api-research.md

## Your task

Research Foundry VTT's module API, REST API options, and import patterns so we can
design a future QuiverDM feature that pushes session data INTO Foundry VTT.

Do NOT write any application code. Your only output is the research document.

## Background

QuiverDM is an AI-powered D&D session management app. After a session it produces:
- Session summaries (AI-generated recap)
- NPC records (name, description, relationships)
- Player character data
- Homebrew content (items, spells, etc.)
- Transcript segments (quotes, key moments)

We want to push this data into a DM's Foundry VTT world so it appears as:
- Actors (player characters + NPCs)
- Journal Entries (session notes, NPC lore)
- Items (homebrew items/spells)
- Scenes (maps — lower priority, research only)

## Research questions — answer all of these

### 1. Foundry REST API options

- Does Foundry VTT have a native REST API? (Standalone Electron app, not a web service.)
- What community modules exist that expose HTTP endpoints from inside a running Foundry world?
  - Search GitHub for: `foundryvtt rest api`, `foundry-vtt-rest-api`, `foundryvtt-api`
  - Key ones to evaluate: `foundryvtt-rest-api` by Typhonjs, `fvtt-rest-api`, any others with >100 stars
  - For each: what endpoints does it expose? authentication method? actively maintained?
- Can a Foundry module itself run an HTTP server to accept external POSTs? (Node.js in Foundry v12+)
  - If yes, what is the API to do this? (`game.socket`? express inside a module?)

### 2. Foundry module development — document creation APIs

Research the Foundry v11/v12 JavaScript API (https://foundryvtt.com/api/):
- `Actor.create(data, options)` — what does `data` look like for a 5e character? for an NPC?
- `JournalEntry.create(data)` — structure for creating journal entries with pages
- `Item.create(data)` — structure for creating items/spells
- `Scene.create(data)` — structure for maps (brief — lower priority)
- How do you look up an existing actor by name before creating? (avoid duplicates)
- How do you update an existing actor? (`Actor.updateDocuments()`?)
- What permissions/flags are needed to create documents from a module?

### 3. D&D 5e data schemas

Research the dnd5e system schema (https://github.com/foundryvtt/dnd5e):
- What is the minimal `system` data object to create a valid 5e NPC Actor?
- What is the minimal `system` data for a 5e Player Character Actor?
- What fields map to: HP, AC, ability scores, CR (for NPCs)?
- Journal Entry Pages — what types exist? (text, image, pdf, video) — what does a text page look like?
- Item types: weapon, spell, feat, equipment — minimal schema for each?

### 4. Existing import modules — patterns

Study how community modules do bulk imports:
- **D&D Beyond Importer** (GitHub: mrprimate/ddb-importer or similar) — how does it create actors?
- **Plutonium** (5e.tools integration) — how does it handle NPC/item import?
- **Monk's Active Tile Triggers** or similar — any patterns for external data ingestion?
- What common pitfalls do these modules encounter? (version compatibility, system updates, etc.)

### 5. Authentication for external → Foundry

How would QuiverDM authenticate when pushing data TO a Foundry world?
- If using a community REST API module, what auth does it use? (API key header? session cookie?)
- If the Foundry module itself handles the HTTP server, how would it validate requests from QuiverDM?
  - Same `foundryApiKey` pattern we already use for the sidecar bridge?
- Is there a way to do this without the DM needing to leave Foundry open/running?

### 6. QuiverDM → Foundry data mapping

Based on your research, fill in this mapping table:

| QuiverDM data | Foundry entity | Feasibility | Notes |
|---|---|---|---|
| NPC record (name, description) | Actor (NPC type) | ? | |
| Player character | Actor (character type) | ? | |
| Session recap | JournalEntry (text page) | ? | |
| NPC lore note | JournalEntry (text page) | ? | |
| Homebrew item | Item | ? | |
| Homebrew spell | Item (spell type) | ? | |
| Campaign map upload | Scene | ? | |
| Session transcript excerpt | JournalEntry | ? | |

Feasibility: `easy` / `medium` / `hard` / `not-feasible`

### 7. Recommended import architecture

Based on your findings, recommend ONE of:

**Option A — QuiverDM calls a community REST API module**
- DM installs a REST API module in Foundry
- QuiverDM POSTs data directly to the module's endpoints
- Pro: no custom Foundry module needed for this feature
- Con: depends on third-party module maintenance

**Option B — QuiverDM Foundry module handles HTTP server**
- Extend our existing QuiverDM Foundry module (already planned for sidecar bridge)
- Add HTTP endpoints to accept import payloads from QuiverDM
- Pro: one module, full control
- Con: more module dev work

**Option C — Manual macro export**
- QuiverDM generates a Foundry macro script (JavaScript)
- DM pastes/runs it in Foundry console
- Pro: no HTTP auth complexity, works offline
- Con: poor UX, not automatic

State which option you recommend and why, with reference to your findings.

## Output format

Write your findings to:
`docs/obsidian-vault/10-Research/2026-02-24-foundry-import-api-research.md`

Use this structure:

```
# Foundry VTT Import API Research

Date: 2026-02-24
Status: research_gate=pending (to be reviewed by product)

## 1. REST API options
...

## 2. Document creation APIs
...

## 3. D&D 5e data schemas
(include minimal JSON examples)

## 4. Import module patterns
...

## 5. Authentication
...

## 6. Data mapping table
(filled-in table)

## 7. Recommended architecture
...

## Sources
(URLs checked, with dates)

## Research Gate Verdict
- Result: pass | fail
- Reason:
- Next action:
```

## When done

1. Commit the research doc:
   `git add docs/obsidian-vault/10-Research/2026-02-24-foundry-import-api-research.md`
   `git commit -m "research: Foundry VTT import API and module development"`

2. Do NOT merge to main — leave on `research/foundry-import-api` branch for review.
