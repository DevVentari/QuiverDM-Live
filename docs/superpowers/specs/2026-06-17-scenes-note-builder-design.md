# Scenes as a Woven Note Builder — Design Spec (Layer 1)

**Date:** 2026-06-17
**Status:** Approved (brainstorm) — ready for implementation plan
**Supersedes/evolves:** `docs/superpowers/specs/2026-06-16-ai-scene-creation-design.md` (the audience-split present-able scene). Builds on the shipped `Scene` model, `scenes` router, `SceneCreateForm`, `SceneStage`.

## Summary

Scenes evolve from "an AI-written moment you present to players" into **the DM's run-help for a portion of a session, assembled from notes and woven from the world**. The atomic unit is the **note** (read-aloud, tactic, secret, check, lore, **trigger**); a **scene is a grouping of notes**; sessions later organise scenes into a run-list. Prep is an **invisible-AI note builder** — no chat: the AI auto-fills notes you start, proposes "ghost" notes you accept or dismiss, and refines on selection. Crucially, prep **reads the DM Brain** (`WorldStateChange` history + character bonds/backstory) so drafted notes weave continuity — *"the innkeeper still remembers you torched his cellar."*

This spec is **Layer 1** of a larger vision (players woven into a world their actions change). Layers 2–3 are named boundaries, not built here.

## Why this shape (decisions locked in brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Scene scope | **Campaign library + session playlist** (reusable scenes; sessions reference an ordered selection — Layer 2) |
| 2 | Structure | **Flat run-list with optional acts**; a scene optionally carries an `act` label; ungrouped allowed |
| 3 | Atom vs group | **Note = atom, Scene = grouping of notes** |
| 4 | Branching | Lives on the **map** (note pins), not in scenes — de-scoped from the runner |
| 5 | Player-facing/live | The **VTT/map's** job; scenes *feed* it later. Run cursor is **single** (DM reference position) |
| 6 | Prep feel | **Invisible-AI note builder** — auto-fill + ghost suggestions + inline refine + "what am I forgetting?", **no chat** |
| 7 | World context | Prep **reads the existing DM Brain** (`getEntitySessionHistory`) + character backstory to weave continuity — no new entity-memory store |
| 8 | Triggers | Notes can be **triggers** (condition + DC/reveal payload); **static** in Layer 1, reactive in Layer 3 |

## Domain model

### `SceneNote` (new)

```prisma
model SceneNote {
  id         String   @id @default(cuid())
  sceneId    String
  scene      Scene    @relation(fields: [sceneId], references: [id], onDelete: Cascade)
  type       String   // read_aloud | tactic | secret | check | lore | trigger
  title      String?  // optional short label
  body       String   @db.Text // the note content (read-aloud prose, tactic text, …)
  data       Json?    // typed payload: check {skill,dc}; trigger {condition, dc?:{skill,dc}, reveal?}
  orderIndex Int      @default(0)
  source     String   @default("manual") // manual | ai | ai_suggested (a ghost that was kept)
  // Named boundaries for later layers (nullable now, unused in Layer 1):
  mapPinId   String?  // Layer 3: note pinned on a map
  stateRule  Json?    // Layer 3: combat-reactive rule
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([sceneId])
}
```

**Note types**
- `read_aloud` — prose the DM speaks. `body` = the text.
- `tactic` — creature/NPC behaviour ("direwolves attack only who they're tracking"). `body`.
- `secret` — hidden fact/consequence. `body`.
- `check` — `body` = what it reveals; `data = { skill, dc }`.
- `lore` — background/continuity tidbit (often Brain-woven). `body`.
- `trigger` — *static* conditional: `body` = summary; `data = { condition: string, dc?: { skill, dc }, reveal?: string }`. Rendered as an expandable "if players X → …". Reactive behaviour is Layer 3.

### `Scene` changes

