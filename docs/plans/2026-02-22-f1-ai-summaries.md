# Feature 1: AI Session Summaries + Highlights Hub

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate AI-powered summaries and tagged highlight moments for each session, with a campaign-level hub page and shareable links.

**Architecture:** BullMQ worker consumes `ai-summary` queue jobs, calls multi-provider LLM (Ollama default), writes structured output (summary markdown + typed highlights array) back to `GameSession`. Summary panel in session view polls for status. Hub page aggregates all session summaries per campaign.

**Tech Stack:** Prisma, BullMQ, Redis, Ollama (`src/lib/ai/ollama.ts`), tRPC, Next.js App Router, shadcn/ui, React

---

## Task 1: Schema — Add AI summary fields to GameSession

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add fields to GameSession model**

Find the `model GameSession` block and add these fields before `createdAt`:

```prisma
aiSummary       String?   @db.Text
aiSummaryStatus String    @default("none")  // none|pending|processing|done|error
aiSummaryError  String?
aiSummaryAt     DateTime?
aiHighlights    Json?     // [{type,text,timestampMs,speakerLabel}]
shareToken      String?   @unique
```

**Step 2: Push schema**

```bash
npm run db:push
```

Expected: "Your database is now in sync with your Prisma schema."

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add AI summary fields + shareToken to GameSession"
```

---

## Task 2: BullMQ Queue — ai-summary-queue.ts

**Files:**
- Create: `src/lib/queue/ai-summary-queue.ts`

**Step 1: Create the queue file**

```typescript
/**
 * BullMQ Queue for AI Session Summary Generation
 */
import { Queue } from 'bullmq';

function getRedisConnection() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

export interface AiSummaryJobData {
  jobId: string;        // GameSession.id
  sessionId: string;
  userId: string;
  transcriptText: string;
  sessionTitle: string;
  sessionNumber: number;
}

export interface AiSummaryJobResult {
  success: boolean;
  summary?: string;
  highlights?: AiHighlight[];
  error?: string;
}

export interface AiHighlight {
  type: 'decision' | 'npc_change' | 'cliffhanger' | 'combat' | 'loot';
  text: string;
  timestampMs?: number;
  speakerLabel?: string;
}

export const aiSummaryQueue = new Queue<AiSummaryJobData, AiSummaryJobResult>(
  'ai-summary',
  {
    connection: getRedisConnection() as any,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 15000 },
      removeOnComplete: { age: 24 * 3600, count: 500 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }
);

