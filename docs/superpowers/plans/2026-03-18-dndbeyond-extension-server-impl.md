# D&D Beyond Extension — Server-Side Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all QuiverDM server-side pieces the browser extension needs: shared types, OAuth PKCE auth endpoints, WebSocket extension auth + event handlers, DDB monster mapper, and `createFromDDB` procedures on npcs and encounterPlans routers.

**Architecture:** Extension authenticates via PKCE OAuth — QuiverDM issues a signed JWT (jose, HS256) the extension uses for both tRPC calls and WebSocket auth. WS server gets a new parallel auth path (`ext.auth` message with JWT instead of Redis one-time token). New tRPC procedures handle import payloads from the extension.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Prisma, Redis (ioredis), WebSocket (ws), jose (install explicitly), Zod

**Spec:** `docs/superpowers/specs/2026-03-18-dndbeyond-extension-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/redis.ts` | Shared Redis singleton (eliminates scattered `new Redis(...)` instantiations) |
| Create | `src/lib/extension-types.ts` | All shared types: WS event shapes, import payloads |
| Create | `src/app/api/auth/extension/authorize/route.ts` | PKCE authorize endpoint — validates challenge, stores auth code in Redis |
| Create | `src/server/routers/extension-auth.ts` | tRPC mutations: exchangeExtensionCode, refreshExtensionToken |
| Modify | `src/server/routers/_app.ts` | Register extensionAuthRouter |
| Modify | `src/server/websocket.ts` | Add `ext.auth` JWT path + `ext.*` event handlers |
| Create | `src/lib/dndbeyond-monster-mapper.ts` | Map DDB monster JSON → QuiverDM NPC stats shape |
| Modify | `src/server/routers/npcs.ts` | Add `createFromDDB` procedure |
| Modify | `src/server/routers/encounter-plans.ts` | Add `createFromDDB` procedure |

---

## Task 0: Create shared Redis singleton

**Files:**
- Create: `src/lib/redis.ts`

No shared Redis export exists — `websocket.ts`, `play.ts`, and queue files each instantiate their own `new Redis(...)`. Create one shared singleton so the authorize route and extension-auth router can import it cleanly.

- [ ] **Step 1: Create `src/lib/redis.ts`**

```typescript
// src/lib/redis.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6380', {
  maxRetriesPerRequest: null,
});

export { redis };
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd E:/Projects/QuiverDM
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/redis.ts
git commit -m "feat(infra): shared Redis singleton at src/lib/redis.ts"
```

---

## Task 1: Install jose + shared types

**Files:**
- Modify: `package.json` (add jose)
- Create: `src/lib/extension-types.ts`

- [ ] **Step 1: Install jose**

```bash
cd E:/Projects/QuiverDM
npm install jose
```

Expected: jose added to package.json dependencies.

- [ ] **Step 2: Create `src/lib/extension-types.ts`**