- Add `act String?` — optional grouping label (library + run-list group by it; "Ungrouped" bucket for nulls).
- Add relation `notes SceneNote[]`.
- The previously-shipped fixed content fields (`description`, `dmNotes`, `suggestedChecks`, `entityBeats`) are **generalised into notes**. A one-time backfill (the branch has only test scenes) converts: `description → read_aloud` note, `dmNotes → lore/secret` note, each `suggestedChecks[]` → `check` note, each `entityBeats[k]` → `tactic`/`secret` note.
- **Reconciliation bridge:** keep `Scene.description` as a denormalised mirror of the scene's **primary `read_aloud` note** — defined as the `read_aloud` note with the lowest `orderIndex` (ties broken by `createdAt`) — updated whenever that note is created/edited/reordered/deleted. This keeps the existing player bridge (`v3/play` reads the presented scene's read-aloud; `scenes.list`) working untouched. The plan may instead update those readers; the mirror is the low-risk default.

## The ambient AI note builder (prep)

The scene surface becomes a **note board**, replacing `SceneStage`'s audience-split as the primary view (its content maps onto note types, so nothing is lost; the present/play bridge stays minimal). **No chat anywhere.** The AI surfaces only as actions on note objects:

- **Entry (reuse `SceneCreateForm`):** describe the scene + tag entities/party + optional act → on create, the AI **seeds** an initial set of notes (a read-aloud + a few tactics/secrets/checks), already woven from the Brain.
- **Auto-fill:** `+ read-aloud / + tactic / + secret / + check / + trigger / + lore` adds a block; the AI drafts its `body` (and `data` for check/trigger); the DM edits.
- **Ghost suggestions:** the AI proposes notes as dashed "ghost" cards (`source: ai_suggested`) with ✓ keep / ✕ dismiss. Kept ghosts become real notes.
- **"What am I forgetting?"** surfaces a fresh batch of ghosts — it does **not** open a chat.
- **Inline refine:** on a `read_aloud` (or any prose) body, contextual actions *colder / shorter / weave-in-<entity>* rewrite the selection.
- **Reorder / edit / delete** notes directly (drag handle; `orderIndex`).

## Brain-aware weaving (the "woven world")

Prep context is gathered server-side before any AI call and fed into every prompt (seed / draft / suggest):

- **Tagged `WorldEntity`s:** for each, query recent `WorldStateChange` rows by `entityId` (`triggerText`, `newValue`, `changeType`, `createdAt`) — the entity's cross-session narrative memory. (`brainService.getEntitySessionHistory` returns only *appearances*; the `WorldStateChange` log is the richer source and is queried directly in `gatherSceneContext`.)
- **Party `Character`s:** `backstory`, `bonds`, `ideals`, `flaws` (a compact slice) so the AI can hook the scene into a PC.
- **Scene basics:** the DM's description, mood/act, campaign tone.

The system prompt instructs the model to *weave* this history into drafted notes and ghosts (a `lore`/`tactic`/`secret` note may reference a past event), keeping player-safe content in `read_aloud` and hidden material in `secret`/`trigger`.

## AI services

Reuse `chatWithAI` **Claude-first with fallback** (per the just-landed fix — never `forceProvider`). New module `src/lib/ai/scene-notes.ts` (mirrors the defensive parse pattern of `generate-scene.ts`), each returning Zod-validated output:

- `seedSceneNotes(context) → Note[]` — initial set on create.
- `draftNote(context, type, hint?) → { title?, body, data? }` — one note's content.
- `suggestNotes(context, existingNotes) → GhostNote[]` — ghosts / "what am I forgetting".
- `refineNote(body, instruction) → string` — inline rewrite.

`context` is built by an extended `gatherSceneContext` (in `scene-generation.service.ts`) that now also pulls Brain history + character bonds.

## Router & procedures (`scenes.ts`, DM-scoped)

