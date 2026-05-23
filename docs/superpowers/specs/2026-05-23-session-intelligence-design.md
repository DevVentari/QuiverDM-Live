# Session Intelligence — Design Spec

**Date:** 2026-05-23  
**Status:** Approved for implementation planning  
**Scope:** Six features forming a unified session prep + live intelligence system

---

## Overview

A complete session intelligence layer for QuiverDM built around one core insight: DMs already write rich, structured prep documents — they just can't use them at the table. This system ingests those documents, builds a knowledge graph from them, and gives the DM Brain the information it needs to be a genuine reasoning partner during play.

The six features are not independent — they share a data model and compound each other's value.

---

## Features

1. **Session Intent Brief** — Tone keywords + player goals + DM-only truths as a structured field on the session
2. **Session Phase Pacing** — Named phases with time budgets, trackable during play
3. **NPC Behavioral Profiles** — Triggered behaviors, per-topic knowledge, flagged critical dialogue
4. **Branching Route Tracker** — Named escape/approach routes with benefits/risks, active route tracked in cockpit
5. **Information Web** — Campaign-scoped secrets assigned to NPCs with reveal conditions; session-scoped revelation log; campaign graph sync
6. **PDF Import Pipeline** — AI extraction of prep documents into all of the above

---

## Data Model

### New models

**`Session.intentBrief`** and **`Session.prepDocKey`** — JSON and nullable String fields added to existing Session model:
```ts
{ toneKeywords: string[], playerGoals: string[], dmOnlyTruths: string[] }
```

**`SessionPhase`**
```prisma
model SessionPhase {
  id           String  @id @default(cuid())
  sessionId    String
  session      Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name         String
  targetMinutes Int
  orderIndex   Int
  notes        String?
}
```

**`SessionRoute`**
```prisma
model SessionRoute {
  id          String  @id @default(cuid())
  sessionId   String
  session     Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name        String
  description String?
  benefits    String[]
  risks       String[]
  isActive    Boolean @default(false)
  orderIndex  Int
}
```

**`PrepSecret`** — Campaign-scoped; optionally tied to a session during prep
```prisma
model PrepSecret {
  id           String   @id @default(cuid())
  campaignId   String
  campaign     Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  sessionId    String?
  session      Session? @relation(fields: [sessionId], references: [id])
  name         String
  content      String
  isRevealed   Boolean  @default(false)
  orderIndex   Int      @default(0)
  knowledge    PrepKnowledge[]
  revelations  SecretRevelation[]
}
```

**`PrepKnowledge`** — Links a secret to an NPC/entity with reveal conditions
```prisma
model PrepKnowledge {
  id              String      @id @default(cuid())
  prepSecretId    String
  prepSecret      PrepSecret  @relation(fields: [prepSecretId], references: [id], onDelete: Cascade)
  worldEntityId   String
  worldEntity     WorldEntity @relation(fields: [worldEntityId], references: [id])
  revealCondition String?
  isCritical      Boolean     @default(false)
  criticalDialogue String?
}
```

**`SecretRevelation`** — The bridge event between prep and Brain
```prisma
model SecretRevelation {
  id            String     @id @default(cuid())
  prepSecretId  String
  prepSecret    PrepSecret @relation(fields: [prepSecretId], references: [id], onDelete: Cascade)
  sessionId     String
  session       Session    @relation(fields: [sessionId], references: [id])
  revealedAt    DateTime   @default(now())
  revealedBy    String?    // NPC name or "environment"
  method        String?    // "social-pressure", "investigation", "observation"
  syncedToGraph Boolean    @default(false)
}
```

**`NpcBehaviorProfile`** — 1:1 extension of WorldEntity for NPCs, no duplicate NPC data
```prisma
model NpcBehaviorProfile {
  id                 String      @id @default(cuid())
  worldEntityId      String      @unique
  worldEntity        WorldEntity @relation(fields: [worldEntityId], references: [id], onDelete: Cascade)
  defaultBehavior    String?
  triggeredBehaviors Json        // [{condition: string, behavior: string}]
  criticalDialogue   Json        // [{line: string, trigger: string}]
}
```

### Existing models — new usage

**`WorldEntity`** — Receives `type: SECRET` entities on revelation sync  
**`WorldRelationship`** — New relationship types: `"knows"`, `"revealed_to_players"`, `"unlocks"`

### Key design decisions