```typescript
// Shared types between the browser extension and QuiverDM server.
// Extension imports a copy; server imports directly.

// ---------------------------------------------------------------------------
// WebSocket: Extension → Server
// ---------------------------------------------------------------------------

export interface ExtAuthMessage {
  type: 'ext.auth';
  token: string; // JWT access token
}

export interface ExtCharacterUpdateMessage {
  type: 'ext.character.update';
  sessionId: string;
  characterId: string; // DDB character ID (string)
  patch: CharacterStatePatch;
}

export interface ExtRollMessage {
  type: 'ext.roll';
  sessionId: string;
  characterId: string;
  roll: RollEvent;
}

export interface ExtCombatStartMessage {
  type: 'ext.combat.start';
  sessionId: string;
  initiativeOrder: InitiativeEntry[];
}

export interface ExtCombatEndMessage {
  type: 'ext.combat.end';
  sessionId: string;
}

export interface ExtTokenPlacedMessage {
  type: 'ext.token.placed';
  sessionId: string;
  npcDdbId: string;
  tokenData: Record<string, unknown>;
}

export type ExtIncomingMessage =
  | ExtAuthMessage
  | ExtCharacterUpdateMessage
  | ExtRollMessage
  | ExtCombatStartMessage
  | ExtCombatEndMessage
  | ExtTokenPlacedMessage;

// ---------------------------------------------------------------------------
// WebSocket: Server → Session Cockpit
// ---------------------------------------------------------------------------

export interface ExtPartyUpdateOutgoing {
  type: 'session.party.update';
  sessionId: string;
  source: 'extension';
  characterId: string;
  patch: CharacterStatePatch;
}

export interface ExtRollLogOutgoing {
  type: 'session.roll.log';
  sessionId: string;
  source: 'extension';
  characterId: string;
  roll: RollEvent;
}

export interface ExtCombatUpdateOutgoing {
  type: 'session.combat.update';
  sessionId: string;
  source: 'extension';
  event: 'start' | 'end';
  initiativeOrder?: InitiativeEntry[];
}

// ---------------------------------------------------------------------------
// Import Payloads: Extension → Server (via tRPC)
// ---------------------------------------------------------------------------

export interface DdbMonsterImportPayload {
  ddbId: string;
  name: string;
  type: string;
  alignment: string;
  ac: number;
  acNote?: string;
  hp: number;
  hpDice?: string;
  speed: Record<string, number>;
  abilityScores: {
    str: number; dex: number; con: number;
    int: number; wis: number; cha: number;
  };
  savingThrows: Record<string, number>;
  skills: Record<string, number>;
  damageResistances: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
  senses: Record<string, string | number>;
  languages: string;
  cr: string;
  xp: number;
  actions: DdbAction[];
  legendaryActions?: DdbAction[];
  reactions?: DdbAction[];
  traits?: DdbAction[];
  sourceUrl: string;
}

export interface DdbAction {
  name: string;
  description: string;
  attackBonus?: number;
  damageDice?: string;
  damageBonus?: number;
  saveDc?: number;
  saveType?: string;
}

export interface DdbEncounterImportPayload {
  ddbId: string;
  name: string;
  creatures: DdbEncounterCreature[];
  difficulty?: string;
  notes?: string;
}

export interface DdbEncounterCreature {
  ddbId: string;
  name: string;
  quantity: number;
  cr?: string;
  xp?: number;
}

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export interface CharacterStatePatch {
  hp?: number;
  maxHp?: number;
  tempHp?: number;
  deathSaves?: { successes: number; failures: number };
  conditions?: string[];
  spellSlots?: Record<string, { used: number; total: number }>;
  exhaustion?: number;
}

export interface RollEvent {
  formula: string;
  result: number;
  breakdown: number[];
  label?: string;
}

export interface InitiativeEntry {
  characterId?: string;
  npcName?: string;
  initiative: number;
  hp?: number;
  maxHp?: number;
}

// ---------------------------------------------------------------------------
// JWT payload
// ---------------------------------------------------------------------------

export interface ExtensionTokenPayload {
  sub: string;   // userId
  type: 'extension-access' | 'extension-refresh';
  iat: number;
  exp: number;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd E:/Projects/QuiverDM
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/extension-types.ts
git commit -m "feat(extension): add jose dep + shared extension types"
```

---

## Task 2: PKCE authorize endpoint

**Files:**
- Create: `src/app/api/auth/extension/authorize/route.ts`

The PKCE flow: extension generates a random `code_verifier`, hashes it to `code_challenge` (SHA-256, base64url). Sends `code_challenge` + `code_challenge_method=S256` to this endpoint. We store `code_challenge` in Redis keyed by a short-lived auth code UUID. Extension then sends the auth code + `code_verifier` to `exchangeExtensionCode` — we re-hash the verifier and compare to the stored challenge.

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/auth/extension/authorize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { redis } from '@/lib/redis';
import { randomUUID } from 'crypto';

