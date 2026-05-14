# Foundry VTT Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a hosted Foundry VTT instance into the QuiverDM session cockpit — session NPCs sync as actors/tokens, combat events (HP, death, conditions, initiative) update the cockpit in real time, DMs never leave the QuiverDM UI during a session.

**Architecture:** A client-side Foundry module (`quiver-embed`) strips UI chrome on `?quiver=1`, hooks into Foundry's combat events and POSTs them to a new QuiverDM API route, and polls a job queue to receive actor/token sync commands from QuiverDM. The session cockpit replaces its center column with the Foundry iframe when combat mode is active. QuiverDM remains the source of truth; Foundry is the rendering engine.

**Tech Stack:** Foundry VTT v12 (ESM browser module, Hooks API), Next.js 15 API routes, tRPC v11, Prisma (`FoundryEvent` + `FoundryImportJob`), React, bcryptjs

---

## File Map

**New files:**
- `foundry-modules/quiver-embed/module.json` — Foundry module manifest
- `foundry-modules/quiver-embed/scripts/quiver-embed.mjs` — all module logic (chrome strip, event hooks, job polling)
- `src/app/api/foundry/events/route.ts` — POST: receives events POSTed from the Foundry module
- `src/app/api/foundry/jobs/route.ts` — GET/PATCH: job queue for actor/token sync commands
- `src/lib/foundry-auth.ts` — shared API key verification helper
- `src/components/cockpit/battle-map-panel.tsx` — Foundry iframe + sync button, handles unconfigured state
- `src/components/cockpit/initiative-panel.tsx` — real-time initiative order from FoundryEvent polling

**Modified files:**
- `src/server/routers/foundry.ts` — add `syncSession` and `activateScene` mutations
- `src/server/routers/world-map.ts` — add `setFoundryScene` mutation
- `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx` — combat mode = BattleMapPanel in center + Initiative tab
- `src/components/world/foundry-panel.tsx` — add `embedded` prop to skip header bar
- `src/components/world/location-panel.tsx` — "Open as battle map" pin action

---

### Task 1: QuiverDM API routes for the Foundry bridge

The Foundry module is a different browser origin and can't use tRPC. These are plain Next.js route handlers.

**Files:**
- Create: `src/lib/foundry-auth.ts`
- Create: `src/app/api/foundry/events/route.ts`
- Create: `src/app/api/foundry/jobs/route.ts`

- [ ] **Step 1: Create auth helper**

Create `src/lib/foundry-auth.ts`:

```typescript
import bcrypt from 'bcryptjs'
import { prisma } from '@/server/db'

export async function verifyFoundryRequest(
  req: Request,
  campaignId: string,
): Promise<boolean> {
  const key = req.headers.get('X-Quiver-Key')
  if (!key) return false
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { foundryApiKey: true },
  })
  if (!campaign?.foundryApiKey) return false
  return bcrypt.compare(key, campaign.foundryApiKey)
}
```

- [ ] **Step 2: Create events POST route**

