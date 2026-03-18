# D&D Beyond Extension — Browser Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Chrome MV3 browser extension — package setup, OAuth PKCE auth, offscreen WebSocket client, content scripts with fetch/XHR interception, page handlers for all DDB content pages, and "Add to QuiverDM" button injection.

**Architecture:** MV3 extension with a service worker (message bus + OAuth flow), an offscreen document (persistent WebSocket to QuiverDM ws server), a page-world script (fetch/XHR override injected into MAIN world), and a content script per page type (MutationObserver + button injection). Import flows use JSON-LD as primary data source; live bridge uses network interception.

**Tech Stack:** TypeScript, Vite + CRXJS (`@crxjs/vite-plugin`), `webextension-polyfill`, Chrome MV3 APIs, QuiverDM tRPC REST endpoint

**Spec:** `docs/superpowers/specs/2026-03-18-dndbeyond-extension-design.md`
**Depends on:** `docs/superpowers/plans/2026-03-18-dndbeyond-extension-server-impl.md` (must be deployed first)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `browser-extension/package.json` | Dependencies, scripts |
| Create | `browser-extension/tsconfig.json` | TypeScript config |
| Create | `browser-extension/vite.config.ts` | Vite + CRXJS config |
| Create | `browser-extension/manifest.json` | MV3 manifest |
| Create | `browser-extension/auth-callback.html` | OAuth redirect landing |
| Create | `browser-extension/README.md` | key.pem setup instructions |
| Create | `browser-extension/src/shared/types.ts` | Re-export from extension-types.ts (copied at build) |
| Create | `browser-extension/src/shared/config.ts` | QuiverDM base URL, WS URL |
| Create | `browser-extension/src/background/auth.ts` | PKCE flow, token storage, refresh |
| Create | `browser-extension/src/background/service-worker.ts` | Message bus, OAuth init, routing |
| Create | `browser-extension/src/background/offscreen.ts` | Persistent WS client in offscreen document |
| Create | `browser-extension/src/content/page-world.ts` | Injected into MAIN world — fetch/XHR override |
| Create | `browser-extension/src/content/content-main.ts` | Isolated world — MutationObserver, relay, button injection orchestrator |
| Create | `browser-extension/src/content/pages/character.ts` | Character sheet page handler |
| Create | `browser-extension/src/content/pages/monster.ts` | Monster statblock page handler |
| Create | `browser-extension/src/content/pages/spell.ts` | Spell page handler |
| Create | `browser-extension/src/content/pages/item.ts` | Magic item page handler |
| Create | `browser-extension/src/content/pages/encounter.ts` | Encounter page handler |
| Create | `browser-extension/src/content/pages/maps.ts` | Maps VTT — MutationObserver + combat events |
| Create | `browser-extension/src/ui/button.ts` | Shared "Add to QuiverDM" button DOM element |
| Create | `browser-extension/src/ui/toast.ts` | Inline success/error feedback |
| Create | `browser-extension/src/ui/campaign-picker.ts` | Inline campaign picker modal |

---

## Task 1: Package setup

- [ ] **Step 1: Create `browser-extension/` directory and `package.json`**

```bash
mkdir -p E:/Projects/QuiverDM/browser-extension/src/{background,content/pages,ui,shared}
```

Create `browser-extension/package.json`:

```json
{
  "name": "quiverdm-browser-extension",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "webextension-polyfill": "^0.12.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.29",
    "@types/chrome": "^0.0.268",
    "@types/webextension-polyfill": "^0.10.7",
    "typescript": "^5.3.3",
    "vite": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create `browser-extension/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noEmit": true,
    "types": ["chrome", "webextension-polyfill"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `browser-extension/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        offscreen: 'src/background/offscreen.ts',
      },
    },
  },
});
```

- [ ] **Step 4: Create `browser-extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "QuiverDM — D&D Beyond Bridge",
  "version": "0.1.0",
  "description": "Import D&D Beyond content into QuiverDM and stream live session data.",
  "permissions": ["cookies", "storage", "alarms", "offscreen", "identity"],
  "host_permissions": [
    "https://*.dndbeyond.com/*",
    "https://character-service.dndbeyond.com/*"
  ],
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.dndbeyond.com/*"],
      "js": ["src/content/content-main.ts"],
      "run_at": "document_end"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["src/content/page-world.ts", "auth-callback.html"],
      "matches": ["https://www.dndbeyond.com/*", "chrome-extension://*/*"]
    }
  ]
}
```

- [ ] **Step 5: Create `browser-extension/auth-callback.html`**

```html
<!DOCTYPE html>
<html>
<head><title>QuiverDM Auth</title></head>
<body>
<p>Authenticating with QuiverDM...</p>
<script>
  // The service worker catches this page's URL via chrome.identity redirect
  // Nothing needed here — window closes automatically after chrome.identity handles it
</script>
</body>
</html>
```

- [ ] **Step 6: Create `browser-extension/README.md`** with key.pem instructions

```markdown
# QuiverDM Browser Extension

## Development Setup

### 1. Generate stable extension ID keypair (one-time)

```bash
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
```

Extract the public key for manifest.json `key` field:
```bash
openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A
```

Add the output as `"key": "<base64>"` to `manifest.json`.

This gives you a stable `chrome-extension://<id>/` redirect URI.
Register this URI in your QuiverDM `.env.local`:
```
EXTENSION_REDIRECT_URI=chrome-extension://<id>/auth-callback.html
```

**key.pem is gitignored — never commit it.**

### 2. Install dependencies

```bash
npm install
```

### 3. Build and load

```bash
npm run dev
```

Load `dist/` as unpacked extension at `chrome://extensions`.
```

- [ ] **Step 7: Add key.pem to .gitignore**

```bash
echo "browser-extension/key.pem" >> E:/Projects/QuiverDM/.gitignore
echo "browser-extension/dist/" >> E:/Projects/QuiverDM/.gitignore
echo "browser-extension/node_modules/" >> E:/Projects/QuiverDM/.gitignore
```

- [ ] **Step 8: Install deps**

```bash
cd E:/Projects/QuiverDM/browser-extension && npm install
```

- [ ] **Step 9: Commit**

```bash
cd E:/Projects/QuiverDM
git add browser-extension/ .gitignore
git commit -m "feat(extension): browser extension package setup"
```

---

## Task 2: Shared config + types

**Files:**
- Create: `browser-extension/src/shared/config.ts`
- Create: `browser-extension/src/shared/types.ts`

- [ ] **Step 1: Create `browser-extension/src/shared/config.ts`**

```typescript
// browser-extension/src/shared/config.ts
// Update QUIVERDM_BASE_URL for production deployment.
export const QUIVERDM_BASE_URL = 'https://quiverdm.com';
export const QUIVERDM_WS_URL = 'wss://quiverdm.com:3004';
export const QUIVERDM_TRPC_URL = `${QUIVERDM_BASE_URL}/api/trpc`;

export const DDB_HOST = 'www.dndbeyond.com';
export const DDB_CHARACTER_SERVICE = 'character-service.dndbeyond.com';
```

- [ ] **Step 2: Copy extension-types.ts into extension package**

```bash
cp E:/Projects/QuiverDM/src/lib/extension-types.ts \
   E:/Projects/QuiverDM/browser-extension/src/shared/extension-types.ts
```

Add a comment at the top:
```typescript
// GENERATED — copy of src/lib/extension-types.ts
// Keep in sync manually. Do not edit here — edit the source in the QuiverDM app.
```

- [ ] **Step 3: Create `browser-extension/src/shared/types.ts`**

```typescript
// browser-extension/src/shared/types.ts
// Internal message types passed between extension worlds via chrome.runtime.sendMessage

export type MessageToServiceWorker =
  | { type: 'import.monster'; payload: import('./extension-types').DdbMonsterImportPayload; campaignId: string }
  | { type: 'import.character'; ddbId: string; campaignId: string }
  | { type: 'import.spell'; payload: Record<string, unknown>; campaignId: string }
  | { type: 'import.item'; payload: Record<string, unknown>; campaignId: string }
  | { type: 'import.encounter'; payload: import('./extension-types').DdbEncounterImportPayload; campaignId: string }
  | { type: 'live.event'; event: import('./extension-types').ExtIncomingMessage }
  | { type: 'network.intercept'; url: string; body: unknown };

export interface ImportResult {
  ok: boolean;
  error?: string;
  name?: string;
}

export interface CampaignOption {
  id: string;
  name: string;
  slug: string;
}
```

- [ ] **Step 4: Commit**

```bash
cd E:/Projects/QuiverDM
git add browser-extension/src/shared/
git commit -m "feat(extension): shared config + types"
```

---

## Task 3: Auth module

**Files:**
- Create: `browser-extension/src/background/auth.ts`

Implements the PKCE flow using `chrome.identity.launchWebAuthFlow`. Stores tokens in `chrome.storage.local`. Handles silent refresh.

- [ ] **Step 1: Create `browser-extension/src/background/auth.ts`**

```typescript
// browser-extension/src/background/auth.ts
import { QUIVERDM_BASE_URL, QUIVERDM_TRPC_URL } from '../shared/config';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

const STORAGE_KEY = 'quiverdm_tokens';

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

export async function getTokens(): Promise<StoredTokens | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as StoredTokens) ?? null;
}

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: tokens });
}