const CODE_TTL_SECONDS = 600; // 10 minutes

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    // Redirect to sign-in, then come back
    const signInUrl = new URL('/auth/signin', req.nextUrl.origin);
    signInUrl.searchParams.set('callbackUrl', req.url);
    return NextResponse.redirect(signInUrl);
  }

  const { searchParams } = req.nextUrl;
  const codeChallenge = searchParams.get('code_challenge');
  const method = searchParams.get('code_challenge_method');
  const redirectUri = searchParams.get('redirect_uri');

  if (!codeChallenge || method !== 'S256' || !redirectUri) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Validate redirect_uri is a Chrome extension URI.
  // chrome.identity.getRedirectURL() returns https://<id>.chromiumapp.org/ — allow both forms.
  const isValidRedirect =
    redirectUri.startsWith('chrome-extension://') ||
    redirectUri.includes('.chromiumapp.org/');
  if (!isValidRedirect) {
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  const authCode = randomUUID();
  const key = `ext-auth-code:${authCode}`;

  await redis.set(
    key,
    JSON.stringify({
      userId: session.user.id,
      codeChallenge,
      method: 'S256',
    }),
    'EX',
    CODE_TTL_SECONDS
  );

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', authCode);
  return NextResponse.redirect(callbackUrl);
}
```

- [ ] **Step 2: Confirm redis import**

`@/lib/redis` was created in Task 0 — import directly:
```typescript
import { redis } from '@/lib/redis';
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/extension/authorize/route.ts
git commit -m "feat(extension): PKCE authorize endpoint"
```

---

## Task 3: Extension auth tRPC router

**Files:**
- Create: `src/server/routers/extension-auth.ts`
- Modify: `src/server/routers/_app.ts`

- [ ] **Step 1: Create `src/server/routers/extension-auth.ts`**

```typescript
// src/server/routers/extension-auth.ts
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { z } from 'zod';
import { redis } from '@/lib/redis'; // adjust import if needed
import { SignJWT, jwtVerify } from 'jose';
import { createHash } from 'crypto';
import { TRPCError } from '@trpc/server';
import type { ExtensionTokenPayload } from '@/lib/extension-types';

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
const ACCESS_TTL_SECONDS = 3600;      // 1 hour
const REFRESH_TTL_SECONDS = 2592000;  // 30 days

async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ type: 'extension-access' } satisfies Partial<ExtensionTokenPayload>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(SECRET);
}

async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ type: 'extension-refresh' } satisfies Partial<ExtensionTokenPayload>)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL_SECONDS}s`)
    .sign(SECRET);
}

export const extensionAuthRouter = router({
  /**
   * Exchange a PKCE auth code for access + refresh tokens.
   * Auth code is single-use (deleted from Redis on first exchange).
   */
  exchangeExtensionCode: publicProcedure
    .input(
      z.object({
        code: z.string().uuid(),
        codeVerifier: z.string().min(43).max(128),
      })
    )
    .mutation(async ({ input }) => {
      const key = `ext-auth-code:${input.code}`;
      const raw = await redis.get(key);

      if (!raw) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired auth code' });
      }

      // Single-use: delete before processing to prevent replay
      await redis.del(key);

      const stored = JSON.parse(raw) as {
        userId: string;
        codeChallenge: string;
        method: string;
      };

      // Verify PKCE: SHA-256(codeVerifier) base64url === storedCodeChallenge
      const digest = createHash('sha256').update(input.codeVerifier).digest('base64url');
      if (digest !== stored.codeChallenge) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'PKCE verification failed' });
      }

      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(stored.userId),
        signRefreshToken(stored.userId),
      ]);

      return { accessToken, refreshToken };
    }),

  /**
   * Exchange a valid refresh token for a new access token.
   */
  refreshExtensionToken: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input }) => {
      let payload: ExtensionTokenPayload;
      try {
        const { payload: p } = await jwtVerify(input.refreshToken, SECRET);
        payload = p as ExtensionTokenPayload;
      } catch {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' });
      }

      if (payload.type !== 'extension-refresh') {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Wrong token type' });
      }

      const accessToken = await signAccessToken(payload.sub);
      return { accessToken };
    }),
});

export type ExtensionAuthRouter = typeof extensionAuthRouter;
```

- [ ] **Step 2: Register in `_app.ts`**

Add to `src/server/routers/_app.ts`:

```typescript
// Add import:
import { extensionAuthRouter } from './extension-auth';

// Add to appRouter:
extensionAuth: extensionAuthRouter,
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/extension-auth.ts src/server/routers/_app.ts
git commit -m "feat(extension): tRPC extension auth router — PKCE code exchange + token refresh"
```

---

## Task 4: WebSocket server — extension auth + event handlers

**Files:**
- Modify: `src/server/websocket.ts`

The WS server needs two additions:
1. A new auth path: when an unauthenticated WS client sends `{ type: 'ext.auth', token }`, verify the JWT and register the client without a Redis round-trip.
2. Handlers for `ext.character.update`, `ext.roll`, `ext.combat.start`, `ext.combat.end`, `ext.token.placed` — normalise and broadcast to session cockpit subscribers.

