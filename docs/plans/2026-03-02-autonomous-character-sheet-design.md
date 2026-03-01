# Autonomous Character Sheet — Design

**Date:** 2026-03-02
**Status:** Approved

## Overview

Fully autonomous character sheet system. Homebrew items, spells, and feats carry structured mechanical effects that actually modify character stats. During a session, the transcript drives real-time character state updates (HP, conditions, spell slots, active buffs). Post-session, the DM reviews and commits all events to character sheets permanently.

Two phases, each independently shippable.

---

## Phase 1: Effect Schema + AI Extraction + Live Effects

### Effect Schema Expansion

`ItemEffectMechanicSchema` in `src/lib/dnd-schemas.ts` is expanded. Same `effects` structure is added to `SpellSchema` and `FeatSchema` (currently neither has structured mechanics).

**New mechanic types added:**
- `spell_attack_bonus` — bonus to spell attack rolls
- `save_dc_bonus` — bonus to spell save DC
- `skill_bonus` — bonus to a specific skill (target: "perception")
- `saving_throw_bonus` — bonus to a specific saving throw (target: "constitution")
- `initiative_bonus` — flat bonus to initiative
- `speed_bonus` — flat bonus to speed
- `max_hp_bonus` — flat bonus to max HP
- `concentration_advantage` — advantage on concentration saves
- `death_save_advantage` — advantage on death saving throws

**New fields on every effect:**
- `activation`: `'passive' | 'concentration' | 'action' | 'bonus_action' | 'reaction'`
- `duration`: `string | null` — e.g. `"1 minute"`, `"until long rest"`, `"permanent"`
- `uses`: `{ max: number, per: 'long_rest' | 'short_rest' | 'day' } | null`

No new Prisma models. Effects still stored in `HomebrewContent.data.effects` JSON.

### AI Extraction Pipeline

**Trigger:** any homebrew create or update — manual, PDF import, DnD Beyond import, photo/notes import. Runs in the existing extraction pipeline pass.

**Prompt update:** `src/lib/ai/extraction.ts` EXTRACTION_PROMPT is updated to explicitly request an `effects` array for items, spells, and feats with the full mechanic vocabulary and examples.

**Confirmation UI:** After extraction, if mechanics were detected, the homebrew create/edit form shows a collapsible "Detected Mechanics" panel before saving:
- Each effect listed with type, value, target, activation, duration
- Inline edit: type, value, target fields editable
- Remove incorrect effects, add missing ones
- "Looks right" → saves; effects stored in `HomebrewContent.data.effects`

### Effect Resolver Service

New `src/server/services/effect-resolver.ts`:
- Input: characterId + userId
- Fetches: equipped items, prepared spells (active/toggled), feats
- Stacks all effects, returns resolved effective stats:
  - `effectiveAc`, `attackBonusBreakdown`, `saveBonusByType`, `resistances`, `immunities`, `skillBonuses`, `speedBonus`
  - Each stat includes a breakdown array: `[{ source: "Sword of Warning", value: 2, type: "attack_bonus" }]`
- Replaces the simple `getEquippedEffects` query path

### Character Sheet Integration

- `CharacterActiveEffects` component updated to pull from the resolver (not just equipped items)
- New `ResolvedStatsSummary` component: computed effective stats with breakdown tooltips on hover
- Spells and feats can be toggled active/inactive from the character sheet (stored in character data JSON)

---

## Phase 2: Session Event Pipeline

### New Prisma Models

```prisma
model SessionMechanicalEvent {
  id                  String    @id @default(cuid())
  session             Session   @relation(fields: [sessionId], references: [id])
  sessionId           String
  character           Character? @relation(fields: [characterId], references: [id])
  characterId         String?
  characterName       String?   // raw name from transcript before fuzzy match
  transcriptSegmentId String?
  eventType           String    // see event types below
  eventData           Json      // event-specific payload
  confidence          Float     @default(1.0)
  status              String    @default("pending") // pending | auto_applied | confirmed | rejected
  createdAt           DateTime  @default(now())
  appliedAt           DateTime?

  @@index([sessionId, status])
  @@index([characterId])
}

model CharacterSessionState {
  id               String    @id @default(cuid())
  session          Session   @relation(fields: [sessionId], references: [id])
  sessionId        String
  character        Character @relation(fields: [characterId], references: [id])
  characterId      String
  currentHp        Int
  tempHp           Int       @default(0)
  spellSlotsUsed   Json      @default("{}") // { "1": 2, "2": 1 }
  conditionsActive Json      @default("[]") // ["Blessed", "Poisoned"]
  activeSpells     Json      @default("[]") // [{ name, casterId, concentration, duration }]
  resourcesUsed    Json      @default("{}") // { "bardic_inspiration": 2 }
  updatedAt        DateTime  @updatedAt

  @@unique([sessionId, characterId])
}
```

