# AI Scene Creation — Design Spec

**Date:** 2026-06-16
**Status:** Approved (brainstorm) — ready for implementation plan
**Surface:** `src/app/v3/campaigns/[slug]/scenes/page.tsx`, `src/server/routers/scenes.ts`

## Summary

Turn scene creation from a plain form into a two-phase **experience**. The DM
describes a moment in plain words and tags who/what is in it; the AI both
**writes** the scene (player-facing read-aloud + secret DM prep) and
**assembles a board** of the tagged compendium entities. The creation form
fades and the page fills with a two-column scene, split by audience:
player-facing on the left, DM-only on the right.

This is the "writer + board" direction (option C), audience split (option A),
delivered as an inline crafted-loading reveal (option 1), with an editable
draft + per-section regenerate (option 1).

## Decisions (locked in brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| 1 | AI's job | **Writer + Board** — writes prose *and* assembles tagged entities |
| 2 | Column split | **By audience** — left = player-facing, right = DM-only |
| 3 | Generation feel | **Inline crafted loading** — form fades → "the world takes shape" → columns animate in. One `chatWithAI` call returning structured JSON |
| 4 | Form fields | Title (optional, AI-named if blank), Party present, Compendium tags, Describe box, optional Mood chips |
| 5 | Image + music | AI **suggests** a music cue (output, not input); AI **generates scene art** asynchronously via the existing image-job worker |
| 6 | Edit model | **Editable draft + regenerate** — narration & DM notes are click-to-edit; Regenerate works whole-scene or per-section; the board is live-linked to the compendium (read-only here) |

## User flow

