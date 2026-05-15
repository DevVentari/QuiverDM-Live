# Session 0 Auto-Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-create a Session 0 record with AI-generated prepData when a DM seeds a campaign from a DDB sourcebook, surfaced via a centred glass hero card on the sessions page.

**Architecture:** `ddbSync.linkSourcebookToCampaign` creates Session 0 immediately after sourcebook linking, then enqueues a BullMQ job. The worker queries SourcebookEntity records, calls Claude via `chatWithAI`, and populates `prepData`. The sessions page shows a hero card that polls for completion.

**Tech Stack:** BullMQ, Prisma (`gameSession`/`sourcebookEntity`), `chatWithAI` multi-provider, tRPC, React/Tailwind, QuiverDM design tokens

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/queue/session0-prep-queue.ts` | Create | Queue definition + `addSession0PrepJob` helper |
| `src/lib/queue/session0-prep-worker.ts` | Create | Worker: fetch entities → AI → update session |
| `src/server/routers/ddb-sync.ts` | Modify | Create Session 0 + enqueue job after sourcebook link |
| `src/components/campaign/Session0HeroCard.tsx` | Create | Glass hero card with shimmer + polling |
| `src/app/(app)/campaigns/[slug]/sessions/page.tsx` | Modify | Render Session0HeroCard when no real sessions exist |
| `src/components/campaign/campaign-create-sheet.tsx` | Modify | Fix post-create redirect to `/sessions` |
| `package.json` | Modify | Add `worker:session0-prep` + include in `worker:all` |

---

## Task 1: BullMQ queue definition

**Files:**
- Create: `src/lib/queue/session0-prep-queue.ts`

- [ ] **Step 1: Create the queue file**

```ts
import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import { getRedisConnection } from './queue';

export interface Session0PrepJobData {
  sessionId: string;
  sourcebookId: string;
  sourcebookTitle: string;
  campaignName: string;
}

export interface Session0PrepJobResult {
  success: boolean;
  error?: string;
}

export const session0PrepQueue = new Queue<Session0PrepJobData, Session0PrepJobResult>(
  'session0-prep',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
      removeOnComplete: { age: 24 * 3600, count: 200 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addSession0PrepJob(data: Session0PrepJobData) {
  return session0PrepQueue.add(`session0-${data.sessionId}`, data, {
    jobId: data.sessionId,
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors from the new file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queue/session0-prep-queue.ts
git commit -m "feat(session0): add session0-prep BullMQ queue"
```

---

## Task 2: BullMQ worker

**Files:**
- Create: `src/lib/queue/session0-prep-worker.ts`

- [ ] **Step 1: Create the worker**

```ts
import dotenv from 'dotenv';
dotenv.config();

import { Worker } from 'bullmq';
import { prisma } from '../prisma';
import { chatWithAI } from '../ai/chat';
import { emptyPrepData } from '../prep-types';
import type { Session0PrepJobData, Session0PrepJobResult } from './session0-prep-queue';

function getRedisConnection(): Record<string, unknown> {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const useTls = url.protocol === 'rediss:';
    return {
      host: url.hostname,
      port: parseInt(url.port || (useTls ? '6380' : '6379')),
      password: url.password || undefined,
      username: url.username !== 'default' ? url.username : undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      ...(useTls ? { tls: {} } : {}),
    };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

const SYSTEM_PROMPT = `You are a D&D session prep assistant. Given sourcebook entities, generate a Session 0 prep brief.

Respond ONLY with valid JSON in this exact shape:
{
  "strongStart": "<2-3 sentence opening scene/hook the DM reads or adapts>",
  "scenes": [
    { "id": "<uuid>", "title": "<title>", "description": "<2-3 sentences>", "location": "<location name>", "readAloud": "", "order": 0, "linkedNpcIds": [], "linkedSecretIds": [], "linkedMonsterNames": [] }
  ],
  "npcs": [
    { "id": "<uuid>", "name": "<name>", "role": "<role>", "motivation": "<1 sentence>" }
  ],
  "secretsAndClues": [
    { "id": "<uuid>", "text": "<1-2 sentence DM secret the players don't know yet>" }
  ]
}

Rules:
- 1 strongStart
- 2-3 scenes (opening location tour, character introductions, inciting incident)
- 2-3 npcs from the entities list
- 1-2 secrets relevant to Session 0`;

async function generateSession0Prep(
  sourcebookTitle: string,
  campaignName: string,
  entities: Array<{ type: string; name: string; description: string | null }>
): Promise<Partial<ReturnType<typeof emptyPrepData>>> {
  const entitySummary = entities
    .map(e => `[${e.type}] ${e.name}: ${(e.description ?? '').slice(0, 200)}`)
    .join('\n');

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `Campaign: ${campaignName}\nSourcebook: ${sourcebookTitle}\n\nKey entities:\n${entitySummary}\n\nGenerate a Session 0 prep brief.`,
    },
  ];

  const raw = await chatWithAI(messages, { temperature: 0.7 });

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in AI response');
  return JSON.parse(jsonMatch[0]);
}

new Worker<Session0PrepJobData, Session0PrepJobResult>(
  'session0-prep',
  async (job) => {
    const { sessionId, sourcebookId, sourcebookTitle, campaignName } = job.data;
    console.log(`[session0-prep] Processing session ${sessionId}`);

    try {
      const entities = await prisma.sourcebookEntity.findMany({
        where: { sourcebookId },
        orderBy: { createdAt: 'asc' },
        take: 15,
        select: { type: true, name: true, description: true },
      });

      let prepPatch: Partial<ReturnType<typeof emptyPrepData>>;

      if (entities.length === 0) {
        const base = emptyPrepData();
        prepPatch = {
          strongStart: `Welcome to ${campaignName}. Add your opening scene here.`,
          scenes: base.scenes,
          npcs: base.npcs,
          secretsAndClues: base.secretsAndClues,
        };
      } else {
        prepPatch = await generateSession0Prep(sourcebookTitle, campaignName, entities);
      }

      const existing = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        select: { prepData: true },
      });
      const base = emptyPrepData();
      const merged = { ...base, ...(existing?.prepData as object ?? {}), ...prepPatch, lastSavedAt: new Date().toISOString() };

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          prepData: merged as any,
          prepStatus: 'complete',
        },
      });

      console.log(`[session0-prep] Done for session ${sessionId}`);
      return { success: true };
    } catch (err) {
      console.error(`[session0-prep] Failed for session ${sessionId}:`, err);
      // Leave prepStatus as 'draft' — DM can fill manually. Don't rethrow so job doesn't retry on AI errors.
      return { success: false, error: String(err) };
    }
  },
  { connection: getRedisConnection() as any, concurrency: 2 }
);