export async function addAiSummaryJob(data: AiSummaryJobData) {
  return aiSummaryQueue.add(`summarize-${data.sessionId}`, data, {
    jobId: data.jobId,
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/queue/ai-summary-queue.ts
git commit -m "feat(queue): add ai-summary BullMQ queue"
```

---

## Task 3: BullMQ Worker — ai-summary-worker.ts

**Files:**
- Create: `src/lib/queue/ai-summary-worker.ts`

**Step 1: Create the worker**

```typescript
/**
 * AI Summary Worker
 * Processes ai-summary queue jobs: generates session summaries + highlights via Ollama.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { chatWithOllama } from '@/lib/ai/ollama';
import type { AiSummaryJobData, AiSummaryJobResult, AiHighlight } from './ai-summary-queue';

function getRedisConnection() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

const SUMMARY_SYSTEM_PROMPT = `You are a D&D session scribe. Given a session transcript, produce:
1. A markdown summary (3-5 paragraphs) covering key events, decisions, and story beats.
2. An array of highlight moments tagged by type.

Respond ONLY with valid JSON in this exact shape:
{
  "summary": "<markdown string>",
  "highlights": [
    { "type": "decision|npc_change|cliffhanger|combat|loot", "text": "<1-2 sentence description>", "speakerLabel": "<optional speaker name>" }
  ]
}`;

async function processSummaryJob(data: AiSummaryJobData): Promise<AiSummaryJobResult> {
  // Mark as processing
  await prisma.gameSession.update({
    where: { id: data.sessionId },
    data: { aiSummaryStatus: 'processing' },
  });

  const userPrompt = `Session ${data.sessionNumber}: "${data.sessionTitle}"\n\nTranscript:\n${data.transcriptText.slice(0, 12000)}`;

  const response = await chatWithOllama([
    { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ], { format: 'json', temperature: 0.2 });

  let parsed: { summary: string; highlights: AiHighlight[] };
  try {
    parsed = JSON.parse(response.message.content);
  } catch {
    throw new Error(`LLM returned invalid JSON: ${response.message.content.slice(0, 200)}`);
  }

  await prisma.gameSession.update({
    where: { id: data.sessionId },
    data: {
      aiSummary: parsed.summary,
      aiHighlights: parsed.highlights,
      aiSummaryStatus: 'done',
      aiSummaryAt: new Date(),
      aiSummaryError: null,
    },
  });

  return { success: true, summary: parsed.summary, highlights: parsed.highlights };
}

const worker = new Worker<AiSummaryJobData, AiSummaryJobResult>(
  'ai-summary',
  async (job) => {
    try {
      return await processSummaryJob(job.data);
    } catch (err: any) {
      await prisma.gameSession.update({
        where: { id: job.data.sessionId },
        data: { aiSummaryStatus: 'error', aiSummaryError: err.message },
      }).catch(() => {});
      throw err;
    }
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('completed', (job) => {
  console.log(`[ai-summary] Job ${job.id} completed`);
});
worker.on('failed', (job, err) => {
  console.error(`[ai-summary] Job ${job?.id} failed:`, err.message);
});

console.log('[ai-summary] Worker started');
```

**Step 2: Add worker script to package.json**

In `package.json`, add to the `scripts` section:
```json
"worker:summary": "tsx src/lib/queue/ai-summary-worker.ts"
```

**Step 3: Commit**

```bash
git add src/lib/queue/ai-summary-worker.ts package.json
git commit -m "feat(worker): add ai-summary worker"
```

---

## Task 4: Session Repository — add summary methods

**Files:**
- Modify: `src/server/repositories/session.repository.ts`

**Step 1: Add updateSummary and findByShareToken functions**

Append to the repository file:

```typescript
export async function updateSummaryStatus(
  id: string,
  data: {
    aiSummaryStatus: string;
    aiSummary?: string;
    aiHighlights?: object;
    aiSummaryError?: string;
    aiSummaryAt?: Date;
  }
) {
  return prisma.gameSession.update({ where: { id }, data });
}

export async function findByShareToken(shareToken: string) {
  return prisma.gameSession.findUnique({
    where: { shareToken },
    include: {
      campaign: { select: { id: true, name: true } },
      transcripts: { select: { id: true, rawText: true, correctedText: true, speakers: true, timestamps: true } },
    },
  });
}

export async function setShareToken(id: string, shareToken: string) {
  return prisma.gameSession.update({ where: { id }, data: { shareToken } });
}

export async function findByCampaignIdWithSummaries(campaignId: string) {
  return prisma.gameSession.findMany({
    where: { campaignId },
    orderBy: { sessionNumber: 'desc' },
    select: {
      id: true, sessionNumber: true, title: true, date: true, status: true,
      aiSummary: true, aiSummaryStatus: true, aiHighlights: true, shareToken: true,
    },
  });
}
```

**Step 2: Export from repository index**

Check `src/server/repositories/index.ts` — if session repo functions are re-exported there, no change needed (they use named exports directly).

**Step 3: Commit**

```bash
git add src/server/repositories/session.repository.ts
git commit -m "feat(repo): add summary + share token methods to session repository"
```

---

## Task 5: Session Service — generateSummary + getByShareToken

**Files:**
- Modify: `src/server/services/session.service.ts`

**Step 1: Add imports and new methods**

Add import at top of file:
```typescript
import { randomBytes } from 'crypto';
import { addAiSummaryJob } from '@/lib/queue/ai-summary-queue';
import * as sessionRepository from '../repositories/session.repository';
```

Add methods to `SessionService` class:

```typescript
async generateSummary(sessionId: string, userId: string) {
  await authz.session(sessionId, userId).verify();
  const session = await sessionRepository.findById(sessionId);
  if (!session) throw new NotFoundError('session', sessionId);

  // Get transcript text
  const transcriptText = session.transcripts
    .map((t: any) => t.correctedText || t.rawText)
    .filter(Boolean)
    .join('\n\n---\n\n');

  if (!transcriptText.trim()) {
    throw new BadRequestError('No transcript available to summarize');
  }

  // Mark pending
  await sessionRepository.updateSummaryStatus(sessionId, { aiSummaryStatus: 'pending' });

  // Enqueue
  await addAiSummaryJob({
    jobId: sessionId,
    sessionId,
    userId,
    transcriptText,
    sessionTitle: session.title || `Session ${session.sessionNumber}`,
    sessionNumber: session.sessionNumber,
  });

  return { status: 'pending' };
}

async getSummaryStatus(sessionId: string, userId: string) {
  await authz.session(sessionId, userId).verify();
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { aiSummaryStatus: true, aiSummary: true, aiHighlights: true, aiSummaryError: true, aiSummaryAt: true, shareToken: true },
  });
  if (!session) throw new NotFoundError('session', sessionId);
  return session;
}

async createShareToken(sessionId: string, userId: string) {
  await authz.session(sessionId, userId).verify();
  const token = randomBytes(16).toString('hex');
  await sessionRepository.setShareToken(sessionId, token);
  return { shareToken: token };
}

async getByShareToken(shareToken: string) {
  const session = await sessionRepository.findByShareToken(shareToken);
  if (!session) throw new NotFoundError('session share', shareToken);
  // Return only public fields
  return {
    id: session.id,
    title: (session as any).title,
    sessionNumber: (session as any).sessionNumber,
    date: (session as any).date,
    campaignName: session.campaign.name,
    aiSummary: (session as any).aiSummary,
    aiHighlights: (session as any).aiHighlights,
  };
}

async getSessionsWithSummaries(campaignId: string, userId: string) {
  await authz.campaign(campaignId, userId).verify();
  return sessionRepository.findByCampaignIdWithSummaries(campaignId);
}
```

**Step 2: Commit**

```bash
git add src/server/services/session.service.ts
git commit -m "feat(service): add generateSummary, share token, and summary hub to SessionService"
```

---

## Task 6: Sessions Router — new tRPC procedures

**Files:**
- Modify: `src/server/routers/sessions.ts`

**Step 1: Add procedures**

Add these to the `sessionsRouter` object:

```typescript
generateSummary: protectedProcedure
  .input(z.object({ sessionId: z.string() }))
  .mutation(({ input, ctx }) =>
    sessionService.generateSummary(input.sessionId, ctx.session.user.id)
  ),

getSummaryStatus: protectedProcedure
  .input(z.object({ sessionId: z.string() }))
  .query(({ input, ctx }) =>
    sessionService.getSummaryStatus(input.sessionId, ctx.session.user.id)
  ),

createShareToken: protectedProcedure
  .input(z.object({ sessionId: z.string() }))
  .mutation(({ input, ctx }) =>
    sessionService.createShareToken(input.sessionId, ctx.session.user.id)
  ),

getSessionsWithSummaries: protectedProcedure
  .input(z.object({ campaignId: z.string() }))
  .query(({ input, ctx }) =>
    sessionService.getSessionsWithSummaries(input.campaignId, ctx.session.user.id)
  ),
```

**Step 2: Add public share route in `src/app/api/trpc/[trpc]/route.ts`**

No change needed — share page uses a separate API route below.

**Step 3: Commit**

```bash
git add src/server/routers/sessions.ts
git commit -m "feat(router): add generateSummary, getSummaryStatus, createShareToken procedures"
```

---

## Task 7: Summary Panel Component

**Files:**
- Create: `src/components/session/summary-panel.tsx`

**Step 1: Create component**

```tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Copy, Share2, RefreshCw, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

const HIGHLIGHT_COLORS: Record<string, string> = {
  decision: 'bg-blue-100 text-blue-800',
  npc_change: 'bg-purple-100 text-purple-800',
  cliffhanger: 'bg-red-100 text-red-800',
  combat: 'bg-orange-100 text-orange-800',
  loot: 'bg-green-100 text-green-800',
};

interface SummaryPanelProps {
  sessionId: string;
  isDM: boolean;
}

export function SummaryPanel({ sessionId, isDM }: SummaryPanelProps) {
  const utils = trpc.useUtils();

  const { data: status, isLoading } = trpc.sessions.getSummaryStatus.useQuery(
    { sessionId },
    { refetchInterval: (d) => (d?.state?.data?.aiSummaryStatus === 'pending' || d?.state?.data?.aiSummaryStatus === 'processing') ? 3000 : false }
  );

  const generateMutation = trpc.sessions.generateSummary.useMutation({
    onSuccess: () => utils.sessions.getSummaryStatus.invalidate({ sessionId }),
    onError: (e) => toast.error(e.message),
  });

  const shareTokenMutation = trpc.sessions.createShareToken.useMutation({
    onSuccess: (d) => {
      const url = `${window.location.origin}/share/session/${d.shareToken}`;
      navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard');
      utils.sessions.getSummaryStatus.invalidate({ sessionId });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="h-20 animate-pulse bg-muted rounded-lg" />;

  const summaryStatus = status?.aiSummaryStatus ?? 'none';
  const isRunning = summaryStatus === 'pending' || summaryStatus === 'processing';
  const highlights = (status?.aiHighlights as any[]) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> AI Summary
        </CardTitle>
        <div className="flex gap-2">
          {summaryStatus === 'done' && (
            <>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(status?.aiSummary ?? ''); toast.success('Copied'); }}>
                <Copy className="h-3 w-3 mr-1" /> Copy
              </Button>
              {isDM && (
                <Button size="sm" variant="outline" onClick={() => shareTokenMutation.mutate({ sessionId })} disabled={shareTokenMutation.isPending}>
                  <Share2 className="h-3 w-3 mr-1" /> Share
                </Button>
              )}
            </>
          )}
          {isDM && (
            <Button size="sm" onClick={() => generateMutation.mutate({ sessionId })} disabled={isRunning || generateMutation.isPending}>
              {isRunning ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating…</> : summaryStatus === 'done' ? <><RefreshCw className="h-3 w-3 mr-1" /> Regenerate</> : <><Sparkles className="h-3 w-3 mr-1" /> Generate</>}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {summaryStatus === 'none' && <p className="text-sm text-muted-foreground">No summary yet. {isDM ? 'Click Generate to create one.' : 'The DM has not generated a summary yet.'}</p>}
        {summaryStatus === 'error' && <p className="text-sm text-destructive">Error: {status?.aiSummaryError}</p>}
        {isRunning && <p className="text-sm text-muted-foreground animate-pulse">Generating summary…</p>}
        {summaryStatus === 'done' && (
          <div className="space-y-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{status?.aiSummary ?? ''}</ReactMarkdown>
            </div>
            {highlights.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">HIGHLIGHTS</p>
                <div className="flex flex-wrap gap-2">
                  {highlights.map((h: any, i: number) => (
                    <Badge key={i} className={HIGHLIGHT_COLORS[h.type] ?? ''} variant="outline">
                      <span className="font-medium capitalize mr-1">{h.type.replace('_', ' ')}:</span> {h.text}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/session/summary-panel.tsx
git commit -m "feat(component): add SummaryPanel with generate, copy, share"
```

---

## Task 8: Wire SummaryPanel into session page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

**Step 1: Import and add SummaryPanel**

Add import:
```typescript
import { SummaryPanel } from '@/components/session/summary-panel';
```

Find a suitable place in the session page JSX (after the session header / quick notes card) and add:
```tsx
<SummaryPanel sessionId={sessionId} isDM={isDM} />
```

`isDM` is already available via `useCampaign()`.

**Step 2: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/page.tsx
git commit -m "feat(ui): wire SummaryPanel into session page"
```

---

## Task 9: Summaries Hub Page

**Files:**
- Create: `src/app/(app)/campaigns/[slug]/summaries/page.tsx`

**Step 1: Create hub page**

```tsx
'use client';

import { useCampaign } from '@/components/campaign/campaign-context';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

export default function SummariesPage() {
  const { campaignId, slug } = useCampaign();
  const { data: sessions, isLoading } = trpc.sessions.getSessionsWithSummaries.useQuery({ campaignId });

  if (isLoading) return <div className="p-6 space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse bg-muted rounded-lg" />)}</div>;

  const withSummaries = sessions?.filter((s: any) => s.aiSummaryStatus === 'done') ?? [];
  const pending = sessions?.filter((s: any) => s.aiSummaryStatus !== 'done') ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5" />
        <h1 className="text-2xl font-bold">Session Summaries</h1>
        <Badge variant="secondary">{withSummaries.length} summaries</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {withSummaries.map((session: any) => (
          <Link key={session.id} href={`/campaigns/${slug}/sessions/${session.id}`}>
            <Card className="h-full hover:border-primary transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-medium">
                    Session {session.sessionNumber}{session.title ? `: ${session.title}` : ''}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs shrink-0 ml-2">
                    <Calendar className="h-3 w-3 mr-1" />
                    {format(new Date(session.date), 'MMM d')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-xs max-w-none dark:prose-invert line-clamp-6 text-sm text-muted-foreground">
                  <ReactMarkdown>{session.aiSummary?.slice(0, 300) + '…'}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {pending.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-2">Sessions without summaries ({pending.length})</p>
          <div className="flex flex-wrap gap-2">
            {pending.map((s: any) => (
              <Link key={s.id} href={`/campaigns/${slug}/sessions/${s.id}`}>
                <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                  Session {s.sessionNumber}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add "Summaries" link to campaign nav**

Find the campaign sidebar/nav (likely `src/app/(app)/campaigns/[slug]/layout.tsx` or a nav component). Add a nav link:
```tsx
{ href: `/campaigns/${slug}/summaries`, label: 'Summaries', icon: Sparkles }
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/summaries/
git commit -m "feat(ui): add session summaries hub page"
```

---

## Task 10: Public Share Page

**Files:**
- Create: `src/app/share/session/[token]/page.tsx`

**Step 1: Create public share page**

```tsx
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';

const HIGHLIGHT_COLORS: Record<string, string> = {
  decision: 'bg-blue-100 text-blue-800',
  npc_change: 'bg-purple-100 text-purple-800',
  cliffhanger: 'bg-red-100 text-red-800',
  combat: 'bg-orange-100 text-orange-800',
  loot: 'bg-green-100 text-green-800',
};

export default async function SharedSessionPage({ params }: { params: { token: string } }) {
  const session = await prisma.gameSession.findUnique({
    where: { shareToken: params.token },
    include: { campaign: { select: { name: true } } },
  });

  if (!session || !session.aiSummary) return notFound();

  const highlights = (session.aiHighlights as any[]) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{session.campaign.name}</p>
          <h1 className="text-2xl font-bold">
            Session {session.sessionNumber}{session.title ? `: ${session.title}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">{format(session.date, 'MMMM d, yyyy')}</p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span>AI-generated summary</span>
        </div>

        <div className="prose max-w-none dark:prose-invert">
          <ReactMarkdown>{session.aiSummary}</ReactMarkdown>
        </div>

        {highlights.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">Highlights</h2>
            <div className="space-y-2">
              {highlights.map((h: any, i: number) => (
                <div key={i} className={`rounded-md px-3 py-2 text-sm ${HIGHLIGHT_COLORS[h.type] ?? 'bg-muted'}`}>
                  <span className="font-medium capitalize">{h.type.replace('_', ' ')}: </span>
                  {h.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/share/
git commit -m "feat(ui): add public session share page"
```

---

## Task 11: Type check and smoke test

**Step 1: Type check**
```bash
npx tsc --noEmit
```
Fix any type errors. Common issues: missing `import type`, `any` assertions on Prisma JSON fields.

**Step 2: Start worker in a separate terminal**
```bash
npm run worker:summary
```
Expected: `[ai-summary] Worker started`

**Step 3: Manual smoke test**
1. Navigate to a session that has a transcript
2. Click "Generate" in the Summary Panel
3. Wait for summary to appear (polling every 3s)
4. Click "Share" — verify URL is copied
5. Open the share URL in incognito — verify summary renders without auth

**Step 4: Final commit**
```bash
git add -A
git commit -m "feat: Feature 1 — AI session summaries + highlights hub complete"
```