Create `src/app/api/foundry/events/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { verifyFoundryRequest } from '@/lib/foundry-auth'
import { z } from 'zod'

const BodySchema = z.object({
  campaignId: z.string().cuid(),
  sessionId: z.string().cuid(),
  type: z.string(),
  payload: z.record(z.unknown()),
  foundryTimestamp: z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const { campaignId, sessionId, type, payload, foundryTimestamp } = parsed.data

  const ok = await verifyFoundryRequest(req, campaignId)
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  await prisma.foundryEvent.create({
    data: {
      campaignId,
      sessionId,
      type,
      payload,
      foundryTimestamp: foundryTimestamp ? new Date(foundryTimestamp) : null,
    },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create jobs GET/PATCH route**

Create `src/app/api/foundry/jobs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { verifyFoundryRequest } from '@/lib/foundry-auth'

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaignId')
  if (!campaignId) return NextResponse.json({ error: 'missing_campaign' }, { status: 400 })

  const ok = await verifyFoundryRequest(req, campaignId)
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const jobs = await prisma.foundryImportJob.findMany({
    where: { campaignId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { id: true, type: true, payload: true, sourceName: true },
  })

  return NextResponse.json({ jobs })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const { jobId, campaignId, status, error } = body ?? {}
  if (!jobId || !campaignId) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

  const ok = await verifyFoundryRequest(req, campaignId)
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  await prisma.foundryImportJob.update({
    where: { id: jobId },
    data: {
      status: status ?? 'delivered',
      deliveredAt: status !== 'error' ? new Date() : null,
      error: error ?? null,
    },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "foundry-auth\|foundry/events\|foundry/jobs"
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/foundry-auth.ts src/app/api/foundry/
git commit -m "feat(foundry): API routes for event ingestion and job queue"
```

---

### Task 2: `syncSession` and `activateScene` tRPC mutations

**Files:**
- Modify: `src/server/routers/foundry.ts`

`NpcExportInput` requires `{ id, name, description?, faction?, role?, imageUrl?, stats? }`. The `syncSession` mutation queries NPCs via their `WorldEntity` appearances in the session, maps them with the existing `mapNpcToActor`, then enqueues `FoundryImportJob` records for the module to consume.

- [ ] **Step 1: Add syncSession mutation**

Open `src/server/routers/foundry.ts`. Add this import at the top of the file:

```typescript
import { mapNpcToActor } from '@/lib/foundry-export'
```

Add the mutation inside the `router({...})` block, after `setDdbVttUrl`:

```typescript
syncSession: campaignDMProcedure
  .input(z.object({ campaignId: z.string(), sessionId: z.string().cuid() }))
  .mutation(async ({ input }) => {
    // Session NPC appearances (WorldEntity records linked to this session)
    const appearances = await prisma.sessionEntityAppearance.findMany({
      where: { sessionId: input.sessionId },
      include: {
        entity: {
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            properties: true,
          },
        },
      },
    })

    // Party characters in this campaign
    const characters = await prisma.character.findMany({
      where: { campaignId: input.campaignId },
      select: { id: true, name: true, imageUrl: true },
    })

    const jobs: Array<{
      campaignId: string
      type: string
      sourceId: string
      sourceName: string
      payload: object
      status: string
    }> = []

    // NPC actor upsert jobs
    for (const app of appearances) {
      const actor = mapNpcToActor({
        id: app.entity.id,
        name: app.entity.name,
        description: app.entity.description,
        imageUrl: app.entity.imageUrl,
      })
      jobs.push({
        campaignId: input.campaignId,
        type: 'actor_upsert',
        sourceId: app.entity.id,
        sourceName: app.entity.name,
        payload: actor,
        status: 'pending',
      })
    }

    // Player actor upsert jobs
    for (const char of characters) {
      jobs.push({
        campaignId: input.campaignId,
        type: 'actor_upsert',
        sourceId: char.id,
        sourceName: char.name,
        payload: {
          name: char.name,
          type: 'character',
          img: char.imageUrl ?? 'icons/svg/mystery-man.svg',
          system: { attributes: { hp: { value: 0, max: 0 } } },
        },
        status: 'pending',
      })
    }

    // Token placement job — includes sessionId so module can store it on combat
    if (appearances.length > 0 || characters.length > 0) {
      jobs.push({
        campaignId: input.campaignId,
        type: 'token_place',
        sourceId: input.sessionId,
        sourceName: 'Session tokens',
        payload: {
          sessionId: input.sessionId,
          npcSourceIds: appearances.map((a) => a.entity.id),
          playerSourceIds: characters.map((c) => c.id),
        },
        status: 'pending',
      })
    }

    if (jobs.length > 0) {
      await prisma.foundryImportJob.createMany({ data: jobs })
    }

    return { queued: jobs.length }
  }),
```

- [ ] **Step 2: Add activateScene mutation**

In the same `router({...})` block, after `syncSession`:

```typescript
activateScene: campaignDMProcedure
  .input(z.object({ campaignId: z.string(), foundrySceneId: z.string() }))
  .mutation(async ({ input }) => {
    await prisma.foundryImportJob.create({
      data: {
        campaignId: input.campaignId,
        type: 'scene_activate',
        sourceId: input.foundrySceneId,
        sourceName: 'Scene activation',
        payload: { sceneId: input.foundrySceneId },
        status: 'pending',
      },
    })
    return { ok: true }
  }),
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "foundry.ts\|syncSession\|activateScene"
```

Fix any errors. The most likely issue is `SessionEntityAppearance` — check if this model exists: `grep "SessionEntityAppearance" prisma/schema.prisma`. If it doesn't, replace the appearances query with a direct NPC lookup via the session's prep data or remove it and only sync characters.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/foundry.ts
git commit -m "feat(foundry): syncSession and activateScene tRPC mutations"
```

---

### Task 3: `quiver-embed` Foundry module — scaffold, settings, chrome strip

**Files:**
- Create: `foundry-modules/quiver-embed/module.json`
- Create: `foundry-modules/quiver-embed/scripts/quiver-embed.mjs`

- [ ] **Step 1: Create directory**

```bash
mkdir -p foundry-modules/quiver-embed/scripts
```

- [ ] **Step 2: Create module.json**

Create `foundry-modules/quiver-embed/module.json`:

```json
{
  "id": "quiver-embed",
  "title": "QuiverDM Embed",
  "description": "Strips Foundry UI chrome for QuiverDM integration and bridges combat events bidirectionally.",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "12",
    "verified": "12"
  },
  "esmodules": ["scripts/quiver-embed.mjs"],
  "authors": [{ "name": "QuiverDM", "url": "https://quiverdm.com" }],
  "url": "https://foundry.nerdt.au/modules/quiver-embed/module.json",
  "manifest": "https://foundry.nerdt.au/modules/quiver-embed/module.json"
}
```

- [ ] **Step 3: Create the module script**

Create `foundry-modules/quiver-embed/scripts/quiver-embed.mjs`:

```javascript
// QuiverDM Embed Module — Foundry VTT v12
// Runs client-side in the GM's browser only.

const MODULE_ID = 'quiver-embed'

// Module-level state
let currentSessionId = null  // set when token_place job is processed
let pollingInterval = null

// ─── Settings registration ─────────────────────────────────────────────────

Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'quiverBaseUrl', {
    name: 'QuiverDM Base URL',
    hint: 'e.g. https://quiverdm.com',
    scope: 'world',
    config: true,
    type: String,
    default: 'https://quiverdm.com',
  })
  game.settings.register(MODULE_ID, 'campaignId', {
    name: 'Campaign ID',
    hint: 'The QuiverDM campaign CUID for this world',
    scope: 'world',
    config: true,
    type: String,
    default: '',
  })
  game.settings.register(MODULE_ID, 'apiKey', {
    name: 'API Key',
    hint: 'Generate in QuiverDM → Campaign Settings → Foundry tab',
    scope: 'world',
    config: true,
    type: String,
    default: '',
  })
})

// ─── Ready hook ───────────────────────────────────────────────────────────

Hooks.once('ready', () => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('quiver') === '1') {
    stripChrome()
  }
  if (!game.user.isGM) return
  registerCombatHooks()
  startJobPolling()
})

// ─── Chrome strip ─────────────────────────────────────────────────────────

function stripChrome() {
  const style = document.createElement('style')
  style.id = 'quiver-chrome-strip'
  style.textContent = `
    #navigation, #controls, #hotbar, #sidebar,
    #players, #pause, #fps, #logo { display: none !important; }
    #board {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
    }
    body { overflow: hidden; }
  `
  document.head.appendChild(style)
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function cfg(key) {
  return game.settings.get(MODULE_ID, key)
}

async function postEvent(type, payload) {
  const baseUrl = cfg('quiverBaseUrl')
  const campaignId = cfg('campaignId')
  const apiKey = cfg('apiKey')
  if (!campaignId || !apiKey || !currentSessionId) return

  await fetch(`${baseUrl}/api/foundry/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Quiver-Key': apiKey,
    },
    body: JSON.stringify({
      campaignId,
      sessionId: currentSessionId,
      type,
      payload,
      foundryTimestamp: new Date().toISOString(),
    }),
  }).catch((err) => console.warn('[quiver-embed] event post failed:', err))
}
```

- [ ] **Step 4: Commit scaffold**

```bash
git add foundry-modules/
git commit -m "feat(foundry-module): quiver-embed scaffold — manifest, settings, chrome strip"
```

---

### Task 4: `quiver-embed` — combat event hooks

**Files:**
- Modify: `foundry-modules/quiver-embed/scripts/quiver-embed.mjs` (append)

- [ ] **Step 1: Append registerCombatHooks**

Append to `foundry-modules/quiver-embed/scripts/quiver-embed.mjs`:

```javascript
// ─── Combat event hooks ───────────────────────────────────────────────────