console.log('[session0-prep] Worker started');
```

- [ ] **Step 2: Verify import paths resolve**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/queue/session0-prep-worker.ts
git commit -m "feat(session0): add session0-prep worker with AI entity seeding"
```

---

## Task 3: Trigger Session 0 creation in ddb-sync router

**Files:**
- Modify: `src/server/routers/ddb-sync.ts`

The `linkSourcebookToCampaign` handler is at line 119. After line 142 (`await ddbSyncRepository.linkSourcebookToCampaigns(...)` + `seedCampaignFromSourcebook`), add the Session 0 creation block.

- [ ] **Step 1: Add import at top of file**

Find the existing imports block (around line 1-20) and add:

```ts
import { sessionRepository } from '../repositories/session.repository';
import { emptyPrepData } from '@/lib/prep-types';
import { addSession0PrepJob } from '@/lib/queue/session0-prep-queue';
```

- [ ] **Step 2: Add Session 0 creation block inside the mutation**

After line `return { ok: true, ...seedResult };` (line ~151), insert the Session 0 block BEFORE the return:

```ts
      // Create Session 0 for this campaign if none exists yet
      const existingSession0 = await prisma.gameSession.findFirst({
        where: { campaignId: input.campaignId, sessionNumber: 0 },
      });
      if (!existingSession0) {
        const sourcebookRecord = await prisma.ddbSourcebook.findUnique({
          where: { id: input.sourcebookId },
          select: { title: true },
        });
        const campaign = await prisma.campaign.findUnique({
          where: { id: input.campaignId },
          select: { name: true },
        });
        const session0 = await sessionRepository.create({
          campaignId: input.campaignId,
          title: 'Session 0',
          sessionNumber: 0,
          status: 'planning',
          prepData: emptyPrepData() as unknown as import('@prisma/client').Prisma.InputJsonValue,
          prepStatus: 'draft',
        });
        void addSession0PrepJob({
          sessionId: session0.id,
          sourcebookId: input.sourcebookId,
          sourcebookTitle: sourcebookRecord?.title ?? 'Unknown Sourcebook',
          campaignName: campaign?.name ?? 'Unknown Campaign',
        });
      }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/ddb-sync.ts
git commit -m "feat(session0): create Session 0 and enqueue AI prep job on sourcebook link"
```