**Event types:** `damage`, `healing`, `condition_applied`, `condition_removed`, `spell_cast`, `spell_applied`, `spell_expired`, `spell_slot_used`, `resource_used`, `death_save_success`, `death_save_failed`, `inspiration_gained`, `short_rest`, `long_rest`

### Session Events Worker

New BullMQ worker: `session-events-worker` / queue: `session-events`

**Trigger:** existing transcription pipeline enqueues a job after each transcript segment batch is saved. Also triggerable on-demand from the cockpit.

**Processing:**
1. Fetch new transcript segments since last processed segment for the session
2. AI prompt extracts structured events — character names, event types, values
3. Fuzzy-match character names to campaign characters (Levenshtein distance on `characters.name`)
4. Confidence thresholds:
   - ≥ 0.90 → `auto_applied`, `CharacterSessionState` updated immediately
   - 0.60–0.89 → `pending`, surfaced in cockpit for DM review
   - < 0.60 → discarded

**Example extractions:**
- `"Bram casts Bless on Aeryn and Kira"` → `spell_applied`, targets: [Aeryn, Kira], concentration: true, duration: "1 minute"
- `"Aeryn takes 14 slashing damage"` → `damage`, target: Aeryn, amount: 14, damageType: slashing
- `"Thorn expends a 3rd level slot"` → `spell_slot_used`, character: Thorn, level: 3
- `"Kira fails her Constitution saving throw"` → `save_failed` → triggers concentration break check if Kira has concentration active
- `"everyone takes a short rest"` → `short_rest`, all session characters recover short rest resources

### Cockpit Integration

- `PartyOverviewPanel` pulls `CharacterSessionState` instead of base character stats — HP bars, conditions, active spells reflect live session state
- Events badge in cockpit header: count of pending events needing DM review
- Expanding shows compact queue: character portrait + event description + "Apply / Skip" inline controls

### Post-Session Review

After "End Session", new "Review Events" step before the summary:
- Auto-applied events: collapsed summary ("23 events auto-applied") with expand
- Pending events: card list with approve / edit / reject per event
- "Commit to Sheets" button writes confirmed + auto-applied events to `Character` records permanently
- Implemented as a new "Session Events" tab on the session detail page

### Character Sheet Audit Trail

After commit:
- `Character.hitPoints`, spell slots, and conditions updated to reflect session outcome
- Each committed change references its `SessionMechanicalEvent.id` — full audit trail (e.g. "HP reduced by 14, Session 7, segment 23")

---

## File Map

### Phase 1

| File | Change |
|------|--------|
| `src/lib/dnd-schemas.ts` | Expand `ItemEffectMechanicSchema`, add effects to `SpellSchema` + `FeatSchema` |
| `src/lib/ai/extraction.ts` | Update EXTRACTION_PROMPT to request effects array for all homebrew types |
| `src/server/services/effect-resolver.ts` | New — resolves effective stats from equipped/active homebrew |
| `src/server/routers/characters.ts` | Add `getResolvedStats` query using effect resolver |
| `src/components/homebrew/EffectConfirmationPanel.tsx` | New — shows detected mechanics before save, editable |
| `src/components/character/CharacterActiveEffects.tsx` | Update to use resolver output |
| `src/components/character/ResolvedStatsSummary.tsx` | New — computed effective stats with breakdown tooltips |

### Phase 2

| File | Change |
|------|--------|
| `src/prisma/schema.prisma` | Add `SessionMechanicalEvent` + `CharacterSessionState` models |
| `src/lib/queue/session-events-queue.ts` | New BullMQ queue |
| `src/lib/queue/session-events-worker.ts` | New worker — transcript → event extraction |
| `src/lib/ai/session-event-extractor.ts` | New — AI prompt for mechanical event extraction |
| `src/server/services/session-state.service.ts` | New — apply events to `CharacterSessionState` |
| `src/server/routers/sessions.ts` | Add `getCharacterSessionStates`, `reviewEvents`, `commitEvents` |
| `src/components/cockpit/PartyOverviewPanel.tsx` | Update to use `CharacterSessionState` |
| `src/components/cockpit/PendingEventsQueue.tsx` | New — inline event review in cockpit |
| `src/components/session/SessionEventsReview.tsx` | New — post-session review tab |
| `package.json` | Add `worker:session-events` script |