export async function clearTokens(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Get valid access token (refresh if needed)
// ---------------------------------------------------------------------------

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens) return null;

  // Refresh 5 min before expiry
  if (Date.now() < tokens.expiresAt - 5 * 60 * 1000) {
    return tokens.accessToken;
  }

  return refreshAccessToken(tokens.refreshToken);
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${QUIVERDM_TRPC_URL}/extensionAuth.refreshExtensionToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { refreshToken } }),
    });

    if (!res.ok) {
      await clearTokens();
      return null;
    }

    const data = await res.json() as { result: { data: { json: { accessToken: string } } } };
    const newAccess = data.result.data.json.accessToken;

    const stored = await getTokens();
    if (stored) {
      await saveTokens({
        ...stored,
        accessToken: newAccess,
        expiresAt: Date.now() + 3600 * 1000,
      });
    }

    return newAccess;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OAuth PKCE flow
// ---------------------------------------------------------------------------

export async function authenticate(): Promise<boolean> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  // chrome.identity.getRedirectURL() returns a https://<id>.chromiumapp.org/ URL.
  // The server validates redirect_uri starts with 'chrome-extension://' OR 'https://' + chromiumapp.org.
  // We use getRedirectURL() here and update the server-side check accordingly (see server plan Task 2).
  const redirectUri = chrome.identity.getRedirectURL('auth-callback');

  const authorizeUrl = new URL(`${QUIVERDM_BASE_URL}/api/auth/extension/authorize`);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);

  let callbackUrl: string;
  try {
    callbackUrl = await chrome.identity.launchWebAuthFlow({
      url: authorizeUrl.toString(),
      interactive: true,
    });
  } catch {
    return false;
  }

  const params = new URL(callbackUrl).searchParams;
  const code = params.get('code');
  if (!code) return false;

  // Exchange code for tokens
  try {
    const res = await fetch(`${QUIVERDM_TRPC_URL}/extensionAuth.exchangeExtensionCode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { code, codeVerifier: verifier } }),
    });

    if (!res.ok) return false;

    const data = await res.json() as {
      result: { data: { json: { accessToken: string; refreshToken: string } } }
    };
    const { accessToken, refreshToken } = data.result.data.json;

    await saveTokens({
      accessToken,
      refreshToken,
      expiresAt: Date.now() + 3600 * 1000,
    });

    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd E:/Projects/QuiverDM
git add browser-extension/src/background/auth.ts
git commit -m "feat(extension): PKCE auth module"
```

---

## Task 4: Offscreen document (persistent WebSocket)

**Files:**
- Create: `browser-extension/src/background/offscreen.ts`

The offscreen document runs as a full webpage context (not a service worker) — it can hold a persistent WebSocket. The service worker creates the offscreen document if it doesn't exist and sends messages to it.

- [ ] **Step 1: Create `browser-extension/src/background/offscreen.ts`**

```typescript
// browser-extension/src/background/offscreen.ts
// Runs as an offscreen document — holds the persistent WS connection.
import { QUIVERDM_WS_URL } from '../shared/config';
import type { ExtIncomingMessage } from '../shared/extension-types';

let ws: WebSocket | null = null;
let pendingEvents: ExtIncomingMessage[] = [];
let authenticated = false;

function connect(token: string) {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(QUIVERDM_WS_URL);

  ws.onopen = () => {
    // Authenticate immediately
    ws!.send(JSON.stringify({ type: 'ext.auth', token }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as { type: string };
      if (msg.type === 'ext.auth.ok') {
        authenticated = true;
        // Flush pending events
        for (const e of pendingEvents) {
          ws!.send(JSON.stringify(e));
        }
        pendingEvents = [];
      }
    } catch {
      // ignore
    }
  };

  ws.onclose = () => {
    authenticated = false;
    // Service worker will reconnect via alarm
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function sendLiveEvent(event: ExtIncomingMessage) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !authenticated) {
    pendingEvents.push(event);
    return;
  }
  ws.send(JSON.stringify(event));
}

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message: { type: string; token?: string; event?: ExtIncomingMessage }) => {
  if (message.type === 'offscreen.connect' && message.token) {
    connect(message.token);
    return;
  }
  if (message.type === 'offscreen.send' && message.event) {
    sendLiveEvent(message.event);
    return;
  }
  if (message.type === 'offscreen.disconnect') {
    ws?.close();
    ws = null;
    authenticated = false;
    pendingEvents = [];
    return;
  }
});
```

- [ ] **Step 2: Create offscreen HTML page** (required by Chrome offscreen API)

Create `browser-extension/offscreen.html`:

```html
<!DOCTYPE html>
<html>
<head><title>QuiverDM Offscreen</title></head>
<body>
<script type="module" src="/src/background/offscreen.ts"></script>
</body>
</html>
```

Update `manifest.json` — add to `web_accessible_resources[0].resources`:
```json
"offscreen.html"
```

- [ ] **Step 3: Commit**

```bash
cd E:/Projects/QuiverDM
git add browser-extension/src/background/offscreen.ts browser-extension/offscreen.html browser-extension/manifest.json
git commit -m "feat(extension): offscreen document for persistent WebSocket"
```

---

## Task 5: Service worker

**Files:**
- Create: `browser-extension/src/background/service-worker.ts`

Handles: auth init on install, message routing from content scripts, offscreen document lifecycle, tRPC import calls.

- [ ] **Step 1: Create `browser-extension/src/background/service-worker.ts`**

```typescript
// browser-extension/src/background/service-worker.ts
import { authenticate, getValidAccessToken, clearTokens } from './auth';
import { QUIVERDM_TRPC_URL } from '../shared/config';
import type { MessageToServiceWorker, ImportResult, CampaignOption } from '../shared/types';
import type { ExtIncomingMessage } from '../shared/extension-types';

// ---------------------------------------------------------------------------
// Offscreen document management
// ---------------------------------------------------------------------------

async function ensureOffscreen() {
  const contexts = await chrome.offscreen.getContexts?.() ?? [];
  const exists = contexts.some((c: { documentUrl: string }) =>
    c.documentUrl?.includes('offscreen.html')
  );
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: 'Maintain persistent WebSocket to QuiverDM session server',
    });
  }
}

async function connectWs() {
  const token = await getValidAccessToken();
  if (!token) return;
  await ensureOffscreen();
  chrome.runtime.sendMessage({ type: 'offscreen.connect', token });
}

// ---------------------------------------------------------------------------
// tRPC import helper
// ---------------------------------------------------------------------------

async function trpcMutate(procedure: string, input: unknown): Promise<{ ok: boolean; error?: string }> {
  const token = await getValidAccessToken();
  if (!token) return { ok: false, error: 'Not authenticated' };

  try {
    const res = await fetch(`${QUIVERDM_TRPC_URL}/${procedure}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ json: input }),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: { message?: string } };
      return { ok: false, error: err.error?.message ?? 'Unknown error' };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function fetchUserCampaigns(): Promise<CampaignOption[]> {
  const token = await getValidAccessToken();
  if (!token) return [];

  try {
    const res = await fetch(`${QUIVERDM_TRPC_URL}/campaigns.list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as { result: { data: { json: CampaignOption[] } } };
    return data.result.data.json ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (message: MessageToServiceWorker, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true; // keep channel open for async response
  }
);

async function handleMessage(message: MessageToServiceWorker): Promise<ImportResult | CampaignOption[] | void> {
  if (message.type === 'import.monster') {
    return trpcMutate('npcs.createFromDDB', {
      campaignId: message.campaignId,
      monster: message.payload,
    });
  }

  if (message.type === 'import.character') {
    const cobalt = await getCobaltCookie();
    return trpcMutate('charactersDndBeyond.importCharacter', {
      characterId: message.ddbId,
      campaignId: message.campaignId,
      cobaltToken: cobalt ?? undefined,
    });
  }

  if (message.type === 'import.encounter') {
    return trpcMutate('encounterPlans.createFromDDB', {
      campaignId: message.campaignId,
      encounter: message.payload,
    });
  }

  if (message.type === 'live.event') {
    await ensureOffscreen();
    chrome.runtime.sendMessage({ type: 'offscreen.send', event: message.event });
    return;
  }
}

// ---------------------------------------------------------------------------
// CobaltSession cookie helper
// ---------------------------------------------------------------------------

async function getCobaltCookie(): Promise<string | null> {
  try {
    const cookie = await chrome.cookies.get({
      url: 'https://www.dndbeyond.com',
      name: 'CobaltSession',
    });
    return cookie?.value ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  const token = await getValidAccessToken();
  if (!token) {
    const ok = await authenticate();
    if (ok) await connectWs();
  } else {
    await connectWs();
  }
});

// Reconnect alarm (Firefox fallback + Chrome keepalive)
chrome.alarms.create('ws-keepalive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'ws-keepalive') {
    await connectWs();
  }
});
```

- [ ] **Step 2: Commit**

```bash
cd E:/Projects/QuiverDM
git add browser-extension/src/background/service-worker.ts
git commit -m "feat(extension): service worker — message bus, OAuth init, WS lifecycle"
```

---

## Task 6: Page-world fetch/XHR intercept

**Files:**
- Create: `browser-extension/src/content/page-world.ts`

Injected into the MAIN world before DDB's scripts. Overrides `window.fetch` to capture responses from DDB's internal APIs. Posts intercepted data to the isolated content script world.

- [ ] **Step 1: Create `browser-extension/src/content/page-world.ts`**

```typescript
// browser-extension/src/content/page-world.ts
// Injected into MAIN world. Intercepts DDB API responses.
// Posts relevant payloads to isolated world via window.postMessage.

const DDB_PATTERNS = [
  /character-service\.dndbeyond\.com\/character\/v\d+\/character\/(\d+)/,
  /www\.dndbeyond\.com\/api\/now\/characters\/(\d+)/,
  /gamemaster-service\.dndbeyond\.com\/encounter/,
  /character-service\.dndbeyond\.com\/character\/v\d+\/current-user\/characters/,
];

const originalFetch = window.fetch.bind(window);

window.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  const response = await originalFetch(input, init);

  // Only intercept matching DDB API calls
  const matched = DDB_PATTERNS.some(p => p.test(url));
  if (matched && response.ok) {
    // Clone response so we can read body AND return original
    const clone = response.clone();
    clone.json().then((body: unknown) => {
      window.postMessage({
        source: 'quiverdm-page-world',
        url,
        body,
      }, '*');
    }).catch(() => {/* ignore non-JSON */});
  }

  return response;
};
```

- [ ] **Step 2: Commit**

```bash
cd E:/Projects/QuiverDM
git add browser-extension/src/content/page-world.ts
git commit -m "feat(extension): page-world fetch intercept"
```

---

## Task 7: UI components

**Files:**
- Create: `browser-extension/src/ui/button.ts`
- Create: `browser-extension/src/ui/toast.ts`
- Create: `browser-extension/src/ui/campaign-picker.ts`

- [ ] **Step 1: Create `browser-extension/src/ui/button.ts`**

```typescript
// browser-extension/src/ui/button.ts
export type ButtonState = 'idle' | 'loading' | 'success' | 'error';

export function createImportButton(label = 'Add to QuiverDM'): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.dataset.quiverdmBtn = 'true';
  btn.textContent = label;
  btn.style.cssText = `
    background: #b45309; color: white; border: none; border-radius: 4px;
    padding: 6px 12px; cursor: pointer; font-size: 13px; font-weight: 600;
    margin-left: 8px; display: inline-flex; align-items: center; gap: 6px;
    transition: opacity 0.15s;
  `;
  return btn;
}

export function setButtonState(btn: HTMLButtonElement, state: ButtonState, message?: string) {
  switch (state) {
    case 'idle':
      btn.disabled = false;
      btn.textContent = message ?? 'Add to QuiverDM';
      btn.style.opacity = '1';
      break;
    case 'loading':
      btn.disabled = true;
      btn.textContent = 'Adding...';
      btn.style.opacity = '0.7';
      break;
    case 'success':
      btn.disabled = true;
      btn.textContent = message ?? 'Added!';
      btn.style.background = '#15803d';
      setTimeout(() => {
        setButtonState(btn, 'idle');
        btn.style.background = '#b45309';
      }, 2000);
      break;
    case 'error':
      btn.disabled = false;
      btn.textContent = message ?? 'Error — try again';
      btn.style.background = '#b91c1c';
      setTimeout(() => {
        setButtonState(btn, 'idle');
        btn.style.background = '#b45309';
      }, 3000);
      break;
  }
}
```

- [ ] **Step 2: Create `browser-extension/src/ui/toast.ts`**

```typescript
// browser-extension/src/ui/toast.ts
export function showToast(message: string, type: 'success' | 'error' = 'success') {
  const existing = document.querySelector('[data-quiverdm-toast]');
  existing?.remove();

  const toast = document.createElement('div');
  toast.dataset.quiverdmToast = 'true';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 99999;
    background: ${type === 'success' ? '#15803d' : '#b91c1c'};
    color: white; padding: 10px 16px; border-radius: 6px;
    font-size: 13px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: quiverdm-fadein 0.2s ease;
  `;

  const style = document.createElement('style');
  style.textContent = `@keyframes quiverdm-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`;
  document.head.appendChild(style);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
```

- [ ] **Step 3: Create `browser-extension/src/ui/campaign-picker.ts`**

```typescript
// browser-extension/src/ui/campaign-picker.ts
import type { CampaignOption } from '../shared/types';

export function showCampaignPicker(
  anchor: HTMLElement,
  campaigns: CampaignOption[],
  onSelect: (campaignId: string) => void
) {
  const existing = document.querySelector('[data-quiverdm-picker]');
  existing?.remove();

  const picker = document.createElement('div');
  picker.dataset.quiverdmPicker = 'true';
  picker.style.cssText = `
    position: absolute; z-index: 99998; background: #1e1b2e; border: 1px solid #4c3d8a;
    border-radius: 6px; padding: 8px; min-width: 200px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4); font-size: 13px;
  `;

  const label = document.createElement('p');
  label.textContent = 'Add to which campaign?';
  label.style.cssText = 'color: #9ca3af; margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;';
  picker.appendChild(label);

  for (const campaign of campaigns) {
    const option = document.createElement('button');
    option.textContent = campaign.name;
    option.style.cssText = `
      display: block; width: 100%; text-align: left; padding: 6px 8px;
      background: none; border: none; color: white; cursor: pointer; border-radius: 4px;
    `;
    option.onmouseover = () => { option.style.background = '#2d2454'; };
    option.onmouseout = () => { option.style.background = 'none'; };
    option.onclick = () => {
      picker.remove();
      onSelect(campaign.id);
    };
    picker.appendChild(option);
  }

  // Position near anchor
  const rect = anchor.getBoundingClientRect();
  picker.style.top = `${rect.bottom + window.scrollY + 4}px`;
  picker.style.left = `${rect.left + window.scrollX}px`;

  document.body.appendChild(picker);

  // Close on outside click
  const close = (e: MouseEvent) => {
    if (!picker.contains(e.target as Node)) {
      picker.remove();
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}
```

- [ ] **Step 4: Commit**

```bash
cd E:/Projects/QuiverDM
git add browser-extension/src/ui/
git commit -m "feat(extension): UI components — button, toast, campaign picker"
```

---

## Task 8: Content main + page handlers

**Files:**
- Create: `browser-extension/src/content/content-main.ts`
- Create: `browser-extension/src/content/pages/monster.ts`
- Create: `browser-extension/src/content/pages/character.ts`
- Create: `browser-extension/src/content/pages/spell.ts`
- Create: `browser-extension/src/content/pages/item.ts`
- Create: `browser-extension/src/content/pages/encounter.ts`
- Create: `browser-extension/src/content/pages/maps.ts`

- [ ] **Step 1: Create `browser-extension/src/content/content-main.ts`**

```typescript
// browser-extension/src/content/content-main.ts
// Isolated world — orchestrates page handlers based on current URL.

import { handleMonsterPage } from './pages/monster';
import { handleCharacterPage } from './pages/character';
import { handleSpellPage } from './pages/spell';
import { handleItemPage } from './pages/item';
import { handleEncounterPage } from './pages/encounter';
import { handleMapsPage } from './pages/maps';

// Inject page-world script into MAIN world
function injectPageWorld() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/content/page-world.ts');
  script.type = 'module';
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// Route to appropriate page handler
function routePage() {
  const path = window.location.pathname;

  if (/^\/characters\/\d+/.test(path)) { handleCharacterPage(); return; }
  if (/^\/monsters\/\d+/.test(path)) { handleMonsterPage(); return; }
  if (/^\/spells\/\d+/.test(path)) { handleSpellPage(); return; }
  if (/^\/magic-items\/\d+/.test(path)) { handleItemPage(); return; }
  if (/^\/encounters\/\d+/.test(path)) { handleEncounterPage(); return; }
  if (/^\/maps/.test(path)) { handleMapsPage(); return; }
  // Source books — handled by monster page handler detecting statblocks
  if (/^\/sources\//.test(path)) { handleMonsterPage(); return; }
}

injectPageWorld();
routePage();

// Handle SPA navigation (DDB is a React SPA)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    // Remove any existing QuiverDM buttons before re-injecting
    document.querySelectorAll('[data-quiverdm-btn]').forEach(el => el.remove());
    routePage();
  }
});
observer.observe(document.body, { childList: true, subtree: true });
```

- [ ] **Step 2: Create `browser-extension/src/content/pages/monster.ts`**

The primary data source is JSON-LD (`<script type="application/ld+json">`). Fallback to DOM scraping of the statblock.

```typescript
// browser-extension/src/content/pages/monster.ts
import { createImportButton, setButtonState } from '../../ui/button';
import { showToast } from '../../ui/toast';
import { showCampaignPicker } from '../../ui/campaign-picker';
import type { DdbMonsterImportPayload } from '../../shared/extension-types';
import type { CampaignOption } from '../../shared/types';

function extractMonsterFromJsonLd(): DdbMonsterImportPayload | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent ?? '') as Record<string, unknown>;
      if (data['@type'] === 'Monster' || data['name']) {
        // Map JSON-LD to our payload shape
        const ddbId = window.location.pathname.split('/').pop() ?? '';
        return {
          ddbId,
          name: String(data['name'] ?? 'Unknown'),
          type: String(data['monsterType'] ?? 'unknown'),
          alignment: String(data['alignment'] ?? 'unaligned'),
          ac: Number(data['armorClass'] ?? 10),
          hp: Number(data['hitPoints'] ?? 1),
          speed: { walk: Number(data['speed'] ?? 30) },
          abilityScores: {
            str: Number(data['strength'] ?? 10),
            dex: Number(data['dexterity'] ?? 10),
            con: Number(data['constitution'] ?? 10),
            int: Number(data['intelligence'] ?? 10),
            wis: Number(data['wisdom'] ?? 10),
            cha: Number(data['charisma'] ?? 10),
          },
          savingThrows: {},
          skills: {},
          damageResistances: [],
          damageImmunities: [],
          conditionImmunities: [],
          senses: {},
          languages: String(data['languages'] ?? '—'),
          cr: String(data['challengeRating'] ?? '0'),
          xp: Number(data['xpValue'] ?? 0),
          actions: [],
          sourceUrl: window.location.href,
        };
      }
    } catch { /* ignore */ }
  }
  return null;
}