- **PrepSecret is campaign-scoped** — secrets persist across sessions. `sessionId` is optional: assigned during prep to signal "this secret is relevant tonight" but the secret itself belongs to the campaign.
- **NpcBehaviorProfile links 1:1 to WorldEntity** — no duplicate NPC records. The profile is an extension of the Brain's entity.
- **SecretRevelation.syncedToGraph** — flag enables a background BullMQ job to promote confirmed revelations into `WorldEntity` + `WorldRelationship` asynchronously. DM is never blocked on sync.
- **PrepKnowledge.isCritical** — flags load-bearing reveals (e.g. the steering line that prevents premature dungeon descent). Cockpit surfaces these with a star and higher priority in Brain suggestions.

---

## UI

### Session Prep Page — new sections

Added to the existing PrepWorkspace as collapsible cards with the sticky-nav pattern. A "Import PDF" button sits at the bottom of the sticky nav and launches the import flow.

New nav items (marked ✦):
- **✦ Intent Brief** — tone keyword chips + player goals text + DM-only truths (collapsed by default, revealed on hover)
- **✦ Secrets Web** — list of PrepSecrets, each showing assigned NPCs and reveal conditions. Add/edit inline. Critical secrets flagged with ★.
- **✦ NPC Profiles** — extends the existing characters section with behavioral tabs (Behavior / Knowledge / Dialogue) per NPC
- **✦ Escape Routes** — named routes with benefits/risks chips, reorder, mark active
- **✦ Phase Pacing** — phase list with target time inputs; shown as a visual timeline

### Cockpit — right-edge tab strip (desktop) / bottom sheet (mobile)

**Desktop:** Thin vertical tab strip anchored to the right edge. Five tabs (vertical text labels): NPCs / SECRETS / ROUTES / PHASES / BRIEF. Tapping a tab slides a panel in over the cockpit. Tapping again or anywhere outside dismisses it. One panel open at a time.

**Mobile:** Same five tabs inside a shadcn Sheet that swipes up from the bottom. Tab bar shown at the sheet header.

#### NPC Panel
- NPC list for the current session (populated from PrepKnowledge assignments)
- Tap an NPC → expands in-panel to show: description snippet, triggered behaviors, per-topic knowledge with reveal conditions, critical dialogue lines
- Revealed secrets shown struck-through with the session they were revealed in
- "Mark revealed" button per secret logs a SecretRevelation

#### Secrets Panel
- Full list of PrepSecrets scoped to this session
- Status: hidden (default) / revealed (struck-through + session tag)
- Tap a secret → shows which NPCs hold it + their reveal conditions
- "Mark revealed" inline

#### Routes Panel
- Named routes with benefits/risks
- Tap to mark as "active" (highlights in panel, cockpit header shows active route name)

#### Phases Panel
- Phase list with target minutes
- "Start phase" button sets phase start time; elapsed time shown against target
- Current phase highlighted

#### Brief Panel
- Session Intent: tone chips + player goals + DM-only truths

### Brain suggestion card (inline in cockpit)

Not in a side panel — appears as a non-blocking card inline in the main cockpit area. Shows when Brain detects a knowledge opportunity. DM can act without opening any tab.

Format:
```
[BRAIN] {NPC} in play — {secret name} ({★ critical?}). Reveal now?
[Reveal]  [Later]  [×]
```

"Later" moves to a "deferred" queue surfaced in the Secrets panel. "Reveal" logs SecretRevelation immediately and dismisses.

---

## Brain Integration

### Pre-session briefing

Triggered manually from the prep page ("Generate Briefing" button) or automatically when prep is marked complete.

Brain reads:
- Campaign `WorldRelationship` graph filtered to `revealed_to_players` type — what players currently know
- All `PrepSecret` records for this session — what's planned