```
┌─ Phase 1: Compose (centered form) ──────────────────────────┐
│  Title (optional)                                           │
│  Party present      [Tharivol ×] [Mira ×] [+ add]           │
│  In this scene      [🗺 Castle Gate ×] [👤 Strahd ×] [＋]    │
│  Describe the scene  ▢ free text — the DM's intent          │
│  Mood (optional)    (RP) (Set-piece) (Exploration) (Combat) │
│  [✦ Create scene]                                           │
└─────────────────────────────────────────────────────────────┘
            │  submit
            ▼
┌─ Phase 2: Reveal (form fades, page fills) ──────────────────┐
│  ~3–8s atmospheric loading state ("the world takes shape")  │
│            │ generation resolves                            │
│            ▼                                                 │
│  ┌── LEFT (player-facing) ──┐  ┌── RIGHT (DM-only) ───────┐ │
│  │ Title (AI-named)         │  │ Cast present (party)     │ │
│  │ Read-aloud  ✎ editable   │  │ NPC mini-cards + reveal  │ │
│  │ Stage: location, 🎵 cue  │  │   statblock              │ │
│  │ [Present to players ▸]   │  │ Secret beats  ✎ editable │ │
│  │ (scene art fills in      │  │ Possible checks (DC)     │ │
│  │  async when ready)       │  │ [⟳ Regenerate ▾]         │ │
│  └──────────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Data model

Extend the existing `Scene` model (most fields already exist). Reused as-is:
`title`, `type` (← Mood), `description` (← read-aloud), `dmNotes` (← secret
prep), `imageUrl`, `imageJobId`-style art, `musicCue`, `linkedEntityIds`
(← compendium tags), `isPresented`.

New columns:

```prisma
model Scene {
  // ...existing...
  partyPresentIds Json    @default("[]") // Character/WorldEntity-PC ids in this scene
  suggestedChecks Json    @default("[]") // [{ skill, dc, note }]
  entityBeats     Json    @default("{}") // { [entityId]: { wantsInScene, secret } }
  imageJobId      String?                // async scene-art job (mirrors NPC.imageJobId)
  generatedAt     DateTime?              // null = hand-authored / not yet generated
  promptInput     Json?                  // the raw form input, for regenerate
}
```

`description` stays the player read-aloud; `dmNotes` stays the secret prep
block. `suggestedChecks` and `entityBeats` are new structured DM-side surfaces.
`promptInput` lets Regenerate re-run with the original intent.

## AI output contract

A single `chatWithAI(messages, { forceProvider: 'claude' })` call (per
CLAUDE.md, follow the `ai-extraction` skill) returns JSON validated by a Zod
schema:

```ts
const SceneGenerationSchema = z.object({
  title: z.string(),                 // used when DM left title blank
  type: z.enum(['rp','description','tavern','battle','theatre']),
  readAloud: z.string(),             // → Scene.description (player-facing)
  dmNotes: z.string(),               // → Scene.dmNotes (secret prep)
  musicCue: z.string(),              // → Scene.musicCue (a short evocative cue)
  suggestedChecks: z.array(z.object({
    skill: z.string(), dc: z.number().int(), note: z.string(),
  })),
  entityBeats: z.record(z.object({   // keyed by tagged entity id
    wantsInScene: z.string(),
    secret: z.string().nullable(),
  })),
});
```

**Prompt context** is assembled server-side before the call:
- The DM's free-text description + chosen Mood (if any).
- Each tagged `WorldEntity`: name, type, description, `properties`, and—if it
  has a `statBlock`—a short stat summary. Secrets/threat info included (DM-side).
- Party-present characters: name + a one-line summary (class/level/role).
- Light campaign framing (campaign name / tone) for voice consistency.

The model is instructed: weave tagged entities into the narration, keep
read-aloud player-safe (no secrets leak), and put hidden material in `dmNotes`
/ `entityBeats.secret`.

## Server: router & service

New service `src/server/services/scene-generation.service.ts`:
- `gatherSceneContext(campaignId, input)` → loads tagged entities + party.
- `generateScene(context)` → builds messages, calls `chatWithAI`, validates.

Router changes in `scenes.ts`:
- **`generate`** mutation: input = `{ campaignId, title?, partyPresentIds,
  linkedEntityIds, description (intent), type? }`. Gathers context, generates,
  **creates** the `Scene` (persisting `promptInput`, `generatedAt`), enqueues
  the scene-art image job, returns the scene. This replaces `create` as the
  primary path; the plain `create` stays for hand-authored scenes.
- **`regenerate`** mutation: input = `{ id, section? }` where `section ∈
  {'all','readAloud','dmNotes','checks','music'}`. Re-runs generation from the
  stored `promptInput`; when `section` is set, only that field is overwritten.
- **`update`** (existing) handles inline edits to `description` / `dmNotes`.

Scene art reuses the existing image-job pipeline (the `homebrewImage` /
`imageJobId` pattern): `generate` enqueues a job; the worker writes `imageUrl`
on completion; the UI polls/subscribes and the art fades in.

**Authz:** the existing `TODO(authz)` is addressed here — `generate`,
`regenerate`, `update`, `present` become DM-scoped (campaign-member procedure
per the `quiverdm-auth` skill); `list`/`getById` stay member-readable.

## UX details

- **Phase transition:** form is a motion element; on submit it fades/scales out
  while the loading state cross-fades in. On resolve, the two columns stagger in
  (Framer Motion), honoring the "world breathes" design principle.
- **Loading state:** atmospheric, in-world copy ("The world takes shape…"),
  amber glow — not a spinner. Covers the 3–8s `chatWithAI` latency.
- **Left column (player-facing):** title, read-aloud (click-to-edit), stage
  strip (location chip + music cue), Present-to-players button, scene art slot
  (skeleton → fades in when the job completes).
- **Right column (DM-only):** party-present avatars, NPC mini-cards (portrait,
  one-line, "reveal statblock" → expands the linked `statBlock`), secret beats
  (click-to-edit `dmNotes` + per-entity `wantsInScene`/`secret`), possible
  checks (skill + DC chips), Regenerate control (split button: whole / section).
- **Present to players:** unchanged semantics (`present`/`clearPresented`);
  players see the left column only.

## Error handling

- **Generation fails / invalid JSON:** keep the form mounted (don't lose the
  DM's input), surface an in-world error ("The vision wouldn't hold — try
  again"), offer retry. Follow `chatWithAI` provider fallback already in place.
- **Image job fails:** scene is fully usable without art; art slot shows a quiet
  "no art" state, with a manual "generate art" retry.
- **Empty tags / empty party:** allowed — AI generates from the description
  alone; board shows only what was tagged.
- **Regenerate:** optimistic-safe — only overwrites the targeted section(s);
  inline edits to other sections are preserved.

## Testing (Definition of Done)

- `tests/workflows/scenes.workflow.spec.ts` (new): DM opens Scenes → New Scene →
  tags entities + party + description → Create → loading → two-column reveal →
  edits read-aloud → regenerates DM notes → presents to players. AI calls are
  mocked at the tRPC boundary (deterministic fixture for `generate`).
- Update `tests/workflows/v3-screens.workflow.spec.ts` if the scenes route
  smoke-check assertions change.
- Persona: extend `veteran-dm` (Blake) rapid-prep flow to create a scene.
- `npm run qa:cycle` green before merge. No `test.fixme`.

## Out of scope (later)

- Live token streaming of the narration (decision 3 option 2) — upgrade later.
- Player-side live scene view changes beyond what `present` already does.
- Reordering / scene sequencing UX.
