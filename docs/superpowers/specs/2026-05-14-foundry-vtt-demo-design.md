# Foundry VTT Demo — Design Spec
**Date:** 2026-05-14
**Status:** Approved

## Overview

Deploy Foundry VTT on the homelab and wire it into the QuiverDM session cockpit as a fully functional battle map panel — fog of war, dynamic lighting, tokens, line-of-sight — without building a native VTT renderer. This is a demo for F&F beta (10 Foundry licenses available) that validates the "VTT panel in the session cockpit" UX before committing to a native implementation.

The integration is bidirectional: QuiverDM pushes session NPCs and party members into Foundry as actors/tokens; Foundry pushes combat events (HP changes, deaths, conditions) back into the session cockpit in real time.

## System Architecture

Five components:

```
QuiverDM (Next.js)          Foundry VTT (homelab LXC)       DB
────────────────────         ─────────────────────────       ─────────────────
Session Cockpit         →    POST /api/quiver/actors          Campaign.foundryUrl
foundry.ts router       →    POST /api/quiver/tokens          Campaign.foundryApiKey (bcrypt)
foundry.syncSession     →    POST /api/quiver/scene/activate  FoundryEvent rows
foundry.getEvents       ←    GET  /api/quiver/events
FoundryPanel (iframe)        quiver-embed module
World Map pin menu      →    scene activation command
```

Auth: QuiverDM sends the raw API key in `X-Quiver-Key` header. The `quiver-embed` module verifies it against the bcrypt hash stored in Foundry's world settings (same value as `Campaign.foundryApiKey`).

## `quiver-embed` Foundry Module

A Foundry v12 module (manifest JSON + single JS file). Distributed as a manifest URL — DMs install via Foundry's module manager.

**On load**, the module checks for `?quiver=1` in the page URL. If present:

- Injects CSS hiding `#navigation`, `#controls`, `#hotbar`, `#sidebar`, `#players`, `#pause`, `#fps` — leaving only the bare WebGL canvas
- Registers three Express routes on Foundry's server:

| Route | Method | Purpose |
|---|---|---|
| `/api/quiver/actors` | POST | Upsert actors from QuiverDM NPC/character JSON, keyed by `ddbId` or name |
| `/api/quiver/tokens` | POST | Place/update tokens on the active scene at specified grid positions |
| `/api/quiver/events` | GET | Return combat events since `?cursor=<id>` from an in-memory ring buffer |
| `/api/quiver/scene/activate` | POST | Switch active scene by Foundry scene ID |

- Maintains an in-memory ring buffer of the last 200 combat events (no Foundry DB writes needed)
- All routes reject requests where `X-Quiver-Key` doesn't verify against the stored bcrypt hash

## Session Cockpit Layout

Combat mode replaces the center column with the Foundry canvas. The three-column structure becomes:

```
┌──────────┬──────────────────────────┬─────────────────┐
│  Party   │     Battle Map           │  Initiative /   │
│  (w-60)  │  (FoundryPanel iframe)   │  NPCs / Brain   │
│  HP bars │  ?quiver=1 → bare canvas │  (w-80, tabs)   │
│  status  │  fog of war, tokens, LoS │  event feed     │
└──────────┴──────────────────────────┴─────────────────┘
```

- The "Sync to Foundry" button lives in the cockpit header (combat mode only)
- The right panel gains an "Initiative" tab alongside the existing Scene/NPCs/Brain/Co-DM tabs
- RP mode is unchanged — live notes in the center, right panel tabs as before
- The mode toggle (already in `CockpitHeader`) drives the layout switch

## QuiverDM → Foundry Push

New tRPC mutation: `foundry.syncSession`

1. Loads session NPCs + party members from DB
2. Maps NPCs via existing `mapNpcToActor` in `src/lib/foundry-export.ts`
3. Maps party members to player actors with character sheet stats
4. `POST /api/quiver/actors` — upserts all actors (idempotent, re-sync safe)
5. `POST /api/quiver/tokens` — places NPC tokens at scene center, player tokens at entry points
6. Returns `{ synced: number, placed: number, errors: string[] }`