async function getCampaigns(): Promise<CampaignOption[]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'get.campaigns' }, (res: CampaignOption[]) => {
      resolve(res ?? []);
    });
  });
}

async function doImport(payload: DdbMonsterImportPayload, campaignId: string, btn: HTMLButtonElement) {
  setButtonState(btn, 'loading');
  const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'import.monster', payload, campaignId },
      (res: { ok: boolean; error?: string }) => resolve(res ?? { ok: false, error: 'No response' })
    );
  });

  if (result.ok) {
    setButtonState(btn, 'success', 'Added to QuiverDM!');
    showToast(`${payload.name} added to QuiverDM`);
  } else {
    setButtonState(btn, 'error', 'Failed — try again');
    showToast(result.error ?? 'Import failed', 'error');
  }
}

export async function handleMonsterPage() {
  // Wait for DOM to be ready
  await new Promise(resolve => setTimeout(resolve, 500));

  // Find DDB's action bar
  const actionBar = document.querySelector('.mon-stat-block__actions, .detail-top-content-middle, [class*="action-bar"]');
  if (!actionBar) return;

  const payload = extractMonsterFromJsonLd();
  if (!payload) return;

  const btn = createImportButton('Add to QuiverDM');
  actionBar.appendChild(btn);

  btn.addEventListener('click', async () => {
    const campaigns = await getCampaigns();
    if (campaigns.length === 0) {
      showToast('Sign in to QuiverDM first', 'error');
      return;
    }
    if (campaigns.length === 1) {
      await doImport(payload, campaigns[0].id, btn);
    } else {
      showCampaignPicker(btn, campaigns, async (campaignId) => {
        await doImport(payload, campaignId, btn);
      });
    }
  });
}
```

- [ ] **Step 3: Create stub handlers for character, spell, item, encounter, maps**

For now these are stubs — implement the import button injection following the same pattern as `monster.ts`. Full implementation can follow in separate tasks.

Create `browser-extension/src/content/pages/character.ts`:
```typescript
// browser-extension/src/content/pages/character.ts
// Character sheet — network intercept primary (page-world.ts captures character API response)
import { createImportButton, setButtonState } from '../../ui/button';
import { showToast } from '../../ui/toast';