- [ ] **Step 1: Add imports at top of `src/server/websocket.ts`**

Add after existing imports:

```typescript
import { jwtVerify } from 'jose';
import type {
  ExtIncomingMessage,
  ExtensionTokenPayload,
} from '@/lib/extension-types';
```

- [ ] **Step 2: Add extension client state map**

After `const liveClients = new Map...` line, add:

```typescript
// Extension clients: authenticated via JWT, not Redis one-time token
const extClients = new Map<WebSocket, { userId: string; sessionId?: string }>();
```

- [ ] **Step 3: Add `handleExtAuth` function**

Add before `handleSocketMessage`:

```typescript
async function handleExtAuth(ws: WebSocket, token: string) {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  try {
    const { payload } = await jwtVerify(token, secret);
    const ext = payload as ExtensionTokenPayload;
    if (ext.type !== 'extension-access') {
      sendJSON(ws, { type: 'ext.auth.error', error: 'Wrong token type' });
      ws.close(4003, 'Wrong token type');
      return;
    }
    extClients.set(ws, { userId: ext.sub });
    sendJSON(ws, { type: 'ext.auth.ok', userId: ext.sub });
  } catch {
    sendJSON(ws, { type: 'ext.auth.error', error: 'Invalid or expired token' });
    ws.close(4001, 'Invalid token');
  }
}
```

- [ ] **Step 4: Add extension event handler function**

Add after `handleExtAuth`:

```typescript
function handleExtMessage(ws: WebSocket, message: ExtIncomingMessage) {
  const client = extClients.get(ws);
  if (!client) {
    sendJSON(ws, { type: 'error', message: 'Not authenticated as extension client' });
    return;
  }

  if (message.type === 'ext.character.update') {
    // Associate session on first message
    if (!client.sessionId) {
      client.sessionId = message.sessionId;
      extClients.set(ws, client);
    }
    broadcastToSession(message.sessionId, {
      type: 'session.party.update',
      sessionId: message.sessionId,
      source: 'extension',
      characterId: message.characterId,
      patch: message.patch,
    });
    return;
  }

  if (message.type === 'ext.roll') {
    broadcastToSession(message.sessionId, {
      type: 'session.roll.log',
      sessionId: message.sessionId,
      source: 'extension',
      characterId: message.characterId,
      roll: message.roll,
    });
    return;
  }

  if (message.type === 'ext.combat.start') {
    broadcastToSession(message.sessionId, {
      type: 'session.combat.update',
      sessionId: message.sessionId,
      source: 'extension',
      event: 'start',
      initiativeOrder: message.initiativeOrder,
    });
    return;
  }

  if (message.type === 'ext.combat.end') {
    broadcastToSession(message.sessionId, {
      type: 'session.combat.update',
      sessionId: message.sessionId,
      source: 'extension',
      event: 'end',
    });
    return;
  }

  if (message.type === 'ext.token.placed') {
    broadcastToSession(message.sessionId, {
      type: 'session.token.placed',
      sessionId: message.sessionId,
      source: 'extension',
      npcDdbId: message.npcDdbId,
      tokenData: message.tokenData,
    });
    return;
  }
}
```

- [ ] **Step 5: Wire into `handleSocketMessage`**

In `handleSocketMessage`, add before the final `sendJSON` error line:

```typescript
  // Extension client auth
  if (message.type === 'ext.auth') {
    await handleExtAuth(ws, (message as { type: 'ext.auth'; token: string }).token);
    return;
  }

  // Extension client events
  if (message.type?.startsWith('ext.')) {
    handleExtMessage(ws, message as unknown as ExtIncomingMessage);
    return;
  }
```

- [ ] **Step 6: Clean up ext clients on disconnect**

In the `ws.on('close', ...)` handler (find it in `initWebSocketServer`), add:

```typescript
extClients.delete(ws);
```

- [ ] **Step 7: Add `ext.auth` to the `IncomingMessage` union**

At the top of `websocket.ts`, add to the `IncomingMessage` union:

```typescript
| { type: 'ext.auth'; token: string }
```

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 9: Commit**

```bash
git add src/server/websocket.ts
git commit -m "feat(extension): WS server — ext.auth JWT path + ext.* event handlers"
```