The mutation is idempotent. Running it again updates existing actors rather than creating duplicates, keyed by `ddbId` where available, falling back to actor name.

## Foundry → QuiverDM Event Stream

The existing `foundry.getEvents` tRPC query uses cursor-based polling. The session cockpit polls every 3 seconds when in combat mode.

Event types and their cockpit effects:

| Event | Cockpit effect |
|---|---|
| `hp_change` | Updates HP bar on party card or NPC row |
| `actor_death` | Adds death marker, moves actor to bottom of initiative |
| `condition_added` / `condition_removed` | Shows/hides condition icon on actor row |
| `initiative_set` | Populates and re-orders the initiative tracker |

All events are written to `FoundryEvent` DB rows for a permanent combat log on the session. The `FoundryEvent.type` field is a plain string (not an enum), so `condition_added` and `condition_removed` are new types that write without a schema migration.

## World Map → Battle Map Link

Location pin context menu gains "Open as battle map" (DM only). This:

1. Stores `foundrySceneId` in the `WorldEntity.properties` JSON field (no schema migration needed — `properties Json @default("{}")` already exists)
2. On click: calls `foundry.activateScene` mutation → `POST /api/quiver/scene/activate`
3. Switches the cockpit to combat mode, opening the battle map pointed at that scene

DMs map Foundry scenes to world locations once. After that, launching an encounter from the world map is one click.

## Homelab Deployment

New dedicated LXC on the nerdt server (separate from LXC 206 to avoid competing with BullMQ workers under load).

- **Port:** 30000
- **Process manager:** PM2
- **Internal hostname:** `foundry.nerdt.au`
- **External URL:** `https://foundry.nerdt.au` (Proxmox reverse proxy, accessible to beta DMs' browsers for the iframe embed)
- **Frame options:** Configured in Foundry's `options.json` to allow embedding from `quiverdm.com` and `app.nerdt.au`
- **Licenses:** All 10 F&F beta licenses applied to this single instance
- **World-per-campaign:** One Foundry world per F&F beta campaign. DMs are assigned their world on onboarding. QuiverDM stores which world ID maps to which campaign in `Campaign.settings.foundryWorldId`.
- **`quiver-embed` module:** Pre-installed on the server — beta DMs do not need to install anything. Module activates automatically when the iframe loads with `?quiver=1`.
- **Content:** Each world pre-loaded with the DM's active sourcebook maps (CoS, RotFM, LMoP) manually before their first session.

Foundry is accessed by the QuiverDM Next.js server for API calls (actor/token sync, event polling) and by each DM's browser for the iframe embed. No player-facing Foundry access needed for the demo — this is DM-only.

## What This Is Not

- This is not a long-term architecture — it uses Foundry as the rendering engine. The native VTT build (Leaflet/PixiJS + DDB map extraction + AI wall detection) is the eventual target.
- This is not a multi-user player VTT — the F&F demo is DM-only. The iframe shows the DM's Foundry view. Player token control is not wired.
- This does not include DDB map import — maps are pre-loaded into Foundry manually for the demo. DDB asset extraction into the native renderer is a separate workstream.

## Success Criteria

The demo is successful if F&F beta DMs can:
1. Open a session, hit "Sync to Foundry", and see their session NPCs appear as tokens on the battle map
2. Run combat in Foundry and see HP/death events update the QuiverDM cockpit in real time
3. Click a world map location pin and jump to that Foundry scene in one action
4. Complete a full encounter without leaving the QuiverDM UI

## Decisions

- **`quiver-embed` module repo:** Private for now. May open-source later if there's community interest.
- **Foundry hosting model:** QuiverDM hosts a single Foundry instance on the homelab. Each of the 10 F&F beta DMs gets their own world. No self-install required by beta users.
