# World Map — Design Spec

**Date:** 2026-05-07
**Status:** Approved, pending implementation plan

---

## Overview

A per-campaign interactive canvas where DMs place and connect locations on a world map. Locations accumulate a living event timeline authored by both the DM and DM Brain. Maps are hierarchical — clicking a location can drill into that location's own detail map. The canvas is built on React Flow (`@xyflow/react`).

---

## Data Model

### New Prisma models

```prisma
model CampaignMap {
  id                 String       @id @default(cuid())
  campaignId         String
  name               String
  backgroundType     MapBgType
  backgroundUrl      String?      // R2 URL — null for BLANK
  parentLocationId   String?      // FK to WorldEntity — null = root world map
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt

  campaign           Campaign     @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  parentLocation     WorldEntity? @relation("LocationMap", fields: [parentLocationId], references: [id])
  pins               MapPin[]
}

enum MapBgType {
  UPLOADED
  GENERATED
  BLANK
}

model MapPin {
  id          String      @id @default(cuid())
  mapId       String
  entityId    String      // FK to WorldEntity
  x           Float
  y           Float
  unplaced    Boolean     @default(false)  // DM Brain auto-created, not yet positioned
  lastEventAt DateTime?   // updated by brain worker when entity changes
  createdAt   DateTime    @default(now())

  map         CampaignMap @relation(fields: [mapId], references: [id], onDelete: Cascade)
  entity      WorldEntity @relation(fields: [entityId], references: [id], onDelete: Cascade)
}
```

### WorldEntity model additions
The existing `WorldEntity` model needs two inverse relations added:
```prisma
pins  MapPin[]
maps  CampaignMap[] @relation("LocationMap")
```

### Key design decisions
- `MapPin` only stores position. All entity data (name, type, event history) lives in `WorldEntity` + `WorldStateChange` — no duplication.
- Standalone DM notes become `WorldEntity` records of type `NOTE`. This keeps the event timeline consistent and makes them first-class DM Brain citizens.
- A `WorldEntity` of type `LOCATION` can have at most one child `CampaignMap` (via `parentLocationId`), giving the drill-down hierarchy.
- `lastEventAt` is a lightweight signal for the canvas to show unread badges without a full data reload.

---

## Routes

```
/campaigns/[slug]/world-map          Root world map canvas
```

Sub-location maps do not get their own routes. They open within the same route — a `mapId` query param (`?map=<id>`) controls which `CampaignMap` is active. A breadcrumb in the canvas header shows the drill-down path. The breadcrumb is built by walking `parentLocationId` up the chain from the current map — the `getMap` procedure should return the full ancestor path, not just the immediate parent.

---

## Component Architecture

```
WorldMapPage
├── MapBreadcrumb                   breadcrumb nav (World → Region → Location)
├── WorldMapCanvas                  React Flow canvas
│   ├── MapBackground               image layer or blank/grid
│   ├── LocationNode (custom)       pin + label + event badge
│   ├── NoteNode (custom)           floating sticky, no location anchor
│   └── ReactFlow minimap + controls
├── MapToolbar (floating)           place pin | place note | map settings | generate
└── LocationPanel (Sheet, right)    opens on node click
    ├── EntityHeader                name + type badge
    ├── EventTimeline               WorldStateChange records, newest first, source tagged
    ├── AddNoteInput                creates WorldStateChange source=DM
    └── SubMapButton                open/create child CampaignMap
```

### Visual treatment
- `LocationNode`: amber pin icon, label below, amber badge for unread events. Framer Motion pulse when `lastEventAt` updates.
- `NoteNode`: small glass-card sticky. DM-authored = amber accent. DM Brain-authored = indigo accent.
- `MapToolbar`: floating glass panel, 4–5 icon buttons, top-left corner.
- `MapBackground`: image fills canvas viewport; blank mode renders a subtle dot-grid in the app's stone color.

---

## User Flows

### First visit — no map exists
DM navigates to `/campaigns/[slug]/world-map`. Full-screen picker: three cards — **Upload**, **Generate with AI**, **Start Blank**. Choosing any creates the root `CampaignMap` and enters the canvas.

