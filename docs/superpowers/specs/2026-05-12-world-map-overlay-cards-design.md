# World Map Overlay Cards — Design Spec

**Date:** 2026-05-12
**Status:** Approved

## Context

The world map page is now a full-screen ReactFlow canvas. The DM stares at this map during session prep and mid-session — it should be the command centre for the campaign, not just a pin editor. Adding floating glass cards turns the map into a live dashboard: session status, party health, key NPCs, quests, locations, and activity all visible without navigating away.

Clicking a location pin scopes the content cards to that location — NPCs present there, quests tied to it, recent activity at it. The map becomes spatially aware.

## Layout

Six floating cards overlay the map canvas. All use the existing glass card design (dark gradient bg, amber border, backdrop-blur).

```
┌────────────────────────────────────────────────────┐
│ [map-name chip]                    [stats chip]    │
│                                                    │
│ ┌──────────────┐              ┌──────────────────┐ │
│ │ Session      │              │ NPCs             │ │
│ │ card         │   MAP        │                  │ │
│ └──────────────┘              ├──────────────────┤ │
│   [toolbar]                   │ Quests           │ │
│                               │                  │ │
│                               └──────────────────┘ │
│ ┌──────────────┐ ┌──────────┐ ┌──────────────────┐ │
│ │ Locations    │ │ Party    │ │ Activity /       │ │
│ │              │ │          │ │ Today's Plan     │ │
│ └──────────────┘ └──────────┘ └──────────────────┘ │
└────────────────────────────────────────────────────┘
```

## Card Specs

### Top-left: Session Card
- Campaign name (overline)
- Next upcoming session: title, date, time, location
- "Open Session →" button
- If no upcoming session: "No session scheduled" empty state with "Plan Session" CTA
- **Data:** `trpc.sessions.getAll` — take first with status `planned`, sorted by date

### Top-right: NPCs
- List of 4 NPCs, avatar initial + name + race/role
- "View all →" link to `/campaigns/[slug]/npcs`
- **Default (no pin selected):** most recently created/updated NPCs
- **Pin selected:** NPCs whose `location` property matches the selected entity name
- **Data:** `trpc.npcs.getAll` with `campaignId`, client-side filter by location when pin active

### Middle-right: Quests
- List of 3 quests, icon + name + status badge
- "View all →" link
- Uses `EncounterPlan` records as quest proxies — name + difficulty as status (trivial/easy = "Minor", medium/hard/deadly = "Active Threat")
- **Pin selected:** filter to plans whose `sceneDescription` references the selected location name (fuzzy, best-effort)
- **Data:** `trpc.encounters.list` — first 3 by createdAt desc

### Bottom-left: Recent Locations
- 3 location pins from the current map — icon + name + type
- Sorted by `lastEventAt` desc (most recently touched)
- Clicking a location row selects that pin on the map (sets `selectedEntityId`)
- **Data:** derived from `mapData.pins` already loaded in canvas — filter type `LOCATION`

### Bottom-center: Party
- 4 members, avatar + name + class/level + HP bar
- HP derived from character sheet data if available, else omit bar
- "Manage →" link to `/campaigns/[slug]/characters`
- **Data:** `trpc.members.list` with character join, or `trpc.characters.list`

### Bottom-right: Activity / Today's Plan
- **When active session exists:** shows `world.getRecentActivity` — last 4 events (entity name, event type, time ago)
- **When no active session:** shows prep checklist from next session's `prepData` — checkbox list, toggle-able via `sessions.updatePrep` mutation
- Toggle is automatic based on whether `sessions.getActive` returns a session
- **Data:** `trpc.world.getRecentActivity` + `trpc.sessions.updatePrep`

## Pin Selection → Card Scoping

`selectedEntityId` already exists in `WorldMapCanvas` state. When set:
- NPCs card filters to NPCs at that location
- Quests card filters to plans referencing that location
- Activity card filters to `WorldStateChange` records where `entityId === selectedEntityId`
- LocationPanel (existing slide-in) also appears for full detail

When no pin is selected: all cards show campaign-wide data.

## Component Architecture

```
world-map-canvas.tsx
  └─ WorldMapOverlay (new — src/components/world/world-map-overlay.tsx)
       ├─ SessionCard
       ├─ NpcCard
       ├─ QuestCard
       ├─ LocationsCard
       ├─ PartyCard
       └─ ActivityCard
```

`WorldMapOverlay` receives:
- `campaignId: string`
- `slug: string`
- `selectedEntityId: string | null`
- `selectedEntityName: string`
- `locationPins: MapPin[]` (from mapData.pins, already loaded)
- `onSelectLocation: (entityId: string, name: string) => void`

All data fetching lives inside `WorldMapOverlay` and its children. Canvas stays clean.

## Styling

- All cards: `position: absolute`, glass card pattern already in app
- Max width: 240–280px per card
- `pointer-events: none` on the overlay wrapper; `pointer-events: auto` on each card
- Cards use `z-index: 10`, toolbar uses `z-index: 20` (toolbar stays on top)
- Cards collapse gracefully at narrow viewports (hide bottom row below 900px height)

## What's Not Included

- Drag-to-reposition cards (future)
- Card collapse/hide toggles (future)
- "Today's Plan" as a separate always-on card (deferred — replace pattern chosen)
- Quests as a first-class model (using EncounterPlan proxy for now)