Generates a structured brief:
- What players know entering this session (from graph)
- Which secrets are closest to discovery (NPCs in tonight's session who hold unrevealed secrets)
- Recommended reveal priority (isCritical secrets first, then by NPC accessibility)

### Mid-session knowledge opportunity prompts

Brain surfaces suggestion cards when the DM explicitly marks an NPC as "in play" from the NPC panel. One card per NPC-in-play who holds unrevealed secrets. Card shows the highest-priority unrevealed secret for that NPC (isCritical first).

Trigger: explicit "Mark in play" button in the NPC panel tab. Note-scanning / transcript detection is a post-Phase-3 enhancement — not in scope here.

### Post-session sync

Background BullMQ job (`secret-revelation-sync`) runs after session wrap:
1. Queries all `SecretRevelation` with `syncedToGraph: false` for the session
2. For each: creates `WorldEntity(type: SECRET)` if it doesn't exist, creates `WorldRelationship(type: "revealed_to_players")` from player party entity to secret entity
3. Sets `syncedToGraph: true`

Brain then generates a post-session summary: revealed vs missed secrets, knowledge gaps, hooks for next session based on what players are missing.

Missed secrets persist on `PrepSecret.isRevealed: false` and surface automatically in the next session brief as "carried over."

---

## PDF Import Pipeline

### Flow

1. **Upload** — PDF attached to session via existing R2 upload. R2 key stored as `Session.prepDocKey` (new nullable String field). Docling extracts raw text (same pipeline as homebrew PDF).

2. **Extract** — Single Claude call with the extracted text. Returns structured JSON matching a Zod schema covering all six feature types. Prompt instructs Claude to identify: session intent, NPCs with behavioral profiles, secrets with assignments and reveal conditions, phases with time budgets, routes with benefits/risks.

3. **Review UI** — A shadcn Sheet opens with extracted items grouped by type (Intent / NPCs / Secrets / Phases / Routes). Each item has accept / edit / discard. Accepted items are shown with a green check; discarded are greyed out. DM can edit any field inline before confirming.

4. **Confirm + write** — "Confirm import" button writes all accepted items to prep models in a single tRPC mutation (`sessions.confirmPdfImport`). Existing data is never silently overwritten — always additive. If a PrepSecret with the same name exists, DM is prompted to merge or create new.

5. **NPC linking** — Extracted NPC names are fuzzy-matched against existing campaign `WorldEntity` records. Matches shown with a "link to existing?" prompt. Confirmed links create `NpcBehaviorProfile` on the existing entity. Unmatched NPCs create new `WorldEntity(type: NPC)` + `NpcBehaviorProfile`.

### Extraction Zod schema (high-level)

```ts
const extractionSchema = z.object({
  intentBrief: z.object({
    toneKeywords: z.array(z.string()),
    playerGoals: z.array(z.string()),
    dmOnlyTruths: z.array(z.string()),
  }),
  phases: z.array(z.object({
    name: z.string(),
    targetMinutes: z.number(),
    notes: z.string().optional(),
  })),
  routes: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    benefits: z.array(z.string()),
    risks: z.array(z.string()),
  })),
  npcs: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    defaultBehavior: z.string().optional(),
    triggeredBehaviors: z.array(z.object({ condition: z.string(), behavior: z.string() })),
    criticalDialogue: z.array(z.object({ line: z.string(), trigger: z.string() })),
    secrets: z.array(z.object({
      content: z.string(),
      revealCondition: z.string().optional(),
      isCritical: z.boolean().default(false),
    })),
  })),
});
```

---

## Build Order

Phase 1 — Foundation (schema + basic prep UI):
- Prisma migration for all new models
- `Session.intentBrief` JSON field
- `SessionPhase`, `SessionRoute` tRPC routers + prep UI sections
- `PrepSecret`, `PrepKnowledge` routers + Secrets Web prep section

Phase 2 — NPC depth + cockpit:
- `NpcBehaviorProfile` model + NPC sheet behavioral tabs
- Cockpit right-edge tab strip component
- NPC panel + Secrets panel + Routes panel + Phases panel + Brief panel
- `SecretRevelation` logging from cockpit panels

Phase 3 — Brain integration:
- `secret-revelation-sync` BullMQ worker
- Pre-session briefing generation (`sessions.generateBriefing` extended)
- Mid-session suggestion card (NPC-active trigger + Brain query)
- Post-session summary generation

Phase 4 — PDF import:
- Session document upload (R2)
- Claude extraction tRPC mutation (`sessions.extractPdfPrep`)
- Review UI sheet
- `sessions.confirmPdfImport` mutation with NPC linking

---

## Constraints

- Brain suggestions are non-blocking — never interrupt the DM, always dismissable
- PDF import is always additive — never silently overwrites existing prep data
- `SecretRevelation` sync is async (BullMQ) — DM is never blocked waiting for graph update
- NpcBehaviorProfile is optional — existing NPCs without profiles still work in all cockpit views
- PrepSecret campaign scope means secrets authored in session 3 can be carried forward and re-surfaced in session 7 automatically