---

## Task 4: Session0HeroCard component

**Files:**
- Create: `src/components/campaign/Session0HeroCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  session0Id: string;
  campaignSlug: string;
  initialPrepStatus: string;
}

export function Session0HeroCard({ session0Id, campaignSlug, initialPrepStatus }: Props) {
  const utils = trpc.useUtils();

  const isDraft = initialPrepStatus === 'draft';

  // Poll every 3s while draft, stop after 60s
  const sessionQuery = trpc.sessions.getById.useQuery(
    { id: session0Id },
    {
      enabled: isDraft,
      refetchInterval: isDraft ? 3000 : false,
      refetchIntervalInBackground: true,
    }
  );

  const currentPrepStatus = (sessionQuery.data as any)?.prepStatus ?? initialPrepStatus;
  const isReady = currentPrepStatus === 'complete';

  // Stop polling once complete
  useEffect(() => {
    if (isReady) {
      utils.sessions.getAll.invalidate();
    }
  }, [isReady, utils]);

  function dismiss() {
    try { sessionStorage.setItem(`session0-dismissed-${session0Id}`, '1'); } catch {}
    // Force re-render by invalidating — hero card re-checks sessionStorage on next render
    utils.sessions.getAll.invalidate();
  }

  return (
    <div className="flex justify-center mb-8">
      <div
        className="relative w-full max-w-[480px] rounded-xl border border-[var(--q-amber-border)]/40 bg-[oklch(0.17_0.02_265/0.85)] p-8 text-center shadow-[0_8px_32px_oklch(0_0_0/0.4),0_0_60px_var(--q-amber-glow)]"
        style={{ backdropFilter: 'blur(12px)' }}
      >
        <div className="mb-3 text-3xl opacity-80">🕯️</div>
        <p className="font-[var(--q-font-display)] text-[9px] uppercase tracking-[0.2em] text-[var(--q-text-faint)] mb-2">
          Your campaign has been created
        </p>

        {!isReady ? (
          <>
            <Skeleton className="mx-auto mb-2 h-7 w-48 bg-[var(--q-surface-utility)]" />
            <p className="text-sm text-[var(--q-text-dim)]">Preparing your Session 0 prep…</p>
          </>
        ) : (
          <>
            <h2 className="font-[var(--q-font-display)] text-xl text-[var(--q-text)] mb-3">
              Session 0 is ready
            </h2>
            <div className="mx-auto mb-6 h-px w-24 bg-[var(--q-amber-border)]/30" />
            <p className="text-sm text-[var(--q-text-dim)] mb-6">
              We drafted an opening prep from the sourcebook. Review it, adjust it, then invite your players.
            </p>
            <div className="flex flex-col gap-3 items-center">
              <Button asChild className="w-full max-w-[260px]">
                <Link href={`/campaigns/${campaignSlug}/sessions/${session0Id}`}>
                  Review Session 0 Prep →
                </Link>
              </Button>
              <button
                onClick={dismiss}
                className="text-xs text-[var(--q-text-faint)] hover:text-[var(--q-text-dim)] transition-colors"
              >
                Skip for now
              </button>
            </div>
          </>
        )}

        <p className="mt-6 text-[10px] text-[var(--q-text-faint)]">
          Disappears after your first session
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/campaign/Session0HeroCard.tsx
git commit -m "feat(session0): Session0HeroCard component with polling shimmer"
```

---

## Task 5: Wire hero card into sessions page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/page.tsx`

- [ ] **Step 1: Add import at top of the sessions page**

After the existing imports, add:
```tsx
import { Session0HeroCard } from '@/components/campaign/Session0HeroCard';
```

- [ ] **Step 2: Add session0 detection logic**

After the line `const allSessions = (sessionsQuery.data ?? []) as any[];`, add:

```tsx
  // Detect Session 0 — show hero card until a real session (sessionNumber >= 1) exists
  const session0 = allSessions.find((s) => s.sessionNumber === 0);
  const hasRealSessions = allSessions.some((s) => s.sessionNumber >= 1);
  const showSession0Card = isDM && !!session0 && !hasRealSessions && (() => {
    try { return !sessionStorage.getItem(`session0-dismissed-${session0.id}`); } catch { return true; }
  })();

  // Exclude session 0 from the visible sessions list
  const allDisplaySessions = allSessions.filter((s) => s.sessionNumber !== 0);
```

