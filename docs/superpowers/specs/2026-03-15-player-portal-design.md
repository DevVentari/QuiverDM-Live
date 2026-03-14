# Player Portal — Design Spec
**Date:** 2026-03-15
**Status:** Approved

## Overview

Richer player-specific pages within the existing QuiverDM app. Players get a dedicated `/play` route context — their own nav, their own dashboard, designed for "phone in hand at the table". DM prep surfaces remain at `/campaigns/[slug]` unchanged.

## Route Structure

```
/play                              — Player home (all campaigns as player)
/play/[slug]                       — Campaign hub
/play/[slug]/session               — Live session mode (real-time)
/play/[slug]/sessions/[id]         — Session recap
/play/[slug]/characters            — Character(s) linked to this campaign
/play/[slug]/npcs                  — DM-shared NPCs
/play/[slug]/lore                  — Shared homebrew / world notes
```

## Navigation Model

- `/play` gets its own layout with minimal atmospheric nav — no DM prep chrome
- DMs who are also players in another campaign see a context switcher in the sidebar
- Campaign nav within `/play/[slug]` is a **bottom tab bar on mobile** (one hand at the table)
- `/play/[slug]` layout verifies `CampaignMember` exists — DMs allowed in for preview
- `/play/[slug]/session` only activates when a session is `IN_PROGRESS` — otherwise redirects to hub

## Surfaces

### `/play` — Player Home
- Cards for each campaign the user is a player in: banner, campaign name, character name/class/level, next session countdown or "last played X days ago"
- Quick-jump button to active session if one is `IN_PROGRESS`
- Character roster below — HP ring, class/level, linked campaign

### `/play/[slug]` — Campaign Hub
- Hero: campaign banner, name, player's character portrait + name/class/level
- **Party panel**: all members with character portraits, class, HP rings (live during sessions)
- **Last session recap**: AI summary card, date, attendees, "Read full recap" link
- **Next session**: date/time if scheduled, DM-shared prep notes
- Tabs: Recaps · Characters · NPCs · Lore

### `/play/[slug]/session` — Live Session Mode
Mobile-first, full-screen. Four panels:

1. **Initiative strip** — top bar, all combatants in order, current turn highlighted, auto-advances as DM ticks rounds
2. **My character** — HP tracker (tap +/- or type), conditions chips, spell slots, hit dice — player-editable, synced to server
3. **DM spotlight** — centre panel, DM pushes content here: monster stat blocks, handout images, map pings, scene descriptions
4. **Quick actions** — inline dice roller, view NPC, whisper to DM

Real-time via existing WebSocket server. DM controls initiative/round from Session Cockpit; players see it live.

### `/play/[slug]/sessions/[id]` — Session Recap
- Full AI summary with sections (Strong Start, key decisions, combat highlights)
- Attendee list with character names
- XP/loot if DM has logged it
- Player's own private notes field (persisted per session)

### `/play/[slug]/npcs` — Shared NPCs
- Filtered to NPCs the DM has marked as player-visible
- Portrait, name, brief description only (no DM-only notes)

### `/play/[slug]/lore` — Shared Lore
- Homebrew items/spells/rules the DM has set `sharedWithPlayers: true`

## Data Model

### New Models

```prisma
model PlayerSessionState {
  id          String      @id @default(cuid())
  sessionId   String
  session     GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId      String
  characterId String?
  hp          Int
  maxHp       Int
  tempHp      Int         @default(0)
  conditions  Json        @default("[]")
  spellSlots  Json        @default("{}")
  hitDice     Json        @default("{}")
  updatedAt   DateTime    @updatedAt

  @@unique([sessionId, userId])
  @@index([sessionId])
}

model SessionSpotlight {
  id        String      @id @default(cuid())
  sessionId String
  session   GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  type      String      // 'text' | 'image' | 'statblock' | 'handout'
  content   Json
  createdAt DateTime    @default(now())
  clearedAt DateTime?
}
```

### Schema Additions
- `GameSession.playerVisibility String @default("summary")` — `dm-only | summary | full`
- `HomebrewContent.sharedWithPlayers Boolean @default(false)` (if not present)
- Verify `CharacterCampaign` join exists — needed to know which character a player brings

### WebSocket Events
```
player:state:update     — player updates HP/conditions → broadcasts to DM + party
dm:spotlight:push       — DM pushes content to all players
dm:spotlight:clear      — DM clears spotlight
dm:initiative:update    — DM advances turn/round → all players
session:started         — DM starts session → players get live mode prompt
```

## tRPC Additions

- `play.getHome` — campaigns where user is a member (any non-DM role), with character + next session
- `play.getCampaignHub` — campaign data player-scoped (strips DM-only fields)
- `play.getSessionState` — current `PlayerSessionState` for this session
- `play.updateSessionState` — player updates their own HP/conditions
- `play.getRecap` — session summary filtered by `playerVisibility`
- `play.getSharedNpcs` — NPCs with `playerVisible: true`
- `play.getSharedLore` — homebrew with `sharedWithPlayers: true`

## Design Direction

- Dark, atmospheric — same design system as DM surfaces
- Mobile-first layout throughout (players at the table on phones)
- Live session mode: large touch targets (44px min), high contrast HP numbers, bottom-anchored controls
- Party panel uses character portrait rings — same aesthetic as D&D Beyond party bar
- Bottom tab nav on `/play/[slug]/*` on mobile; left sidebar collapses on desktop

## What This Is Not

- Not a separate app or subdomain
- Not replacing the existing character sheet at `/characters/[id]`
- Not giving players DM capabilities (no session creation, NPC creation, encounter planning)
- DM Brain, world pressure, encounter builder remain DM-only