export async function handleCharacterPage() {
  await new Promise(resolve => setTimeout(resolve, 800));

  const ddbId = window.location.pathname.split('/')[2];
  if (!ddbId) return;

  const actionBar = document.querySelector('.character-header-desktop-menu, [class*="character-header"]');
  if (!actionBar) return;

  const btn = createImportButton('Sync to QuiverDM');
  actionBar.appendChild(btn);

  btn.addEventListener('click', async () => {
    setButtonState(btn, 'loading');
    const cobalt = await new Promise<string | null>(resolve => {
      chrome.runtime.sendMessage({ type: 'get.cobalt' }, resolve);
    });
    const result = await new Promise<{ ok: boolean; error?: string }>(resolve => {
      chrome.runtime.sendMessage({ type: 'import.character', ddbId, campaignId: '' }, resolve);
    });
    if (result.ok) {
      setButtonState(btn, 'success');
      showToast('Character synced to QuiverDM');
    } else {
      setButtonState(btn, 'error');
      showToast(result.error ?? 'Sync failed', 'error');
    }
  });
}
```

Create `browser-extension/src/content/pages/spell.ts`:
```typescript
export async function handleSpellPage() {
  // TODO: extract spell data from JSON-LD, inject button, call homebrew.createFromDDB
}
```

Create `browser-extension/src/content/pages/item.ts`:
```typescript
export async function handleItemPage() {
  // TODO: extract item data from JSON-LD, inject button, call homebrew.createFromDDB
}
```

Create `browser-extension/src/content/pages/encounter.ts`:
```typescript
export async function handleEncounterPage() {
  // TODO: extract encounter from network intercept, inject button, call encounterPlans.createFromDDB
}
```

Create `browser-extension/src/content/pages/maps.ts`:
```typescript
// browser-extension/src/content/pages/maps.ts
// MutationObserver-based combat start/end detection for DDB Maps VTT.

