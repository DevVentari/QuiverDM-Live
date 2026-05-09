# Session Prep — Map-Canvas Briefing Board — Design

> **Status:** Brainstormed 2026-05-09.
> **Implementation plan:** `docs/superpowers/plans/2026-05-09-session-prep-map-canvas-impl.md` (to be written)

---

## Context

The current session prep page (`src/components/session/prep/`) is a 2-column layout: Party State (left) + World Pressure briefing cards (right) with an Import Zone above. It works, but the briefing cards are spatially abstract — a card says "bandit ambush" but the DM has no map context for *where*. The campaign already has a real world-map (`src/components/world/world-map-canvas.tsx`) backed by `MapPin` rows in Postgres, but prep and the map are isolated surfaces today.

The user wants prep to BE spatial: the map is the prep canvas. Briefing cards live as glowing pins on the map, layered over the persistent world map. Brain places what it can; the DM refines. This makes "what's happening tonight, where" a single coherent view instead of two screens to cross-reference.

The codebase is well-positioned for this:
- `MapPin` Prisma model exists and resolves to `WorldEntity`
- `world-map-canvas.tsx` already implements pan/zoom/pin rendering via React Flow
- `generateBriefing` already pulls `WorldEntity` rows from `brainRepository` — adding `mapPins` to that query is one line
- `BriefingCard` JSON shape can extend with `entityId` + `mapCoords` without schema changes (it's stored in `SessionPrepData` JSON)

What's missing: a visual overlay layer for briefing pins, the binding between cards and entities, the cinematic zoom-on-click interaction, and the rail for non-spatial cards.

## Locked decisions (from brainstorm 2026-05-09)

| # | Decision | Choice |
|---|---|---|
| 1 | Map role on prep page | **Map as the prep canvas** — the map IS the prep surface; briefing cards are pins on it |
| 2 | Non-spatial cards (HOOK, FACTION, abstract pressure) | **Edge rail beside the map** — vertical rail on the right |
| 3 | Party State placement | **Bottom strip** — horizontal strip across the bottom of the map |
| 4 | Pin click interaction | **Map zooms + card opens inline** — cinematic focus, one card at a time, click "back" to return |
| 5 | Initial pin placement | **Brain auto-places everything it can** — unplaceable cards fall to the rail; DM can drag rail → map |
| 6 | Persistence model | **Session overlay layer** — briefing pins are a separate visual layer over the persistent world map; accept = promote to permanent MapPin; dismiss / Ready-to-Run-without-accept = vanish |

## North star

> Open prep, see your world. Brain has lit up the locations where pressure is building tonight. Click a glowing pin, the world zooms in, the briefing card opens. Accept it, dismiss it, or drag a faction stirring from the rail onto the map. When you hit Ready to Run, the canon updates with what stuck.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ◀ Back to home    Phase: PREP    [Save status]   Mark Ready │  ← header (existing)
├──────────────────────────────────────┬───────────────────────┤
│                                      │  WORLD PULSE          │
│                                      │  ─────────────        │
│         MAP CANVAS                   │  ┌─────────────┐      │
│         (React Flow)                 │  │ FACTION card│      │
│                                      │  └─────────────┘      │
│   ✦ briefing pin (glowing amber)     │  ┌─────────────┐      │
│   ◉ canon pin (stone)                │  │ HOOK card   │      │
│   ◯ canon pin lit by briefing        │  └─────────────┘      │
│                                      │  ┌─────────────┐      │
│                                      │  │ PRESSURE    │      │
│         (pannable, zoomable)         │  └─────────────┘      │
│                                      │                       │
│                                      │  + Import notes       │
├──────────────────────────────────────┴───────────────────────┤
│  PARTY STATE (horizontal strip)                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                         │
│  │ PC 1 │ │ PC 2 │ │ PC 3 │ │ PC 4 │  ← click expands notes  │
│  └──────┘ └──────┘ └──────┘ └──────┘                         │
└──────────────────────────────────────────────────────────────┘
```

Mobile: stack — map (full-bleed) → swipeable rail (bottom sheet) → party strip (bottom). Pin click still triggers cinematic zoom; rail becomes a pull-up sheet.

## Pin visual language

Three pin states need to be visually distinct on a single map:

| Pin kind | Visual | Origin |
|---|---|---|
| **Canon pin** (existing MapPin) | Stone-toned, solid border, no glow | The persistent world map. Renders even when not relevant to tonight. |
| **Briefing pin** (briefing card auto-placed onto existing entity) | Stone base + amber glow halo + type-color icon overlay | An existing canon pin that's relevant tonight. Glows because Brain surfaced it. |
| **Proposed pin** (briefing card with no existing MapPin) | Translucent amber, dashed border, type icon, subtle pulse | Brain proposed a new location. Visually unconfirmed. Click → can promote to canon on accept, or leave ephemeral. |
| **Accepted pin** (in-session, post-accept) | Solid amber → fades back to stone after a moment | Brief celebration animation, then settles in as canon. |
| **Dismissed pin** | Fades out + ink-spread inward | Click back → vanishes. Does not write to MapPin. |

Color uses the existing `TYPE_META` (FACTION/NPC/HOOK/REGION) for icon tint; the glow halo is amber (`oklch(0.7 0.16 55)`) regardless of type — amber is the "this is happening tonight" signal.

## Card → pin lifecycle

```
generateBriefing produces 5-7 BriefingCard objects
        │
        ▼
For each card:
  1. Resolve entityId  ─── matched against WorldEntity by name + type ───┐
  2. If entityId AND has MapPin → spatial: render pin at MapPin.x,y      │
  3. If entityId, no MapPin    → spatial-pending: Brain proposes coords  │
  4. If no entityId            → non-spatial: rail card                  │
                                                                          ▼
                                                            BriefingCard
                                                            ─────────────
                                                            id, type, entityName,
                                                            entityId? (NEW),
                                                            mapCoords? (NEW: { mapId, x, y, placement: 'auto' | 'proposed' | 'rail' }),
                                                            urgencyLevel, context, proposal,
                                                            status, dmNote?
        │
        ▼
DM clicks pin → map.zoomTo(coords) → inline card opens
        │
        ▼
Accept ─→ writes MapPin row (if didn't exist) + flags card.status='accepted'
Edit   ─→ stores card.dmNote
Drag   ─→ updates card.mapCoords
Dismiss → card.status='dismissed' (rendered greyed/faded; no MapPin write)
        │
        ▼
DM clicks "Mark Ready to Run":
  - All accepted cards with mapCoords AND no existing MapPin → create MapPin
  - All accepted cards with existing MapPin → update MapPin.lastEventAt = now
  - All briefing pins fade to stone (canon visual)
  - Session.status flips to in_progress
```

`SessionEntityAppearance` rows are written for every accepted card with an `entityId` — this is the existing join table and makes `WorldEntity.lastSeenSessionId` accurate post-prep.

## Brain placement logic

`generateBriefing` (`src/server/routers/sessions.ts:561`, `src/lib/ai/generate-briefing.ts`) needs three changes:

1. **`brainRepository.findEntities` returns `mapPins`** — `include: { mapPins: { select: { mapId: true, x: true, y: true } } }`. One-line change to the repository query.
2. **Briefing prompt receives entity location context** — for each entity passed to the LLM, include `"located at: <region name> (mapId:..., x, y)"` if a pin exists. Lets the LLM produce semantically-grounded HOOKs ("on the road from Greentown" instead of "somewhere").
3. **Briefing schema gains `entityId` + `mapCoords`** — Zod schema accepts these as optional outputs. The LLM is told: "If this card concerns a known entity, return its `entityId`. If you can confidently anchor it to a location, return `mapCoords`."

**Auto-placement rules (deterministic, post-LLM):**
- Card has `entityId` matching a `WorldEntity` with at least one `MapPin` → place on first matching pin.
- Card has `entityId` but no `MapPin` → if LLM returned `mapCoords`, mark `placement: 'proposed'` and render translucent.
- Card has no resolvable `entityId` → falls to the rail.
- Cards with `type === 'HOOK'` and no entity → always rail (HOOKs are abstract by default).
- Cards with `type === 'REGION'` without coords → rail.

**Non-spatial cards in the rail are draggable.** Drop on map → auto-write `mapCoords`, status stays `proposed` until accepted.

## Implementation surfaces

### Files to MODIFY

| File | Change |
|---|---|
| `src/lib/briefing-types.ts` | Extend `BriefingCard` with optional `entityId: string`, `mapCoords: { mapId, x, y, placement: 'auto'\|'proposed'\|'rail' }`. Keep all existing fields. |
| `src/lib/ai/generate-briefing.ts` | Update Zod output schema to accept `entityId` + `mapCoords`. Update prompt to include entity location context and request location anchoring when confident. |
| `src/server/repositories/brain.repository.ts` | `findEntities` includes `mapPins: { select: { mapId, x, y } }`. |
| `src/server/routers/sessions.ts` (`generateBriefing` ~line 561) | Pass entity location data to the AI function; post-process LLM output to apply auto-placement rules. |
| `src/server/routers/sessions.ts` (`completePrep` or new mutation) | On Mark Ready: for each `accepted` card with `mapCoords`, upsert `MapPin`; create `SessionEntityAppearance` for entityId. |
| `src/components/session/prep/prep-workspace.tsx` | Restructure layout: replace 2-col grid with map-canvas + right rail + bottom strip. |
| `src/components/session/prep/briefing-board.tsx` | Renamed/reshaped — becomes the right rail (non-spatial cards only). Spatial cards now belong to `<PrepMapCanvas>`. |
| `src/components/session/prep/party-state-section.tsx` | Restyle as horizontal strip with collapsed-by-default character cards (click to expand notes). Currently grid-style. |

### Files to CREATE

| File | Purpose |
|---|---|
| `src/components/session/prep/prep-map-canvas.tsx` | The map surface. Wraps a tailored React Flow instance. Renders canon pins (read-only) + briefing pins (interactive overlay). Handles cinematic zoom-on-pin-click. |
| `src/components/session/prep/briefing-pin.tsx` | Custom React Flow node for a briefing pin. Three visual states: spatial-on-canon (glow halo), proposed (translucent dashed), accepted (solid → fade). |
| `src/components/session/prep/briefing-pin-card.tsx` | The inline card that opens after zoom. Reuses the body of current `pressure-card.tsx` but in a positioned overlay pinned to the focused pin. |
| `src/components/session/prep/prep-import-button.tsx` | Replaces the always-visible Import Zone with a small button at the top of the right rail (`+ Import notes`) — opens an existing `<PrepImportZone>` in a sheet. |
| `tests/workflows/session-prep-map.workflow.spec.ts` | E2E: prep page loads with map, Brain auto-places pins, click pin zooms + opens card, accept persists MapPin, Ready-to-Run flips session. |

### Files we KEEP AS-IS

- `pressure-card.tsx` — body content (proposal, urgency, accept/edit/dismiss buttons) is reused inside `briefing-pin-card.tsx`. Extract the inner JSX into a shared component if needed.
- `prep-import-zone.tsx` — moved from inline to inside a sheet, but the component itself doesn't change.
- `world-map-canvas.tsx` — untouched; we don't reuse it directly. The prep map is a tailored, simpler React Flow surface (no toolbar, no sub-map navigation, no entity sidebar).

### Reuse decision: tailored prep map vs. embedded `world-map-canvas`

**Recommendation: tailored prep map.** `world-map-canvas.tsx` is built around an editing toolbox (`map-toolbar.tsx`, `location-panel.tsx`, sub-map breadcrumbs, AI background generation). Embedding it in prep would carry visual baggage we'd then have to suppress with conditional props. A tailored 200-line `prep-map-canvas.tsx` reusing the same React Flow primitives is cleaner and gives prep its own interaction model (glow halos, cinematic zoom, click-back gesture) without contaminating the canon-editing surface.

Trade-off: pin-position-dragging logic gets duplicated. Mitigation: extract the position update into `src/lib/world-map/use-pin-drag.ts` (new) used by both surfaces. Worth doing as part of impl.

## Open assumptions flagged for spec review

1. **Multiple maps per campaign** — `CampaignMap` supports sub-maps via `parentLocationId`. Assumption: prep shows ONE map (the campaign root map by default; user can switch via a dropdown if multiple exist). Confirm this is OK for v1, or if we need a multi-map prep view.
2. **What happens if there are zero `WorldEntity` rows yet** — fresh campaign, Brain has no world to draw from. Assumption: map renders blank backdrop, all cards fall to rail, DM places manually. The current empty-state copy ("No world data yet — Brain has no pressure points to surface") still applies.
3. **PCs as pins** — option C from the Party State question said "PCs as pins on the map." The user picked bottom strip instead. Assumption: PCs are NOT pins in v1; party state stays in the bottom strip. A "Where's the party?" pin could be a v2 add.
4. **Existing prep features kept** — the "Add something Brain missed" textarea (`briefing-board.tsx:147`) and "Regenerate" button stay in the right rail header.
5. **Mobile** — pin click → bottom-sheet card, not zoom-and-overlay. Pannable map. Bottom strip becomes a third bottom sheet. Assumption: this is fine for v1; full mobile polish can be a follow-up slice.
6. **Performance** — React Flow handles ~hundreds of nodes well, but a campaign with 200+ canon pins + 7 briefing pins + active animations may hit budget. Assumption: viewport culling + transform-only animations keeps it smooth on a mid-tier laptop. If needed, virtualize off-viewport pins.

## Verification path

End-to-end test (`tests/workflows/session-prep-map.workflow.spec.ts`):

1. Seed: campaign with one map, 4 WorldEntities (1 NPC with pin, 1 FACTION with pin, 1 LOCATION with pin, 1 abstract HOOK source).
2. Open new session → prep phase → assert map renders with 3 stone pins.
3. Trigger `generateBriefing` (or use deterministic mock) returning 4 cards: 1 NPC card, 1 FACTION card, 1 HOOK card with proposed coords, 1 abstract HOOK with no coords.
4. Assert map shows: NPC pin + FACTION pin glow with amber halos; new proposed HOOK pin appears translucent at coords; abstract HOOK appears in right rail.
5. Click NPC pin → assert map smoothly zooms to coordinates, briefing card opens inline.
6. Click "Use this" → card status flips to accepted, pin briefly pulses solid amber.
7. Drag abstract HOOK from rail onto map → assert pin appears as proposed, rail card disappears.
8. Click "Mark Ready to Run" → assert: (a) accepted-card MapPins are upserted in DB, (b) `SessionEntityAppearance` rows exist for accepted entityIds, (c) session status is `in_progress`, (d) briefing pin layer fades to canon.

Persona suite: `veteran-dm` (Vic) is the primary persona for this flow — extend `tests/personas/veteran-dm.persona.spec.ts` with a "spatial briefing" checkpoint.

Visual regression: Playwright screenshot diff of the prep page before/after for the touched routes (`/session/[id]?phase=prep`).

A11y: pin click target must be ≥44px. Keyboard: `Tab` cycles spatial pins → rail cards → party strip. `Enter` on a focused pin triggers zoom-and-open. Escape collapses the inline card.
