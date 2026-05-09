# Session Prep Redesign — World Briefing Board

**Date:** 2026-05-09
**Status:** Approved

---

## Problem

The current prep page is a direct digitization of the Sly Flourish "Lazy DM" 7-point checklist: Strong Start, Scenes, Secrets & Clues, NPCs, Monsters, Rewards, Loose Threads — each a blank textarea. QuiverDM's DM Brain already holds live world state (faction urgency, NPC loyalty changes, unresolved hooks, WorldStateChange history). The current prep surface ignores all of it, asking the DM to fill in blanks that the Brain could already answer.

## Direction

Replace the checklist entirely with a **World Briefing Board**: Brain generates a mission-briefing-style set of pressure point cards before the DM arrives. Each card has Brain's proposed scene/encounter/NPC move already attached. The DM's job is to accept, edit, or dismiss — not fill in blank fields.

## Surface Taxonomy

The prep page has three zones, top to bottom:

### 1. Session Header
- Session name and number
- Brain Briefing badge with live dot animation and "N pressure points · generated just now"
- Session date/time

### 2. Pressure Board
The primary work surface. Brain generates 3–7 pressure point cards, sorted by urgency (critical → high → medium). Each card:

**Card anatomy:**
- Top bar: 2px color strip indicating urgency (red = critical, amber = high, blue = medium)
- Type badge: FACTION / HOOK / NPC / REGION (color-coded)
- Entity name (Cinzel, prominent)
- Urgency pips: 5 dots, filled to match urgency level
- Context blurb: 2–3 sentences of what Brain knows (world state summary for this entity/hook)
- "Brain proposes" divider + proposal block: Brain's specific scene/encounter/NPC move suggestion (3–5 sentences, italic-styled block)
- Actions: **Use this** · **Edit** · **Dismiss**

**Card states:**
- **Proposed** (default) — full card visible with proposal and action buttons
- **Accepted** — collapses to compact row: checkmark · entity name · type badge · "In Play" annotation · one-line DM summary
- **Edited** — DM rewrote the proposal; accepted state shows "DM edited" label instead of "Brain proposes"
- **Dismissed** — grayed, collapsed, "Undo" available; counts as reviewed
- **DM Added** — no urgency pips, no Brain proposal block; just DM's text and In Play badge once saved

**Edit interaction:** clicking "Edit" turns the proposal text into an inline editable field — no sheet, no modal. DM rewrites, clicks "Use this" to accept their version.

**DM Adds:** a "+ Add something Brain missed" button at the bottom of the board opens a simple textarea. No structure imposed. Saves as a DM-added card.

**Ready to Run gate:** the footer CTA unlocks only when every card is in a terminal state (accepted, edited-accepted, or dismissed). Footer shows: "2 of 3 reviewed" as DM progresses.

### 3. Party State
A simpler section below the pressure board. Auto-filled by Brain from session history via the existing `contextQuery`. Per-PC fields: goals, current notes. DM edits freely — no Accept/Dismiss mechanism. Same character notes the current prep surface carries, Brain pre-fills where it can.

### Import Zone
The existing import zone (paste notes / upload PDF) remains but is rephrased: "Brief Brain with your notes." After import, Brain processes the raw text and either adds new pressure cards or enriches existing ones. Collapses to a single-line "Import notes" bar when not active — same collapsed behaviour as the current `PrepImportZone`.

---

## Data Model

### Generation
A new tRPC procedure `sessions.generateBriefing` reads from:
- `WorldEntity` + `WorldRelationship` — faction nodes, NPC nodes, urgency scores
- `WorldStateChange` — changes flagged as unaddressed since the last session
- Unresolved hooks at or past their decay threshold
- `contextQuery` characters for party state

The procedure invokes the AI layer (same multi-provider pattern as `extractPrepFromNotes`) with a structured world state payload, receiving back a `BriefingCard[]` array — each card with `type`, `entityName`, `urgencyLevel`, `context`, and `proposal` fields.

Generation triggers on-demand when the DM opens the prep page. A "Regenerate" button refreshes if world state has changed since last open.

### Storage
No new Prisma model. Accepted/edited/dismissed state and DM-added cards are stored in the existing `prepData` JSON field on the `Session` model. The `SessionPrepData` Zod schema gains a `briefingCards` array alongside the existing fields, which are retained for backward compatibility during the transition.

### Backward Compatibility
Sessions with existing `prepData` (the old checklist format) display the old interface. Sessions created after the redesign get the briefing board. The `prepStatus` field continues to drive the Ready to Run gate.

---

## Removed

- **Lazy DM 7-section structure** — Strong Start, Scenes, Secrets & Clues, NPCs, Monsters, Rewards, Loose Threads sections removed as primary structure. These concepts survive as possible *types* of Brain proposals, not as explicit fixed sections the DM must fill.
- **Blank textareas** — no empty fields anywhere on the prep surface.
- **Section navigation sidebar** — the left-rail section nav in `PrepWorkspace` is removed (already hidden in inline mode; now removed entirely).

---

## Files to Create

```
src/server/routers/sessions.ts                        # add generateBriefing procedure
src/lib/briefing-types.ts                             # BriefingCard type + BriefingCardSchema
src/components/session/prep/briefing-board.tsx        # top-level board component
src/components/session/prep/pressure-card.tsx         # single card (all states)
src/components/session/prep/party-state-section.tsx   # character notes section
tests/workflows/session-prep-briefing.workflow.spec.ts
```

## Files to Modify

```
src/components/session/prep/prep-workspace.tsx        # replace section grid with BriefingBoard + PartyStateSection
src/components/session/phase-prep.tsx                 # no structural changes; PrepWorkspace already receives campaignId
src/app/(app)/campaigns/[slug]/sessions/prep/page.tsx # no structural changes
src/lib/prep-types.ts                                 # add briefingCards to SessionPrepData schema
```

## Files to Delete

```
src/components/session/prep/prep-section-card.tsx     # replaced by PressureCard
src/components/session/prep/sections/                 # all section components (strong-start, scenes, secrets, npcs, monsters, rewards, threads)
```

---

## Self-Review

- **No TBD:** all sections specify concrete behaviour, types, and files
- **Internal consistency:** data model (generateBriefing → BriefingCard[]) matches UI (PressureCard props); storage (prepData JSON) consistent with existing pattern
- **Scope:** one surface (session prep), one new procedure, no new Prisma models — appropriately bounded
- **Ambiguity resolved:** backward compatibility (old sessions keep old UI) prevents data migration risk; "Edit" is inline not modal (confirmed in design session)