---

## Task 5: DDB monster mapper + npcs.createFromDDB

**Files:**
- Create: `src/lib/dndbeyond-monster-mapper.ts`
- Modify: `src/server/routers/npcs.ts`

The DDB monster JSON shape is documented in the `ddb-importer` open-source project. The mapper converts it to QuiverDM's NPC `stats` JSON field (flexible shape) and top-level fields (name, description, faction/role = type + CR).

- [ ] **Step 1: Create `src/lib/dndbeyond-monster-mapper.ts`**

```typescript
// src/lib/dndbeyond-monster-mapper.ts
// Maps DDB monster payload (from extension) to QuiverDM NPC shape.
import type { DdbMonsterImportPayload } from '@/lib/extension-types';

export interface MappedNpc {
  name: string;
  description: string;
  faction: string;   // monster type (beast, humanoid, etc.)
  role: string;      // CR string
  tags: string[];
  stats: Record<string, unknown>;
}

export function mapDdbMonsterToNpc(monster: DdbMonsterImportPayload): MappedNpc {
  const description = [
    `${monster.type} (CR ${monster.cr})`,
    monster.alignment,
  ]
    .filter(Boolean)
    .join(', ');

  const stats = {
    // Core
    cr: monster.cr,
    xp: monster.xp,
    type: monster.type,
    alignment: monster.alignment,
    // Defense
    ac: monster.ac,
    acNote: monster.acNote,
    hp: monster.hp,
    hpDice: monster.hpDice,
    speed: monster.speed,
    // Ability scores
    abilityScores: monster.abilityScores,
    savingThrows: monster.savingThrows,
    skills: monster.skills,
    // Resistances
    damageResistances: monster.damageResistances,
    damageImmunities: monster.damageImmunities,
    conditionImmunities: monster.conditionImmunities,
    // Senses + languages
    senses: monster.senses,
    languages: monster.languages,
    // Actions
    traits: monster.traits ?? [],
    actions: monster.actions,
    legendaryActions: monster.legendaryActions ?? [],
    reactions: monster.reactions ?? [],
    // Source
    ddbId: monster.ddbId,
    sourceUrl: monster.sourceUrl,
  };

  return {
    name: monster.name,
    description,
    faction: monster.type,
    role: `CR ${monster.cr}`,
    tags: ['ddb-import', monster.type, `cr-${monster.cr}`].filter(Boolean),
    stats,
  };
}
```

- [ ] **Step 2: Add `createFromDDB` to `src/server/routers/npcs.ts`**

Add this procedure to the `npcsRouter` object (after the last existing procedure):

```typescript
  /**
   * Create an NPC from a D&D Beyond monster import payload.
   * Called by the browser extension.
   */
  createFromDDB: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        monster: z.object({
          ddbId: z.string(),
          name: z.string(),
          type: z.string(),
          alignment: z.string(),
          ac: z.number(),
          acNote: z.string().optional(),
          hp: z.number(),
          hpDice: z.string().optional(),
          speed: z.record(z.number()),
          abilityScores: z.object({
            str: z.number(), dex: z.number(), con: z.number(),
            int: z.number(), wis: z.number(), cha: z.number(),
          }),
          savingThrows: z.record(z.number()),
          skills: z.record(z.number()),
          damageResistances: z.array(z.string()),
          damageImmunities: z.array(z.string()),
          conditionImmunities: z.array(z.string()),
          senses: z.record(z.union([z.string(), z.number()])),
          languages: z.string(),
          cr: z.string(),
          xp: z.number(),
          actions: z.array(z.object({
            name: z.string(),
            description: z.string(),
            attackBonus: z.number().optional(),
            damageDice: z.string().optional(),
            damageBonus: z.number().optional(),
            saveDc: z.number().optional(),
            saveType: z.string().optional(),
          })),
          legendaryActions: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
          reactions: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
          traits: z.array(z.object({ name: z.string(), description: z.string() })).optional(),
          sourceUrl: z.string(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { mapDdbMonsterToNpc } = await import('@/lib/dndbeyond-monster-mapper');
      const mapped = mapDdbMonsterToNpc(input.monster);
      const npc = await npcService.create(input.campaignId, ctx.session.user.id, {
        name: mapped.name,
        description: mapped.description,
        faction: mapped.faction,
        stats: mapped.stats,
        tags: mapped.tags,
      });
      void serverTrack(ctx.session.user.id, EVENTS.NPC_CREATED, {
        source: 'ddb-extension',
        campaignId: input.campaignId,
      });
      return npc;
    }),
```