### Adding a location
1. Click pin tool in toolbar → canvas enters place mode (crosshair cursor)
2. Click anywhere → `LocationNode` drops at those coords with an inline name input
3. Submitting name creates `WorldEntity(type=LOCATION)` + `MapPin` at those coordinates
4. Node becomes interactive immediately

### Viewing location history
Click any pin → `LocationPanel` slides in. Timeline shows all `WorldStateChange` records for that entity, newest first, tagged with source (session name / "DM Brain" / "DM Note"). DM can add a manual note from the panel at any time.

### Drilling into a sub-map
Click "Open sub-map" in `LocationPanel`:
- If child `CampaignMap` exists → canvas transitions, `?map=<id>` updates, breadcrumb adds a segment
- If none exists → `MapBackgroundPicker` dialog opens, creating a new `CampaignMap` with `parentLocationId` set

### Navigating back
Click any segment in the breadcrumb to jump up the hierarchy.

---

## DM Brain Integration

### Auto-surfacing events (brain → map)
At the end of `processBrainIngestionJob`, after all `WorldStateChange` records are written:
1. Collect all `entityId`s touched in this job
2. Query `MapPin` for pins whose `entityId` is in that set
3. `UPDATE MapPin SET lastEventAt = NOW()` for each hit
4. No new worker, no new queue — piggybacks on the existing ingestion job

### Auto-creating pins (brain → map)
When the ingestion job creates a new `WorldEntity` of type `LOCATION`:
1. Check if the campaign has a root `CampaignMap`
2. If yes, create a `MapPin` at `(x: 50, y: 50)` (centre) with `unplaced: true`
3. Canvas shows a banner: *"DM Brain found N new locations — place them on the map"*
4. DM drags them to position; dragging sets `unplaced: false`

---

## Map Generation

Flow triggered when DM selects **Generate** in `MapBackgroundPicker`:

1. App pulls campaign setting/description from DM Brain world state
2. Builds prompt: `"Fantasy world map, [setting], top-down cartographic style, parchment, ink lines, no labels"`
3. Enqueues job on new `map-generation` BullMQ queue
4. Canvas shows shimmer/loading state on the background layer
5. Worker sends to ComfyUI (`COMFYUI_URL` env var, same pattern as `DOCLING_URL`) with fal.ai as fallback if unreachable
6. On completion: upload result to R2, update `CampaignMap.backgroundUrl`, emit via WebSocket to update canvas
7. Background swaps in via Framer Motion fade

---

## New tRPC Router: `worldMap`

Procedures needed:
- `getOrCreateRoot(campaignId)` — fetch root CampaignMap for campaign, create if missing
- `getMap(mapId)` — fetch CampaignMap with all pins + entity names
- `createPin(mapId, entityId, x, y)` — place existing entity on map
- `createLocationPin(mapId, name, x, y)` — create WorldEntity(LOCATION) + MapPin in one call
- `createNotePin(mapId, content, x, y)` — create WorldEntity(NOTE) + MapPin
- `updatePinPosition(pinId, x, y)` — drag to reposition
- `deletePin(pinId)`
- `generateMapBackground(mapId)` — enqueue map-generation job
- `uploadMapBackground(mapId, url)` — set uploaded R2 URL
- `getLocationEvents(entityId)` — WorldStateChange timeline for panel
- `addLocationNote(entityId, content)` — create WorldStateChange source=DM
- `createSubMap(locationEntityId, bgType)` — create child CampaignMap

---

## New BullMQ Queue

**`map-generation`** queue + worker (`src/workers/map-generation-worker.ts`):
- Input: `{ mapId, prompt }`
- Tries ComfyUI first, fal.ai fallback
- Uploads result to R2
- Updates `CampaignMap.backgroundUrl`
- Emits WebSocket event `map:background-ready` to campaign room

---

## Out of Scope (this spec)

- Chrome extension overlay on D&D Beyond maps (future phase)
- Faction/NPC nodes on the world map canvas (DM Brain entity graph explorer — separate spec)
- Collaborative real-time editing (multi-user canvas)
- Fog of war
- Drawing/freeform annotation tools