- [ ] **Step 3: Replace `allSessions` references in filtering logic with `allDisplaySessions`**

Change:
```tsx
const allSessions = (sessionsQuery.data ?? []) as any[];
```
to use `allDisplaySessions` for filters and counts. Specifically, find:
```tsx
  const activeCount    = allSessions.filter(...)
  const completedCount = allSessions.filter(...)
  const sessions = filter === 'all'
    ? allSessions
    : allSessions.filter(...)
  const counts = {
    all: allSessions.length,
    ...
  }
```
and replace each `allSessions` reference in counts/filter logic with `allDisplaySessions`.

- [ ] **Step 4: Render the hero card above the session list**

Find the JSX return. Just above the existing `<SplitCanvas>` or main container, add:

```tsx
      {showSession0Card && (
        <Session0HeroCard
          session0Id={session0.id}
          campaignSlug={slug}
          initialPrepStatus={session0.prepStatus ?? 'draft'}
        />
      )}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/campaigns/[slug]/sessions/page.tsx
git commit -m "feat(session0): show Session0HeroCard on sessions page until first real session"
```

---

## Task 6: Fix post-create redirect

**Files:**
- Modify: `src/components/campaign/campaign-create-sheet.tsx`

- [ ] **Step 1: Fix the redirect destination**

Find lines 403–406:
```tsx
    const dest = ddbUrl.trim()
      ? `/campaigns/${campaign.slug || campaign.id}/players?ddb-importing=true`
      : `/campaigns/${campaign.slug || campaign.id}`;
    router.push(dest);
```

Change to:
```tsx
    const dest = ddbUrl.trim()
      ? `/campaigns/${campaign.slug || campaign.id}/players?ddb-importing=true`
      : `/campaigns/${campaign.slug || campaign.id}/sessions`;
    router.push(dest);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/campaign/campaign-create-sheet.tsx
git commit -m "fix(campaign): redirect to /sessions after creation instead of missing root route"
```

---

## Task 7: Register worker script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add worker script**

Find the line `"worker:transcript-cleanup": "tsx src/lib/queue/transcript-cleanup-worker.ts",` and add after it:
```json
"worker:session0-prep": "tsx src/lib/queue/session0-prep-worker.ts",
```

- [ ] **Step 2: Add to worker:all**

Find `"worker:all"` and append `npm run worker:session0-prep &` to the chain, before the final `wait`.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat(session0): register session0-prep worker in package.json"
```

---

## Task 8: Deploy worker to homelab

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

- [ ] **Step 2: Deploy to homelab**

```bash
ssh root@192.168.1.220 "pct exec 206 -- bash /opt/quiverdm/deploy/homelab/deploy.sh"
```

Expected output includes `pm2 restart all` completion.

- [ ] **Step 3: Verify worker is running**

```bash
ssh root@192.168.1.220 "pct exec 206 -- bash -c 'pm2 list'"
```

Expected: `session0-prep` process in `online` status.

---

## Task 9: Manual smoke test

- [ ] **Step 1: Create a test campaign seeded from CoS**

In dev (`http://localhost:3847`):
1. Open campaign create sheet
2. Name the campaign "Test Session 0"
3. Select Curse of Strahd sourcebook
4. Complete creation

- [ ] **Step 2: Verify redirect lands on sessions page**

URL should be `/campaigns/test-session-0/sessions`.

- [ ] **Step 3: Verify hero card appears**

Hero card should show with shimmer state ("Preparing your Session 0 prep…").

- [ ] **Step 4: Wait for AI completion (~10–15s) and verify card updates**

Card should switch to "Session 0 is ready" with "Review Session 0 Prep →" button.

- [ ] **Step 5: Verify Session 0 is excluded from normal session list**

The sessions list below the hero card should show 0 sessions (empty state), not Session 0.

- [ ] **Step 6: Verify prepData was populated**

Click "Review Session 0 Prep →". The prep page should show a populated `strongStart`, scenes, and NPCs drawn from CoS entities.

- [ ] **Step 7: Verify "Skip for now" dismisses the card**

Click "Skip for now". Hero card should disappear. Refreshing the page should bring it back (sessionStorage, not permanent).

- [ ] **Step 8: Verify hero card disappears after creating Session 1**

Create a new session via "+ New Session". Navigate back to sessions page. Hero card should no longer render.
