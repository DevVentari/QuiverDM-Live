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
  key.pem                # Stable extension ID keypair (gitignored, required for OAuth)
  package.json           # Vite + CRXJS plugin
  src/
    background/
      service-worker.ts  # OAuth flow, alarm-driven WS reconnect, message bus
      offscreen.ts       # Offscreen document — holds persistent WebSocket connection
      auth.ts            # OAuth PKCE popup, token storage (chrome.storage.local)
    content/
      page-world.ts      # Injected into MAIN world — overrides fetch/XHR (secondary)
      content-main.ts    # Isolated world — MutationObserver, button injection, relay
      pages/
        character.ts     # /characters/{id}
        monster.ts       # /monsters/{id}
        spell.ts         # /spells/{id}
        item.ts          # /magic-items/{id}
        encounter.ts     # /encounters/{id} (requires CobaltSession)
        maps.ts          # /maps — combat events, initiative
    ui/
      button.ts          # Shared "Add to QuiverDM" button (injected DOM)
      toast.ts           # Lightweight inline feedback
    shared/
      types.ts           # Event types shared across worlds
      campaign-picker.ts # Inline modal: "Which campaign?" on import
```

### Manifest (MV3)

```json
{
  "manifest_version": 3,
  "permissions": ["cookies", "storage", "alarms", "offscreen", "identity"],
  "host_permissions": [
    "https://*.dndbeyond.com/*",
    "https://character-service.dndbeyond.com/*"
  ],
  "content_scripts": [{
    "matches": ["https://www.dndbeyond.com/*"],
    "js": ["src/content/content-main.ts"]
  }],
  "web_accessible_resources": [{
    "resources": ["src/content/page-world.ts", "auth-callback.html"],
    "matches": ["https://www.dndbeyond.com/*", "chrome-extension://*/*"]
  }]
}
```

**Install warning:** `host_permissions` for `dndbeyond.com` triggers "Read and change your data on dndbeyond.com" during install. Expected — unavoidable for cookie access.

**Extension ID stability:** Generate `key.pem` once (`openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt`), add `key` field to `manifest.json` from the derived public key. Required for a stable `chrome-extension://<id>/` redirect URI during development. Document in `browser-extension/README.md`.

### WebSocket Lifetime — Offscreen Document

MV3 service workers are terminated after ~30s of inactivity. A WebSocket held by a dormant service worker is silently closed. Solution: use a `chrome.offscreen` document (available Chrome 109+) to hold the persistent WebSocket connection.

```
service-worker.ts
  ↓ chrome.offscreen.createDocument()
offscreen.ts  ←→  QuiverDM WS server  (persistent connection)
  ↑ chrome.runtime.sendMessage (relay events up)
content-main.ts → service-worker.ts → offscreen.ts → WS
```

For Firefox (pre-beta): `chrome.offscreen` is not available. Fall back to `chrome.alarms`-driven reconnect (alarm fires every 1 min, service worker wakes and re-establishes WS). Requires Redis-buffered event queue on the QuiverDM side (events held for up to 1 min and flushed on reconnect).

### Data Flow

**Live bridge:**
1. `page-world.ts` intercepts DDB's `fetch`/`XHR` calls (where viable) → posts to `content-main.ts`
2. `content-main.ts` MutationObserver fires on DOM changes → additional signal source
3. Both paths normalise events → forward to service worker via `chrome.runtime.sendMessage`
4. Service worker relays to offscreen document → WS → QuiverDM ws server → session cockpit

**Import:**
1. User visits a DDB content page → `content-main.ts` injects "Add to QuiverDM" button
2. Click → primary: DOM/JSON-LD scraping; secondary: network intercept if response already captured
3. Service worker calls QuiverDM tRPC API with captured payload

### Network Interception — MV3 Constraints

MV3 removes `webRequest` blocking — response bodies cannot be read via the extension API. The only viable path is `page-world.ts` injected into the MAIN world to override `window.fetch` and `XMLHttpRequest` before DDB's own scripts run.

**Fragility risk:** DDB's bundler output can change and break the override. Mitigation:
- For **import flows**: JSON-LD (`<script type="application/ld+json">`) and stable `data-` attributes are the **primary** data source. Network intercept is a secondary enhancement only.
- For **live bridge**: network intercept is the primary mechanism (no alternative for real-time HP changes) but the WS event schema is designed to be additive — missing events degrade gracefully rather than breaking the cockpit.

### Shared Types

`src/lib/extension-types.ts` in the QuiverDM app package. The extension imports these via a workspace package reference (`@quiverdm/types`). Single canonical source — no duplication.

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
- Access token is a signed JWT (HS256, `NEXTAUTH_SECRET`) validated by WS server and tRPC without DB round-trip

**Auth code security:** Auth codes stored in Redis with 10-minute TTL and deleted immediately on first use (`redis.del(key)` before returning tokens — matching the existing WS one-time token pattern in the ws server). Single-use enforced at the Redis layer.

**WS server auth path for extension clients:** The existing WS server uses Redis one-time tokens (join_live_session message). Extension clients use a different path: on WS connection, the extension sends `{ type: 'ext.auth', token: '<jwt>' }`. The WS server verifies the JWT signature using `NEXTAUTH_SECRET` and extracts `userId` — no Redis lookup needed. This is a new code path in the WS connection handler, parallel to the existing Redis token path.

**CobaltSession auto-capture:**
The extension runs on `dndbeyond.com` and reads the `CobaltSession` cookie automatically via `chrome.cookies.get`. Forwarded to QuiverDM only in-request for DDB API proxying — **never persisted server-side, never logged**. The QuiverDM server uses it to fetch data from DDB then discards it. Users never manually copy-paste the cookie.

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
| Encounter | `/encounters/{id}` | Encounter API (requires CobaltSession) | `encounterPlans.createFromDDB` (new) |

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

On first event of a session, extension prompts once: "Which QuiverDM session is running?" — dropdown of today's scheduled sessions for the active campaign. Answer stored in `chrome.storage.local` with an explicit session-day TTL (cleared if the stored date differs from today). `chrome.storage.session` is not used — it is unavailable in Firefox.  All subsequent events route automatically.

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