import type { ExtCombatStartMessage, ExtCombatEndMessage } from '../../shared/extension-types';

let combatActive = false;

function getSessionId(): string | null {
  // Retrieved from chrome.storage.local (set when user links a session)
  return null; // placeholder — implement session association flow
}

export function handleMapsPage() {
  const observer = new MutationObserver(() => {
    const initiativePanel = document.querySelector('[class*="initiative-tracker"], [data-testid="initiative"]');
    const inCombat = !!initiativePanel;

    if (inCombat && !combatActive) {
      combatActive = true;
      const sessionId = getSessionId();
      if (!sessionId) return;

      const event: ExtCombatStartMessage = {
        type: 'ext.combat.start',
        sessionId,
        initiativeOrder: [], // TODO: parse initiative panel DOM
      };
      chrome.runtime.sendMessage({ type: 'live.event', event });
    }

    if (!inCombat && combatActive) {
      combatActive = false;
      const sessionId = getSessionId();
      if (!sessionId) return;

      const event: ExtCombatEndMessage = { type: 'ext.combat.end', sessionId };
      chrome.runtime.sendMessage({ type: 'live.event', event });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
```

- [ ] **Step 4: Add `get.campaigns` and `get.cobalt` handlers to service worker**

In `service-worker.ts`, add to `handleMessage`:

```typescript
  // These require fetching from QuiverDM — add to handleMessage switch
  if ((message as { type: string }).type === 'get.campaigns') {
    return fetchUserCampaigns();
  }

  if ((message as { type: string }).type === 'get.cobalt') {
    return getCobaltCookie();
  }
```

- [ ] **Step 5: Commit**

```bash
cd E:/Projects/QuiverDM
git add browser-extension/src/content/
git commit -m "feat(extension): content scripts — page router, monster handler, stub handlers"
```

---

## Task 9: Build and load test

- [ ] **Step 1: Build extension**

```bash
cd E:/Projects/QuiverDM/browser-extension
npm run build
```

Expected: `dist/` produced with no errors.

- [ ] **Step 2: Generate key.pem for stable ID**

```bash
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
openssl rsa -in key.pem -pubout -outform DER 2>/dev/null | openssl base64 -A
```

Add the output as `"key": "<base64>"` to `manifest.json`, rebuild.

- [ ] **Step 3: Load unpacked in Chrome**

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" → select `browser-extension/dist/`
4. Verify extension loads with no errors in the extension card

- [ ] **Step 4: Test on D&D Beyond**

1. Navigate to `https://www.dndbeyond.com/monsters/4775782-goblin`
2. Verify "Add to QuiverDM" button appears in the statblock action area
3. Click it — verify auth flow triggers if not logged in
4. After auth, verify import call is made (check Network tab for tRPC call)

- [ ] **Step 5: Commit final state**

```bash
cd E:/Projects/QuiverDM
git add browser-extension/
git commit -m "feat(extension): browser extension MVP — import accelerator + WS bridge skeleton"
git push origin main
```

---

## Done

Extension MVP complete. Monster import works end-to-end. Live bridge plumbing is in place — session association and full page handler implementations (spell, item, encounter, Maps initiative parsing) are the next iteration.