function registerCombatHooks() {
  // HP changes and death detection
  Hooks.on('updateActor', (actor, diff) => {
    const hpDiff = diff?.system?.attributes?.hp
    if (!hpDiff) return

    const currentHp = actor.system.attributes.hp.value
    const maxHp = actor.system.attributes.hp.max

    postEvent('hp_change', {
      actorId: actor.id,
      actorName: actor.name,
      hp: currentHp,
      hpMax: maxHp,
    })

    if (currentHp === 0) {
      postEvent('actor_death', {
        actorId: actor.id,
        actorName: actor.name,
      })
    }
  })

  // Conditions added (ActiveEffects represent conditions in Foundry v12)
  Hooks.on('createActiveEffect', (effect) => {
    const actor = effect.parent
    if (!actor || !(actor instanceof Actor)) return
    postEvent('condition_added', {
      actorId: actor.id,
      actorName: actor.name,
      conditionId: effect.id,
      conditionLabel: effect.name ?? effect.label,
    })
  })

  // Conditions removed
  Hooks.on('deleteActiveEffect', (effect) => {
    const actor = effect.parent
    if (!actor || !(actor instanceof Actor)) return
    postEvent('condition_removed', {
      actorId: actor.id,
      actorName: actor.name,
      conditionId: effect.id,
      conditionLabel: effect.name ?? effect.label,
    })
  })

  // Initiative order changes (combat tracker updates)
  Hooks.on('updateCombat', (combat, diff) => {
    // Only fire on meaningful changes (turn/round advances or initiative rolls)
    if (diff.turn === undefined && diff.round === undefined && !diff.combatants) return

    const order = combat.turns.map((t) => ({
      actorId: t.actorId,
      actorName: t.name,
      initiative: t.initiative,
      defeated: t.isDefeated,
    }))

    postEvent('initiative_set', {
      order,
      round: combat.round,
      turn: combat.turn,
    })
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add foundry-modules/quiver-embed/scripts/quiver-embed.mjs
git commit -m "feat(foundry-module): combat hooks — HP, death, conditions, initiative"
```

---

### Task 5: `quiver-embed` — job polling (QuiverDM → Foundry sync)

**Files:**
- Modify: `foundry-modules/quiver-embed/scripts/quiver-embed.mjs` (append)

- [ ] **Step 1: Append job polling and handlers**

Append to `foundry-modules/quiver-embed/scripts/quiver-embed.mjs`:

```javascript
// ─── Job polling ─────────────────────────────────────────────────────────

function startJobPolling() {
  if (pollingInterval) return
  pollJobs()  // immediate first poll
  pollingInterval = setInterval(pollJobs, 5000)
}

async function pollJobs() {
  const baseUrl = cfg('quiverBaseUrl')
  const campaignId = cfg('campaignId')
  const apiKey = cfg('apiKey')
  if (!campaignId || !apiKey) return

  let data
  try {
    const res = await fetch(`${baseUrl}/api/foundry/jobs?campaignId=${campaignId}`, {
      headers: { 'X-Quiver-Key': apiKey },
    })
    data = await res.json()
  } catch {
    return  // network error — skip this poll cycle
  }

  for (const job of data.jobs ?? []) {
    let status = 'delivered'
    let error = null
    try {
      if (job.type === 'actor_upsert') await handleActorUpsert(job.payload, job.id)
      else if (job.type === 'token_place') await handleTokenPlace(job.payload)
      else if (job.type === 'scene_activate') await handleSceneActivate(job.payload)
    } catch (err) {
      status = 'error'
      error = String(err)
      console.error(`[quiver-embed] job ${job.id} (${job.type}) failed:`, err)
    }

    // Mark job delivered/error (fire-and-forget)
    fetch(`${baseUrl}/api/foundry/jobs`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Quiver-Key': apiKey },
      body: JSON.stringify({ jobId: job.id, campaignId, status, error }),
    }).catch(() => {})
  }
}

async function handleActorUpsert(actorData, jobId) {
  // Key actors by a flag so re-syncing updates rather than duplicates
  const sourceId = actorData._quiverSourceId ?? jobId
  const existing = game.actors.find(
    (a) => a.getFlag(MODULE_ID, 'sourceId') === sourceId,
  )
  if (existing) {
    await existing.update(actorData)
  } else {
    await Actor.create({
      ...actorData,
      flags: { [MODULE_ID]: { sourceId } },
    })
  }
}

async function handleTokenPlace(payload) {
  const scene = game.scenes.active
  if (!scene) throw new Error('No active scene — activate a scene in Foundry first')

  const { sessionId, npcSourceIds = [], playerSourceIds = [] } = payload

  // Store sessionId so postEvent has it for all subsequent combat events
  if (sessionId) currentSessionId = sessionId

  // Also store it on the active combat if one exists
  const combat = game.combats.active
  if (combat && sessionId) {
    await combat.setFlag(MODULE_ID, 'sessionId', sessionId)
  }

  const gridSize = scene.grid?.size ?? 100
  const tokenData = []
  let col = 1

  for (const sourceId of npcSourceIds) {
    const actor = game.actors.find((a) => a.getFlag(MODULE_ID, 'sourceId') === sourceId)
    if (!actor) continue
    tokenData.push({
      name: actor.name,
      actorId: actor.id,
      x: col * gridSize,
      y: gridSize,
      disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
    })
    col++
  }

  col = 1
  for (const sourceId of playerSourceIds) {
    const actor = game.actors.find((a) => a.getFlag(MODULE_ID, 'sourceId') === sourceId)
    if (!actor) continue
    tokenData.push({
      name: actor.name,
      actorId: actor.id,
      x: col * gridSize,
      y: (scene.height ?? 1000) - gridSize * 2,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    })
    col++
  }

  if (tokenData.length > 0) {
    await scene.createEmbeddedDocuments('Token', tokenData)
  }
}

async function handleSceneActivate(payload) {
  const scene = game.scenes.get(payload.sceneId)
  if (!scene) throw new Error(`Scene ${payload.sceneId} not found in this world`)
  await scene.activate()
}
```

- [ ] **Step 2: Commit**

```bash
git add foundry-modules/quiver-embed/scripts/quiver-embed.mjs
git commit -m "feat(foundry-module): job polling — actor upsert, token place, scene activate"
```

---

### Task 6: Cockpit layout — combat mode = battle map center

**Files:**
- Modify: `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx`

- [ ] **Step 1: Add imports**

Open the file and add to the import block:

```typescript
import { BattleMapPanel } from '@/components/cockpit/battle-map-panel'
import { InitiativePanel } from '@/components/cockpit/initiative-panel'
```

- [ ] **Step 2: Replace CombatPanel with BattleMapPanel in combat mode**

Find this block (around line 172):

```tsx
{mode === 'rp' ? (
  <LiveNotesPanel
    sessionId={sessionId}
    initialNotes={session.quickNotes ?? ''}
    dmHints={transcription.dmHints}
  />
) : (
  <CombatPanel sessionId={sessionId} />
)}
```

Replace with:

```tsx
{mode === 'rp' ? (
  <LiveNotesPanel
    sessionId={sessionId}
    initialNotes={session.quickNotes ?? ''}
    dmHints={transcription.dmHints}
  />
) : (
  <BattleMapPanel campaignId={campaign.id} sessionId={sessionId} />
)}
```

- [ ] **Step 3: Add Initiative tab to right panel**

Find the `<TabsList>` in the right column (has Scene, NPCs, Brain, Co-DM triggers). Add:

```tsx
<TabsTrigger value="initiative" className="flex-1 text-xs">Initiative</TabsTrigger>
```

Add the matching `<TabsContent>` inside the same `<Tabs>` block, alongside the other content panels:

```tsx
<TabsContent value="initiative" className="flex-1 overflow-y-auto m-0 p-3">
  <InitiativePanel campaignId={campaign.id} sessionId={sessionId} />
</TabsContent>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "live/page"
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx"
git commit -m "feat(cockpit): battle map center in combat mode + initiative tab"
```

---

### Task 7: BattleMapPanel component

**Files:**
- Create: `src/components/cockpit/battle-map-panel.tsx`
- Modify: `src/components/world/foundry-panel.tsx`

- [ ] **Step 1: Add `embedded` prop to FoundryPanel**

Open `src/components/world/foundry-panel.tsx`.

Change the interface:
```typescript
interface FoundryPanelProps {
  campaignId: string
  onClose: () => void
  embedded?: boolean
}
```

Change the component signature:
```typescript
export function FoundryPanel({ campaignId, onClose, embedded = false }: FoundryPanelProps) {
```

Wrap the header `<div>` with a conditional so it only renders when `!embedded`:

```tsx
{!embedded && (
  <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-card/90 px-3 backdrop-blur-sm">
    {/* ... existing header content unchanged ... */}
  </div>
)}
```

The content `<div className="relative flex-1 overflow-hidden">` block stays unchanged.

- [ ] **Step 2: Create BattleMapPanel**

Create `src/components/cockpit/battle-map-panel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Map, RefreshCw, ExternalLink } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FoundryPanel } from '@/components/world/foundry-panel'

interface BattleMapPanelProps {
  campaignId: string
  sessionId: string
}

export function BattleMapPanel({ campaignId, sessionId }: BattleMapPanelProps) {
  const [syncing, setSyncing] = useState(false)

  const { data: settings, isLoading } = trpc.foundry.getSettings.useQuery({ campaignId })
  const syncSession = trpc.foundry.syncSession.useMutation({
    onMutate: () => setSyncing(true),
    onSuccess: ({ queued }) => {
      toast.success(`Queued ${queued} entities — Foundry will update within 5 seconds`)
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setSyncing(false),
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--q-amber)] border-t-transparent" />
      </div>
    )
  }

  if (!settings?.foundryUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <Map className="h-12 w-12 text-[var(--q-text-faint)]" />
        <div>
          <p className="font-[var(--q-font-display)] text-sm text-[var(--q-text)]">
            Foundry not configured
          </p>
          <p className="mt-1 text-xs text-[var(--q-text-faint)]">
            Add your Foundry URL in campaign settings to enable the battle map.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--q-border-subtle)] bg-[var(--q-surface-feature)] px-3 py-1.5">
        <Map className="h-3.5 w-3.5 text-[var(--q-amber)]" />
        <span className="flex-1 truncate font-[var(--q-font-display)] text-[9px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
          Battle Map
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 px-2 text-[10px] text-[var(--q-amber)] hover:bg-[var(--q-amber-trace)] hover:text-[var(--q-amber)]"
          disabled={syncing}
          onClick={() => syncSession.mutate({ campaignId, sessionId })}
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync to Foundry'}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
          <a href={settings.foundryUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 text-[var(--q-text-faint)]" />
          </a>
        </Button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <FoundryPanel campaignId={campaignId} onClose={() => {}} embedded />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "battle-map-panel\|foundry-panel"
```

- [ ] **Step 4: Commit**

```bash
git add src/components/cockpit/battle-map-panel.tsx src/components/world/foundry-panel.tsx
git commit -m "feat(cockpit): BattleMapPanel with sync button + FoundryPanel embedded mode"
```

---

### Task 8: InitiativePanel component

**Files:**
- Create: `src/components/cockpit/initiative-panel.tsx`

`getEvents` returns `{ items: FoundryEvent[], nextCursor?: string }`. The panel polls for events and derives the current initiative order from the latest `initiative_set` event, overlaying HP from `hp_change` events.

- [ ] **Step 1: Create InitiativePanel**

Create `src/components/cockpit/initiative-panel.tsx`:

```tsx
'use client'

import { useMemo } from 'react'
import { Swords, Skull } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'

interface InitiativePanelProps {
  campaignId: string
  sessionId: string
}

interface CombatantRow {
  actorId: string
  actorName: string
  initiative: number | null
  defeated: boolean
  hp?: number
  hpMax?: number
}

export function InitiativePanel({ campaignId, sessionId }: InitiativePanelProps) {
  const { data } = trpc.foundry.getEvents.useQuery(
    { campaignId, sessionId, limit: 100 },
    { refetchInterval: 3000 },
  )

  const { combatants, round } = useMemo(() => {
    const items = data?.items ?? []

    // Find the most recent initiative_set event (items ordered desc — first match wins)
    const initiativeEvent = items.find((e) => e.type === 'initiative_set')
    let combatants: CombatantRow[] = initiativeEvent
      ? ((initiativeEvent.payload as any).order ?? [])
      : []

    // Overlay latest HP from hp_change events
    const hpByActor: Record<string, { hp: number; hpMax: number }> = {}
    for (const event of items) {
      if (event.type === 'hp_change' && !(event.actorId in hpByActor)) {
        const p = event.payload as any
        hpByActor[p.actorId] = { hp: p.hp, hpMax: p.hpMax }
      }
    }

    combatants = combatants.map((c) => ({
      ...c,
      ...(hpByActor[c.actorId] ?? {}),
    }))

    const round = initiativeEvent
      ? ((initiativeEvent.payload as any).round ?? 0)
      : 0

    return { combatants, round }
  }, [data])

  if (combatants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <Swords className="h-8 w-8 text-[var(--q-text-faint)]" />
        <p className="text-xs text-[var(--q-text-faint)]">
          No active combat. Sync to Foundry and start a combat encounter there.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0">
      {round > 0 && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-[9px] uppercase tracking-[2px] text-[var(--q-amber-dim)]">
            Round {round}
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-[var(--q-border-feature)] to-transparent" />
        </div>
      )}
      <ul className="flex flex-col gap-0.5">
        {[...combatants]
          .sort((a, b) => (b.initiative ?? -1) - (a.initiative ?? -1))
          .map((c, i) => {
            const hpPct = c.hpMax ? (c.hp ?? 0) / c.hpMax : null
            const barColor =
              hpPct === null ? ''
              : hpPct > 0.5 ? 'bg-emerald-500'
              : hpPct > 0.25 ? 'bg-amber-500'
              : 'bg-red-500'

            return (
              <li
                key={c.actorId}
                className={cn(
                  'flex items-center gap-2 rounded-sm px-2 py-2',
                  i === 0 && 'bg-white/[0.04]',
                  c.defeated && 'opacity-40',
                )}
              >
                <span className="w-5 shrink-0 text-right font-[var(--q-font-display)] text-[11px] text-[var(--q-amber)]">
                  {c.initiative ?? '—'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--q-text)]">
                  {c.actorName}
                </span>
                {c.defeated ? (
                  <Skull className="h-3 w-3 shrink-0 text-red-400" />
                ) : hpPct !== null ? (
                  <div className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--q-border-subtle)]">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor)}
                      style={{ width: `${Math.max(0, Math.min(100, hpPct * 100))}%` }}
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "initiative-panel"
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cockpit/initiative-panel.tsx
git commit -m "feat(cockpit): InitiativePanel — real-time initiative from FoundryEvent polling"
```

---

### Task 9: World map pin → "Open as battle map"

**Files:**
- Modify: `src/server/routers/world-map.ts`
- Modify: `src/components/world/location-panel.tsx`

- [ ] **Step 1: Add setFoundryScene mutation to world-map router**

Open `src/server/routers/world-map.ts`. Add at the end of the `router({...})` block:

```typescript
setFoundryScene: campaignDMProcedure
  .input(z.object({
    campaignId: z.string(),
    entityId: z.string(),
    foundrySceneId: z.string().nullable(),
  }))
  .mutation(async ({ input }) => {
    const entity = await prisma.worldEntity.findFirst({
      where: { id: input.entityId, campaignId: input.campaignId },
      select: { properties: true },
    })
    if (!entity) throw new TRPCError({ code: 'NOT_FOUND' })

    const current = (entity.properties ?? {}) as Record<string, unknown>
    await prisma.worldEntity.update({
      where: { id: input.entityId },
      data: {
        properties: {
          ...current,
          foundrySceneId: input.foundrySceneId,
        },
      },
    })
    return { ok: true }
  }),
```

- [ ] **Step 2: Add "Open as battle map" UI to location-panel.tsx**

Open `src/components/world/location-panel.tsx`. Add these imports (if not already present):

```typescript
import { Map } from 'lucide-react'
import { toast } from 'sonner'
```

Inside the component body, after the existing tRPC calls, add:

```typescript
const activateScene = trpc.foundry.activateScene.useMutation({
  onSuccess: () => toast.success('Battle map activated — switch to combat mode in the session cockpit'),
  onError: (err) => toast.error(err.message),
})
const setFoundryScene = trpc.worldMap.setFoundryScene.useMutation()

const foundrySceneId = ((entity?.properties ?? {}) as Record<string, unknown>).foundrySceneId as string | null | undefined
```

Find the bottom section of the panel (near location events or the panel footer). Add before the closing `</div>`:

```tsx
{isDM && (
  <div className="border-t border-[var(--q-border-subtle)] px-4 py-3">
    {foundrySceneId ? (
      <button
        type="button"
        onClick={() => activateScene.mutate({ campaignId, foundrySceneId })}
        disabled={activateScene.isPending}
        className="flex w-full items-center gap-2 rounded-sm border border-[var(--q-amber-border)] bg-[var(--q-amber-trace)] px-3 py-2 text-[11px] uppercase tracking-[2px] text-[var(--q-amber)] transition-colors hover:bg-[color-mix(in_oklab,var(--q-amber-trace)_150%,transparent)] disabled:opacity-50"
      >
        <Map className="h-3.5 w-3.5" />
        Open as battle map
      </button>
    ) : (
      <div className="space-y-1.5">
        <p className="text-[10px] text-[var(--q-text-faint)]">
          Link a Foundry scene to enable one-click battle map launch.
        </p>
        <input
          type="text"
          placeholder="Paste Foundry scene ID…"
          className="w-full rounded-sm border border-[var(--q-border-subtle)] bg-transparent px-2 py-1.5 text-[11px] text-[var(--q-text)] placeholder-[var(--q-text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--q-amber-border)]"
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            const val = (e.target as HTMLInputElement).value.trim()
            if (val) setFoundryScene.mutate({ campaignId, entityId: entity.id, foundrySceneId: val })
          }}
        />
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "location-panel\|world-map.ts"
```

Fix any errors. The most likely issue is `entity.id` — confirm the `entity` variable in location-panel has an `id` field. If the variable name is different (e.g., `pin?.entity`), adjust accordingly.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/world-map.ts src/components/world/location-panel.tsx
git commit -m "feat(world-map): link Foundry scene to location pin — open as battle map"
```

---

### Task 10: Homelab LXC — Foundry deployment

This task is infrastructure. All commands run via SSH. Replace `FOUNDRY_ZIP` with the filename you download from your FoundryVTT.com license page (Linux/Node.js build).

- [ ] **Step 1: Create LXC 207**

```bash
ssh root@192.168.1.220 "pct create 207 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst --hostname foundry-vtt --memory 2048 --cores 2 --rootfs local-lvm:20 --net0 name=eth0,bridge=vmbr0,ip=dhcp --unprivileged 1 --onboot 1 && pct start 207"
```

Wait 10 seconds then get the IP:

```bash
ssh root@192.168.1.220 "pct exec 207 -- hostname -I"
```

Note the IP — referred to as `FOUNDRY_IP` below.

- [ ] **Step 2: Install Node.js 20 + PM2**

```bash
ssh root@192.168.1.220 "pct exec 207 -- bash -c 'apt-get update -qq && apt-get install -y curl unzip && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs && npm install -g pm2'"
```

- [ ] **Step 3: Upload and install Foundry**

Download the Foundry Node.js zip from your license, then:

```bash
# From your dev machine (adjust path):
scp ~/Downloads/FoundryVTT-12.*.zip root@192.168.1.220:/tmp/foundry.zip
ssh root@192.168.1.220 "pct exec 207 -- bash -c 'mkdir -p /opt/foundry /opt/foundry-data && cd /opt/foundry && unzip /tmp/foundry.zip'"
```

- [ ] **Step 4: Configure Foundry for iframe embedding**

```bash
ssh root@192.168.1.220 "pct exec 207 -- bash -c 'mkdir -p /opt/foundry-data/Config && cat > /opt/foundry-data/Config/options.json << '"'"'ENDJSON'"'"'
{
  \"port\": 30000,
  \"hostname\": null,
  \"routePrefix\": null,
  \"adminPassword\": \"\",
  \"sslCert\": \"\",
  \"sslKey\": \"\",
  \"awsConfig\": null,
  \"useSSL\": false,
  \"compressStatic\": true,
  \"fullscreen\": false
}
ENDJSON'"
```

- [ ] **Step 5: Start Foundry under PM2**

```bash
ssh root@192.168.1.220 "pct exec 207 -- bash -c 'pm2 start \"node /opt/foundry/resources/app/main.js --dataPath=/opt/foundry-data --port=30000\" --name foundry && pm2 save && pm2 startup | tail -1 | bash'"
```

Verify it's running:
```bash
ssh root@192.168.1.220 "pct exec 207 -- pm2 list"
```

Expected: `foundry` process in `online` state.

- [ ] **Step 6: Configure reverse proxy for foundry.nerdt.au**

On the Proxmox reverse proxy (wherever nginx/Caddy is running for nerdt.au), add a proxy entry for `foundry.nerdt.au` → `FOUNDRY_IP:30000`. Include headers that allow iframe embedding from quiverdm.com:

```nginx
server {
    server_name foundry.nerdt.au;
    location / {
        proxy_pass http://FOUNDRY_IP:30000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Allow embedding from QuiverDM origins
        add_header Content-Security-Policy "frame-ancestors https://quiverdm.com https://app.nerdt.au 'self'" always;
    }
}
```

Reload the proxy. Verify `curl -I https://foundry.nerdt.au` returns 200.

- [ ] **Step 7: Install quiver-embed module**

```bash
ssh root@192.168.1.220 "pct exec 207 -- mkdir -p /opt/foundry-data/Data/modules/quiver-embed/scripts"

# From repo root on dev machine:
scp foundry-modules/quiver-embed/module.json root@192.168.1.220:/tmp/qe-module.json
scp foundry-modules/quiver-embed/scripts/quiver-embed.mjs root@192.168.1.220:/tmp/qe-script.mjs
ssh root@192.168.1.220 "pct exec 207 -- bash -c 'cp /tmp/qe-module.json /opt/foundry-data/Data/modules/quiver-embed/module.json && cp /tmp/qe-script.mjs /opt/foundry-data/Data/modules/quiver-embed/scripts/quiver-embed.mjs'"
```

- [ ] **Step 8: Create 10 worlds and configure each**

Open `https://foundry.nerdt.au` in a browser. Set an admin password when prompted.

For each of the 10 F&F beta campaigns:
1. Create a world with the DM's campaign name, system: D&D 5e
2. Open the world → Settings → Manage Modules → enable `quiver-embed`
3. Settings → Module Settings → QuiverDM Embed → fill in:
   - **QuiverDM Base URL:** `https://quiverdm.com`
   - **Campaign ID:** (from the DM's QuiverDM campaign settings page)
   - **API Key:** (generated via QuiverDM campaign settings → Foundry → Generate Key)
4. Import the DM's sourcebook maps (CoS castle, RotFM dungeon levels, etc.) via the Scenes tab

- [ ] **Step 9: Update MEMORY.md**

Append to `memory/MEMORY.md` under the homelab section:

```markdown
## Foundry VTT (LXC 207)
- IP: FOUNDRY_IP (run `pct exec 207 -- hostname -I` to confirm)  
- External: https://foundry.nerdt.au (reverse proxied)
- Port: 30000, PM2 process: `foundry`
- Data dir: /opt/foundry-data/ | App: /opt/foundry/
- Deploy module update: `scp foundry-modules/quiver-embed/* root@192.168.1.220:/tmp/ && ssh root@192.168.1.220 "pct exec 207 -- bash -c 'cp /tmp/module.json /tmp/quiver-embed.mjs /opt/foundry-data/Data/modules/quiver-embed/'"` then reload worlds
- 10 worlds pre-configured for F&F beta — one per campaign
```

```bash
git add memory/MEMORY.md
git commit -m "docs: Foundry VTT LXC 207 deployment notes"
```

---

### Task 11: Push, deploy, smoke test

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Verify Vercel build passes**

Check https://quiverdm.com/api/health returns 200 after the deploy completes (~2 min).

- [ ] **Step 3: Smoke test — Foundry module**

In a browser, open `https://foundry.nerdt.au/join` and log in as GM. Open the world. Open browser DevTools console.

Run:
```javascript
game.settings.get('quiver-embed', 'campaignId')
```
Expected: the campaign CUID you configured.

Open `https://foundry.nerdt.au?quiver=1` in a new tab — the Foundry UI chrome (sidebar, hotbar, controls) should be hidden, leaving only the map canvas.

- [ ] **Step 4: Smoke test — QuiverDM → Foundry sync**

1. Open a QuiverDM session cockpit for the configured campaign
2. Switch to combat mode
3. Verify `BattleMapPanel` renders with the Foundry iframe (chrome stripped)
4. Click "Sync to Foundry" — toast should say "Queued N entities"
5. Wait 5 seconds — in Foundry, check the Actors tab: session NPCs should appear as actors

- [ ] **Step 5: Smoke test — Foundry → QuiverDM events**

1. In Foundry, start a combat encounter and add a token
2. Reduce an actor's HP to 0 in Foundry
3. In the QuiverDM cockpit Initiative tab, verify the actor appears with a death marker within 3 seconds

- [ ] **Step 6: Smoke test — world map link**

1. Open QuiverDM world map, click a location pin
2. In the location panel, verify the "Link a Foundry scene" input appears
3. Paste a Foundry scene ID (visible in the scene's URL when you view it in Foundry: `…/scenes/ABC123`) and press Enter
4. The input should replace with an "Open as battle map" button
5. Click the button — in Foundry the linked scene should become active

- [ ] **Step 7: Commit any fixes**

```bash
git add -p
git commit -m "fix(foundry-demo): smoke test fixes"
git push origin main
```
