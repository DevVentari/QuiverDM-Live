# D&D Beyond Browser Extension — Design Spec

**Date:** 2026-03-18
**Status:** Draft

## Overview

A browser extension that eliminates the friction between D&D Beyond and QuiverDM. Two capabilities:

1. **Import accelerator** — "Add to QuiverDM" buttons injected on every D&D Beyond content page (characters, monsters, spells, items, encounters). One click imports content into the active campaign.
2. **Live session bridge** — real-time stream of character state and combat events from D&D Beyond (character sheets + Maps VTT) into QuiverDM's session cockpit during play.

**Browser targets:** Chrome (MVP), then Chrome + Firefox + Edge before beta.

---

## Architecture

### Extension Package

Lives as a separate package inside the QuiverDM monorepo:

```
browser-extension/
  manifest.json          # MV3
  package.json           # Vite + CRXJS plugin
  src/
    background/
      service-worker.ts  # OAuth flow, WS connection, message bus
      ws-client.ts       # WebSocket to QuiverDM ws server, reconnect logic
      auth.ts            # OAuth PKCE popup, token storage (chrome.storage.local)
    content/
      page-world.ts      # Injected into MAIN world — overrides fetch/XHR
      content-main.ts    # Isolated world — MutationObserver, button injection, relay
      pages/
        character.ts     # /characters/{id}
        monster.ts       # /monsters/{id}
        spell.ts         # /spells/{id}
        item.ts          # /magic-items/{id}
        encounter.ts     # /encounters/{id}
        maps.ts          # /maps — combat events, initiative
    ui/
      button.ts          # Shared "Add to QuiverDM" button (injected DOM)
      toast.ts           # Lightweight inline feedback
    shared/
      types.ts           # Event types shared across worlds
      campaign-picker.ts # Inline modal: "Which campaign?" on import
```

### Data Flow

**Live bridge:**
1. `page-world.ts` intercepts DDB's `fetch`/`XHR` calls → posts messages to `content-main.ts`
2. `content-main.ts` normalises events → forwards to service worker via `chrome.runtime.sendMessage`
3. Service worker pushes over WebSocket to QuiverDM ws server
4. QuiverDM ws server fans out to the DM's open session cockpit tab

**Import:**
1. User visits a DDB content page → page script injects "Add to QuiverDM" button
2. Click → content script captures data (network intercept or JSON-LD) → sends to service worker
3. Service worker calls QuiverDM tRPC API with captured payload

### Shared Types

`src/lib/extension-types.ts` — WebSocket event shapes and import payload types shared between the extension and QuiverDM app. Both sides import from here.

---

## Auth

**OAuth PKCE flow** (no client secret in extension):

1. First visit to a DDB page — service worker detects no stored token, triggers auth
2. `chrome.identity.launchWebAuthFlow` opens QuiverDM `/api/auth/extension/authorize?code_challenge=...`
3. User logs in (or silent if already logged in) → QuiverDM redirects to `chrome-extension://<id>/auth-callback.html` with auth code
4. Service worker exchanges code → access token (1h JWT) + refresh token (30d) stored in `chrome.storage.local`
5. Tokens used as `Authorization: Bearer` on all QuiverDM API and WebSocket calls

**QuiverDM additions required:**
- `/api/auth/extension/authorize` — PKCE challenge validation, issues short-lived auth codes
- `auth.exchangeExtensionCode` tRPC mutation — code → JWT access + refresh tokens
- `auth.refreshExtensionToken` tRPC mutation — silent refresh
- Access token is a signed JWT validated by WS server and tRPC without DB round-trip

**CobaltSession auto-capture:**
The extension runs on `dndbeyond.com` and reads the `CobaltSession` cookie automatically via `chrome.cookies.get`. Forwarded to QuiverDM as needed for character/monster fetches. Users never manually copy-paste the cookie.

---

## Import Accelerator

### Injected Pages