- `getStage` → returns the scene **with its `notes` ordered** (+ resolved entities/party as today).
- `sceneNotes.create / update / delete / reorder` — direct note CRUD (mutations DM-scoped; `update` keeps the `description` mirror in sync for the primary read-aloud).
- `sceneNotes.seed` — AI seed on scene create (folds into `scenes.generate`, which now returns a scene whose notes were seeded).
- `sceneNotes.draft` / `sceneNotes.suggest` / `sceneNotes.refine` — the builder's AI actions.
- All read procedures `campaignMemberProcedure`; all mutations/AI `campaignDMProcedure` (consistent with the IDOR-guarded pattern already in the router).

## Data flow

```
SceneCreateForm (describe + tag + act)
   └─ scenes.generate ─▶ gatherSceneContext (entities + party + BRAIN history + bonds)
                          └─ seedSceneNotes (chatWithAI, Claude-first→fallback)
                          └─ Scene.create + SceneNote[] + description mirror
   ▼
Note builder (getStage → scene + ordered notes)
   ├─ + add block      ─▶ sceneNotes.draft  ─▶ create note
   ├─ ghost ✓ keep     ─▶ create note (source: ai_suggested)
   ├─ "forgetting?"    ─▶ sceneNotes.suggest ─▶ ghosts
   ├─ inline refine    ─▶ sceneNotes.refine  ─▶ update note body
   └─ edit/reorder/del ─▶ sceneNotes.update / reorder / delete
```

## Error handling

- **AI failure** (provider down / all providers fail): the builder stays usable; the affected action surfaces an in-world inline error ("the vision wouldn't hold") and the note/ghost is left untouched. Never 500 the page — the fallback chain plus per-action try/catch.
- **Brain history empty / entity untagged:** weaving degrades silently — the AI drafts from the description alone.
- **Malformed AI JSON:** defensive parse → clean "couldn't read that" on the single action, not the whole scene.
- **Backfill safety:** the one-time content→notes backfill is idempotent and only touches scenes with `generatedAt` set and no `notes`.

## Testing (Definition of Done)

- **Unit:** `scene-notes.ts` parse/validate per function (mock `chatWithAI`) incl. trigger `data` shape; `gatherSceneContext` weaving (mock Brain history → asserts it reaches the prompt).
- **Workflow spec** `tests/workflows/scene-notes.workflow.spec.ts`: seed a scene with notes (mock/seed deterministically), add a note block, accept a ghost, refine a read-aloud, add a trigger note, reorder, delete — assert the note board reflects each. AI mocked/seeded (no live provider), consistent with the existing scenes workflow spec.
- **Persona:** extend `veteran-dm` rapid-prep to build a scene's notes.
- `npm run qa:cycle` green before merge; no `test.fixme`.

## Build sequence (within Layer 1)

1. `SceneNote` model + migration + content→notes backfill; `getStage` returns notes.
2. Note CRUD + reorder procedures; the note-board UI (no AI yet) — add/edit/delete/reorder typed blocks incl. trigger.
3. `scene-notes.ts` AI service + the four builder actions (seed/draft/suggest/refine), wired as auto-fill / ghosts / inline refine / "what am I forgetting".
4. Brain-weaving: extend `gatherSceneContext` + prompts; verify continuity surfaces.
5. Workflow spec + persona.

## Out of scope (named follow-on layers)

- **Layer 2 — Library + session run-list + run mode:** group/filter/search library; `SessionScene` ordered join + single "now referencing" cursor (supersedes `GameSession.activeSceneIndex`); run-mode navigation.
- **Layer 3 — The world loop:** running scenes/player actions → `WorldStateChange` writes (`source: inference/ingestion`); dedicated backstory-hook surfacing; triggers become **combat-reactive** (`stateRule`); notes pin to the **map** (`mapPinId`); scenes feed the **VTT/map** player channel.
- `SessionPhase` (pacing) and `SessionRoute` (branching) are orthogonal/legacy — not modified here; the implementer confirms their usage rather than duplicating.