Add the import at the top of `npcs.ts` if not already present:
```typescript
import { campaignDMProcedure } from '../trpc';
```
(Use `protectedProcedure` — the NPC service handles membership checks internally.)

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/dndbeyond-monster-mapper.ts src/server/routers/npcs.ts
git commit -m "feat(extension): DDB monster mapper + npcs.createFromDDB"
```

---

## Task 6: encounterPlans.createFromDDB

**Files:**
- Modify: `src/server/routers/encounter-plans.ts`

DDB encounter payload lists creatures (with DDB IDs, names, quantities, CR, XP). Map to an EncounterPlan with EncounterPlanCreature rows.

- [ ] **Step 1: Add `createFromDDB` to `src/server/routers/encounter-plans.ts`**

Add after the last existing procedure:

```typescript
  /**
   * Create an encounter plan from a D&D Beyond encounter payload.
   * Called by the browser extension.
   */
  createFromDDB: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        encounter: z.object({
          ddbId: z.string(),
          name: z.string(),
          creatures: z.array(z.object({
            ddbId: z.string(),
            name: z.string(),
            quantity: z.number().int().min(1),
            cr: z.string().optional(),
            xp: z.number().optional(),
          })),
          difficulty: z.string().optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Calculate total XP from creatures
      const totalXp = input.encounter.creatures.reduce(
        (sum, c) => sum + (c.xp ?? 0) * c.quantity,
        0
      );

      const plan = await encounterPlanService.create(input.campaignId, ctx.session.user.id, {
        name: input.encounter.name,
        difficulty: (input.encounter.difficulty as 'easy' | 'medium' | 'hard' | 'deadly') ?? 'medium',
      });

      // Store notes as tacticalNotes if the service supports it
      if (input.encounter.notes) {
        await encounterPlanService.update(plan.id, ctx.session.user.id, {
          tacticalNotes: input.encounter.notes,
        });
      }

      // Add creatures to the plan — service uses `count`, not `quantity`
      for (const creature of input.encounter.creatures) {
        await encounterPlanService.addCreature(plan.id, ctx.session.user.id, {
          name: creature.name,
          count: creature.quantity,
          sourceType: 'custom',
          cr: creature.cr ? parseFloat(creature.cr) : undefined,
          xp: creature.xp,
        });
      }

      return plan;
    }),
```

- [ ] **Step 2: Verify service method names**

```bash
grep -n "addCreature\|update\b" E:/Projects/QuiverDM/src/server/services/encounter-plan.service.ts | head -10
```

Confirm `addCreature` and `update` exist with the expected signatures. If `update` doesn't accept `tacticalNotes`, drop the notes update step — it's non-essential.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/encounter-plans.ts
git commit -m "feat(extension): encounterPlans.createFromDDB"
```

---

## Task 7: Integration smoke test

No automated tests for the WS extension path (requires a running WS server and extension). Verify manually:

- [ ] **Step 1: Start dev server + WS server**

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev:ws
```

- [ ] **Step 2: Test PKCE authorize endpoint**

Visit in browser (must be logged in):
```
http://localhost:3847/api/auth/extension/authorize?code_challenge=abc123&code_challenge_method=S256&redirect_uri=chrome-extension://fake/callback
```

Expected: redirect to `chrome-extension://fake/callback?code=<uuid>`.

- [ ] **Step 3: Test tRPC endpoints exist**

```bash
curl -s http://localhost:3847/api/trpc/extensionAuth.exchangeExtensionCode \
  -H "Content-Type: application/json" \
  --data '{"json":{"code":"00000000-0000-0000-0000-000000000000","codeVerifier":"test"}}' | python3 -m json.tool
```

Expected: JSON response with `error.data.code: "UNAUTHORIZED"` (code doesn't exist) — confirms endpoint is wired up.

- [ ] **Step 4: Push to prod**

```bash
git push origin main
```

---

## Done

Server side complete. The browser extension (Plan B) can now authenticate, import content, and stream live events to QuiverDM.