| DDB Page | URL Pattern | Data Source | QuiverDM Destination |
|----------|-------------|-------------|----------------------|
| Character sheet | `/characters/{id}` | Network intercept (character-service API) | `charactersDndBeyond.importCharacter` (existing) |
| Monster statblock | `/monsters/{id}` | DDB content API intercept | `npcs.createFromDDB` (new) |
| Source book statblocks | `/sources/*` | Inline statblock intercept | `npcs.createFromDDB` |
| Spell | `/spells/{id}` | DDB content API | `homebrew.createFromDDB` |
| Magic item | `/magic-items/{id}` | DDB content API | `homebrew.createFromDDB` |
| Encounter | `/encounters/{id}` | Encounter API | `encounterPlans.createFromDDB` (new) |

### Button Behaviour

- Injected into DDB's existing action bar — not floating, not intrusive
- Single campaign: one click imports immediately + inline toast
- Multiple campaigns: click → inline campaign picker → import
- Button states: idle → spinner → "Added" (green, 2s) → idle
- Error: inline red message beneath button
- Buttons target DDB `data-` attributes and stable element IDs, not CSS class names

### Monster → NPC Mapping

DDB monster JSON maps to QuiverDM's NPC model. Reference: `ddb-importer` open-source mapping logic (MIT). Key fields: name, AC, HP, speed, ability scores, skills, saves, actions, legendary actions, reactions, CR, type, alignment, senses, languages.

---

## Live Session Bridge

### Events Captured

| Event | Source | Mechanism |
|-------|--------|-----------|
| HP / Temp HP | Character sheet API response | Network intercept |
| Death saves | Character sheet API response | Network intercept |
| Conditions | Character sheet API response | Network intercept |
| Spell slots | Character sheet API response | Network intercept |
| Exhaustion | Character sheet API response | Network intercept |
| Dice rolls | DDB roll API call | Network intercept |
| Initiative order | Maps API | Network intercept |
| Combat started | Maps DOM landmark | MutationObserver |
| Combat ended | Maps DOM landmark | MutationObserver |
| Token placed (NPC) | Maps API | Network intercept |

### WebSocket Protocol

New event types added to QuiverDM's existing ws server:

```ts
// Extension → QuiverDM
{ type: 'ext.character.update', sessionId, characterId, patch: CharacterStatePatch }
{ type: 'ext.roll', sessionId, characterId, roll: RollEvent }
{ type: 'ext.combat.start', sessionId, initiativeOrder: InitiativeEntry[] }
{ type: 'ext.combat.end', sessionId }
{ type: 'ext.token.placed', sessionId, npcDdbId, tokenData }

// QuiverDM → DM's session cockpit
{ type: 'session.party.update', ... }   // existing channel, new source
{ type: 'session.roll.log', ... }
{ type: 'session.combat.update', ... }
```

### Session Association

On first event of a session, extension prompts once: "Which QuiverDM session is running?" — dropdown of today's scheduled sessions for the active campaign. Answer stored in `chrome.storage.session` (cleared on browser close). All subsequent events route automatically.

---

## QuiverDM Server Changes

### New tRPC Endpoints

- `auth.exchangeExtensionCode` — OAuth code exchange
- `auth.refreshExtensionToken` — token refresh
- `npcs.createFromDDB` — create NPC from DDB monster payload
- `encounterPlans.createFromDDB` — create encounter plan from DDB encounter payload

### WebSocket Server

- Validate extension JWT on connection (existing WS auth extended)
- Handle new `ext.*` event types
- Fan out to session cockpit subscribers

### Shared Types Package

`src/lib/extension-types.ts` — import/export event shapes consumed by both extension and server.

---

## Build & Distribution

**Development:**
```bash
cd browser-extension
npm run dev     # Vite + CRXJS with HMR
# Load dist/ unpacked at chrome://extensions
```

**Production:**
```bash
npm run build   # Outputs dist/
```

**Store targets (pre-beta):**
- Chrome Web Store
- Firefox Add-ons (webextension-polyfill shim)
- Microsoft Edge Add-ons (free with Chrome build)

---

## Out of Scope

- Extension popup / toolbar UI (injected buttons only for MVP)
- Writing data back to D&D Beyond
- Support for Roll20, Foundry, or other VTTs in this extension
- Mobile browsers
