# API Usage & Cost Tracking — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Track every AI API call QuiverDM makes per-user, show cost breakdowns by provider/feature/model on a new `/settings/api-usage` page.

**Architecture:** New `ApiUsageLog` Prisma model stores per-call data. A `logApiUsage()` helper is injected at each AI call site. New `apiUsage` tRPC router aggregates data. New Next.js page renders provider cards, feature/model tables, and recent call log.

**Tech Stack:** Prisma, tRPC, React (Next.js App Router), shadcn/ui, Tailwind

---

## Task 1: Prisma Model — `ApiUsageLog`

**Files:**
- Modify: `prisma/schema.prisma` (after `UserUsage` model, ~line 980)

**Step 1: Add the model to schema**

Add after the `UserUsage` model closing brace:

```prisma
model ApiUsageLog {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider     String   // gemini, openai, anthropic, ollama
  model        String   // gemini-2.5-flash-lite, gpt-4o-mini, etc.
  feature      String   // extraction, recap, search, image_gen, encounter_gen, rules_qa, obsidian_import
  tokensIn     Int      @default(0)
  tokensOut    Int      @default(0)
  estimatedCost Float   @default(0) // USD
  requestCount Int      @default(1)
  metadata     Json?
  createdAt    DateTime @default(now())

  @@index([userId, createdAt])
  @@index([userId, provider, createdAt])
  @@index([userId, feature, createdAt])
}
```

Also add `apiUsageLogs ApiUsageLog[]` to the `User` model relations (find the existing relation fields block in the `User` model).

**Step 2: Push schema**

Run: `npm run db:push`
Expected: Schema synced, no errors.

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add ApiUsageLog model for AI cost tracking"
```

---

## Task 2: Pricing Map + Logger Utility

**Files:**
- Create: `src/lib/ai/pricing.ts`
- Create: `src/lib/ai/usage-logger.ts`

**Step 1: Create pricing map**

Create `src/lib/ai/pricing.ts`:

```ts
export interface ModelPricing {
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gemini-2.5-flash-lite': { inputPerMillionTokens: 0.075, outputPerMillionTokens: 0.30 },
  'gemini-2.0-flash': { inputPerMillionTokens: 0.10, outputPerMillionTokens: 0.40 },
  'gemini-2.5-pro': { inputPerMillionTokens: 1.25, outputPerMillionTokens: 5.00 },
  'gpt-4o': { inputPerMillionTokens: 2.50, outputPerMillionTokens: 10.00 },
  'gpt-4o-mini': { inputPerMillionTokens: 0.15, outputPerMillionTokens: 0.60 },
  'claude-sonnet-4-20250514': { inputPerMillionTokens: 3.00, outputPerMillionTokens: 15.00 },
  'claude-haiku-4-5-20251001': { inputPerMillionTokens: 0.80, outputPerMillionTokens: 4.00 },
};

export function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (tokensIn / 1_000_000) * pricing.inputPerMillionTokens
       + (tokensOut / 1_000_000) * pricing.outputPerMillionTokens;
}
```

**Step 2: Create usage logger**

Create `src/lib/ai/usage-logger.ts`:

```ts
import { prisma } from '@/lib/prisma';
import { estimateCost } from './pricing';

export interface ApiUsageEntry {
  userId: string;
  provider: string;
  model: string;
  feature: string;
  tokensIn: number;
  tokensOut: number;
  metadata?: Record<string, unknown>;
}

export async function logApiUsage(entry: ApiUsageEntry): Promise<void> {
  try {
    const cost = estimateCost(entry.model, entry.tokensIn, entry.tokensOut);
    await prisma.apiUsageLog.create({
      data: {
        userId: entry.userId,
        provider: entry.provider,
        model: entry.model,
        feature: entry.feature,
        tokensIn: entry.tokensIn,
        tokensOut: entry.tokensOut,
        estimatedCost: cost,
        metadata: entry.metadata ?? undefined,
      },
    });
  } catch (err) {
    console.error('[ApiUsageLogger] Failed to log usage:', err);
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/ai/pricing.ts src/lib/ai/usage-logger.ts
git commit -m "feat(ai): add pricing map and usage logger utility"
```

---

## Task 3: Instrument Extraction Pipeline

**Files:**
- Modify: `src/lib/ai/extraction.ts`

The three cloud provider functions already return `tokensUsed`. We need to capture `tokensIn` and `tokensOut` separately and thread `userId` through.

**Step 1: Update `ExtractionResult` to carry token breakdown**

In `src/lib/ai/extraction.ts`, change the `ExtractionResult` interface (line ~24):

```ts
export interface ExtractionResult {
  success: boolean;
  items: ExtractedContent[];
  tokensUsed?: number;
  tokensIn?: number;
  tokensOut?: number;
  model?: string;
  provider: ExtractionProvider;
  error?: string;
}
```

**Step 2: Update `extractWithGemini` to capture token breakdown**

After the `result = await response.json()` line (~line 257-258), update to:

```ts
  const tokensIn = result.usageMetadata?.promptTokenCount || 0;
  const tokensOut = result.usageMetadata?.candidatesTokenCount || 0;
  const tokensUsed = result.usageMetadata?.totalTokenCount || 0;
```

And update the return to include them:

```ts
  return { success: true, items, tokensUsed, tokensIn, tokensOut, model: 'gemini-2.5-flash-lite', provider: 'gemini' };
```

**Step 3: Update `extractWithAnthropic` similarly**

After `result = await response.json()` (~line 298-300):

```ts
  const tokensIn = result.usage?.input_tokens || 0;
  const tokensOut = result.usage?.output_tokens || 0;
  const tokensUsed = tokensIn + tokensOut;
```

Return:

```ts
  return { success: true, items, tokensUsed, tokensIn, tokensOut, model: 'claude-sonnet-4-20250514', provider: 'anthropic' };
```

**Step 4: Update `extractWithOpenAI` similarly**

After `result = await response.json()` (~line 338-340):

```ts
  const tokensIn = result.usage?.prompt_tokens || 0;
  const tokensOut = result.usage?.completion_tokens || 0;
  const tokensUsed = result.usage?.total_tokens || 0;
```

Return:

```ts
  return { success: true, items, tokensUsed, tokensIn, tokensOut, model: 'gpt-4o-mini', provider: 'openai' };
```

**Step 5: Update `extractContent` to aggregate token breakdown + add userId param**

Change the function signature:

```ts
export async function extractContent(
  markdown: string,
  provider: ExtractionProvider = 'gemini',
  userKeys?: { geminiApiKey?: string },
  userId?: string
): Promise<ExtractionResult> {
```

In the chunk loop, aggregate `tokensIn`/`tokensOut`:

```ts
  let totalTokensIn = 0;
  let totalTokensOut = 0;
```

Inside the `if (result.success)` block:

```ts
        totalTokensIn += result.tokensIn || 0;
        totalTokensOut += result.tokensOut || 0;
```

After the chunk loop (before the final return), add the logging call:

```ts
    if (userId && totalTokens > 0) {
      const { logApiUsage } = await import('./usage-logger');
      void logApiUsage({
        userId,
        provider,
        model: allItems.length > 0 ? (/* use first chunk's model */ provider === 'gemini' ? 'gemini-2.5-flash-lite' : provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini') : provider,
        feature: 'extraction',
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
      });
    }
```

Update the final return to include token breakdown:

```ts
    return {
      success: allItems.length > 0 || errors.length === 0,
      items: allItems,
      tokensUsed: totalTokens,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      provider,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
```

**Step 6: Update `extractWithFallback` to pass userId through**

```ts
export async function extractWithFallback(
  markdown: string,
  preferredProvider?: ExtractionProvider,
  userKeys?: { geminiApiKey?: string },
  userId?: string
): Promise<ExtractionResult> {
```

And in the loop:

```ts
      const result = await extractContent(markdown, provider, userKeys, userId);
```

**Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors.

**Step 8: Commit**

```bash
git add src/lib/ai/extraction.ts
git commit -m "feat(ai): instrument extraction pipeline with token breakdown and usage logging"
```

---

## Task 4: Instrument Other AI Call Sites

**Files:**
- Modify: `src/lib/ai/gemini.ts`
- Modify: `src/lib/ai/encounter-generator.ts`
- Modify: `src/server/services/rules.service.ts`
- Modify: `src/lib/ai/obsidian-extraction.ts`
- Modify: `src/app/api/uploads/homebrew-import/extract/route.ts`

Each of these calls Gemini/Anthropic/OpenAI directly. For each one:
1. Capture the response's usage metadata
2. Call `logApiUsage()` fire-and-forget if `userId` is available

**Step 1: Update `src/lib/ai/gemini.ts` — `callGemini` and `callGeminiVision`**

These are utility functions called by other services. The simplest approach: return usage metadata alongside the text, but that changes the signature. Instead, accept an optional `userId` and `feature` param and log internally.

```ts
import { logApiUsage } from './usage-logger';

export async function callGemini(
  prompt: string,
  userKey?: string,
  opts?: { userId?: string; feature?: string }
): Promise<string> {
  const apiKey = userKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key available');

  const res = await fetch(`${BASE_URL}/${TEXT_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const json = await res.json();

  if (opts?.userId) {
    void logApiUsage({
      userId: opts.userId,
      provider: 'gemini',
      model: TEXT_MODEL,
      feature: opts.feature || 'unknown',
      tokensIn: json.usageMetadata?.promptTokenCount || 0,
      tokensOut: json.usageMetadata?.candidatesTokenCount || 0,
    });
  }

  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
```

Apply same pattern to `callGeminiVision` (with `VISION_MODEL`).

**Step 2: Update call sites to pass userId/feature where available**

- `src/server/services/rules.service.ts:84` — calls `callGemini(prompt, userKey)`. Add `{ userId, feature: 'rules_qa' }` (userId comes from the service method params — check if it receives userId).
- `src/lib/ai/obsidian-extraction.ts:37,80,121,135,161` — calls `callGemini(prompt, userGeminiKey)`. Add `{ userId, feature: 'obsidian_import' }` — thread userId from caller.
- `src/app/api/uploads/homebrew-import/extract/route.ts:49,54` — API route, has session. Add `{ userId: session.user.id, feature: 'extraction' }`.

- `src/lib/ai/encounter-generator.ts:152-197` — has its own local `callGemini`/`callAnthropic`/`callOpenAI`. Add logging after each response. Thread userId from `generateEncounter` params.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/lib/ai/gemini.ts src/lib/ai/encounter-generator.ts src/server/services/rules.service.ts src/lib/ai/obsidian-extraction.ts src/app/api/uploads/homebrew-import/extract/route.ts
git commit -m "feat(ai): instrument all AI call sites with usage logging"
```

---

## Task 5: Thread userId Through Worker Calls

**Files:**
- Modify: `src/lib/queue/worker.ts` (PDF worker — calls `extractWithFallback`)
- Modify: `src/server/services/homebrew-pdf.service.ts` (calls `extractWithFallback`)
- Modify: `src/server/services/homebrew-extraction.service.ts` (calls `extractContent`)

**Step 1: Update homebrew-pdf.service.ts**

In `extractContent` method (~line 352), the service has `userId` param. Pass it through:

```ts
const extractionResult = await extractWithFallback(pdf.markdownContent, undefined, undefined, userId);
```

**Step 2: Update homebrew-extraction.service.ts**

In the `extractContent` call (~line 245), pass userId:

```ts
const result = await extractContent(markdown, provider, userKeys, userId);
```

(Check the method signature to confirm `userId` is available in scope.)

**Step 3: Update worker.ts**

In the PDF worker chunk (~line 546), the job data should contain `userId`. Pass it:

```ts
const extractionResult = await extractWithFallback(markdown, undefined, userKeys, job.data.userId);
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add src/lib/queue/worker.ts src/server/services/homebrew-pdf.service.ts src/server/services/homebrew-extraction.service.ts
git commit -m "feat(ai): thread userId through worker and service extraction calls"
```

---

## Task 6: tRPC Router — `apiUsage`

**Files:**
- Create: `src/server/routers/api-usage.ts`
- Modify: `src/server/routers/_app.ts`

**Step 1: Create the router**

Create `src/server/routers/api-usage.ts`:

```ts
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';

export const apiUsageRouter = router({
  getSummary: protectedProcedure
    .input(z.object({
      periodStart: z.date().optional(),
      periodEnd: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const now = new Date();
      const start = input?.periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
      const end = input?.periodEnd ?? now;

      const logs = await prisma.apiUsageLog.groupBy({
        by: ['provider'],
        where: { userId, createdAt: { gte: start, lte: end } },
        _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        _count: true,
      });

      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const geminiToday = await prisma.apiUsageLog.aggregate({
        where: { userId, provider: 'gemini', createdAt: { gte: todayStart } },
        _sum: { requestCount: true },
      });

      return {
        providers: logs.map(l => ({
          provider: l.provider,
          requests: l._count,
          tokensIn: l._sum.tokensIn || 0,
          tokensOut: l._sum.tokensOut || 0,
          estimatedCost: l._sum.estimatedCost || 0,
        })),
        geminiRequestsToday: geminiToday._sum.requestCount || 0,
        periodStart: start,
        periodEnd: end,
      };
    }),

  getByFeature: protectedProcedure
    .input(z.object({
      periodStart: z.date().optional(),
      periodEnd: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const now = new Date();
      const start = input?.periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
      const end = input?.periodEnd ?? now;

      const logs = await prisma.apiUsageLog.groupBy({
        by: ['feature'],
        where: { userId, createdAt: { gte: start, lte: end } },
        _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        _count: true,
      });

      return logs.map(l => ({
        feature: l.feature,
        requests: l._count,
        tokensIn: l._sum.tokensIn || 0,
        tokensOut: l._sum.tokensOut || 0,
        estimatedCost: l._sum.estimatedCost || 0,
      }));
    }),

  getByModel: protectedProcedure
    .input(z.object({
      periodStart: z.date().optional(),
      periodEnd: z.date().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const now = new Date();
      const start = input?.periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
      const end = input?.periodEnd ?? now;

      const logs = await prisma.apiUsageLog.groupBy({
        by: ['model', 'provider'],
        where: { userId, createdAt: { gte: start, lte: end } },
        _sum: { tokensIn: true, tokensOut: true, estimatedCost: true, requestCount: true },
        _count: true,
      });

      return logs.map(l => ({
        model: l.model,
        provider: l.provider,
        requests: l._count,
        tokensIn: l._sum.tokensIn || 0,
        tokensOut: l._sum.tokensOut || 0,
        estimatedCost: l._sum.estimatedCost || 0,
      }));
    }),

  getRecentCalls: protectedProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const limit = input?.limit ?? 50;

      const logs = await prisma.apiUsageLog.findMany({
        where: {
          userId,
          ...(input?.cursor ? { id: { lt: input.cursor } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        select: {
          id: true,
          provider: true,
          model: true,
          feature: true,
          tokensIn: true,
          tokensOut: true,
          estimatedCost: true,
          createdAt: true,
        },
      });

      const hasMore = logs.length > limit;
      const items = hasMore ? logs.slice(0, -1) : logs;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),
});
```

**Step 2: Register in `_app.ts`**

Add import and register:

```ts
import { apiUsageRouter } from './api-usage';
```

In the `appRouter`:

```ts
  apiUsage: apiUsageRouter,
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add src/server/routers/api-usage.ts src/server/routers/_app.ts
git commit -m "feat(api): add apiUsage tRPC router with summary, feature, model, and recent call endpoints"
```

---

## Task 7: API Usage Page — UI

**Files:**
- Create: `src/app/(app)/settings/api-usage/page.tsx`

**Step 1: Create the page**

Create `src/app/(app)/settings/api-usage/page.tsx`:

```tsx
'use client';

import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Zap, Brain, Search, Image as ImageIcon, Swords, BookOpen, FileText, HelpCircle } from 'lucide-react';
import Link from 'next/link';

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama (Local)',
};

const FEATURE_LABELS: Record<string, { label: string; icon: typeof Zap }> = {
  extraction: { label: 'Homebrew Extraction', icon: FileText },
  recap: { label: 'AI Recaps', icon: Brain },
  search: { label: 'Semantic Search', icon: Search },
  image_gen: { label: 'Image Generation', icon: ImageIcon },
  encounter_gen: { label: 'Encounter Generation', icon: Swords },
  rules_qa: { label: 'Rules Q&A', icon: BookOpen },
  obsidian_import: { label: 'Obsidian Import', icon: FileText },
  derailment: { label: 'Derailment Detector', icon: Zap },
  combat_copilot: { label: 'Combat Co-pilot', icon: Swords },
  unknown: { label: 'Other', icon: HelpCircle },
};

function formatCost(cost: number): string {
  if (cost === 0) return 'Free';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export default function ApiUsagePage() {
  const summary = trpc.apiUsage.getSummary.useQuery(undefined, { staleTime: 60_000 });
  const byFeature = trpc.apiUsage.getByFeature.useQuery(undefined, { staleTime: 60_000 });
  const byModel = trpc.apiUsage.getByModel.useQuery(undefined, { staleTime: 60_000 });
  const recentCalls = trpc.apiUsage.getRecentCalls.useQuery(undefined, { staleTime: 60_000 });

  const totalCost = summary.data?.providers.reduce((sum, p) => sum + p.estimatedCost, 0) ?? 0;

  return (
    <div className="max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Settings
          </Button>
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold">API Usage</h1>
        <Badge variant="secondary">{formatCost(totalCost)} this period</Badge>
      </div>

      {/* Provider Summary Cards */}
      {summary.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(summary.data?.providers ?? []).map(p => (
            <Card key={p.provider}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {PROVIDER_LABELS[p.provider] ?? p.provider}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold">{formatCost(p.estimatedCost)}</p>
                <p className="text-xs text-muted-foreground">
                  {p.requests} requests
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTokens(p.tokensIn)} in / {formatTokens(p.tokensOut)} out
                </p>
                {p.provider === 'gemini' && summary.data && (
                  <p className="text-xs text-muted-foreground">
                    {1000 - (summary.data.geminiRequestsToday ?? 0)} free reqs left today
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          {(summary.data?.providers ?? []).length === 0 && (
            <Card className="col-span-full">
              <CardContent className="py-8 text-center text-muted-foreground">
                No API usage recorded yet. Usage will appear after AI features are used.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Breakdown by Feature */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage by Feature</CardTitle>
        </CardHeader>
        <CardContent>
          {byFeature.isLoading ? (
            <Skeleton className="h-48" />
          ) : (byFeature.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No usage data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Tokens In</TableHead>
                  <TableHead className="text-right">Tokens Out</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(byFeature.data ?? []).map(f => {
                  const config = FEATURE_LABELS[f.feature] ?? FEATURE_LABELS.unknown;
                  const Icon = config.icon;
                  return (
                    <TableRow key={f.feature}>
                      <TableCell className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {config.label}
                      </TableCell>
                      <TableCell className="text-right">{f.requests}</TableCell>
                      <TableCell className="text-right">{formatTokens(f.tokensIn)}</TableCell>
                      <TableCell className="text-right">{formatTokens(f.tokensOut)}</TableCell>
                      <TableCell className="text-right">{formatCost(f.estimatedCost)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Breakdown by Model */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage by Model</CardTitle>
        </CardHeader>
        <CardContent>
          {byModel.isLoading ? (
            <Skeleton className="h-48" />
          ) : (byModel.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No usage data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Tokens In</TableHead>
                  <TableHead className="text-right">Tokens Out</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(byModel.data ?? []).map(m => (
                  <TableRow key={`${m.model}-${m.provider}`}>
                    <TableCell className="font-mono text-xs">{m.model}</TableCell>
                    <TableCell>{PROVIDER_LABELS[m.provider] ?? m.provider}</TableCell>
                    <TableCell className="text-right">{m.requests}</TableCell>
                    <TableCell className="text-right">{formatTokens(m.tokensIn)}</TableCell>
                    <TableCell className="text-right">{formatTokens(m.tokensOut)}</TableCell>
                    <TableCell className="text-right">{formatCost(m.estimatedCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent API Calls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent API Calls</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCalls.isLoading ? (
            <Skeleton className="h-64" />
          ) : (recentCalls.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No API calls recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recentCalls.data?.items ?? []).map(call => {
                  const config = FEATURE_LABELS[call.feature] ?? FEATURE_LABELS.unknown;
                  return (
                    <TableRow key={call.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(call.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{config.label}</TableCell>
                      <TableCell className="font-mono text-xs">{call.model}</TableCell>
                      <TableCell className="text-right text-xs">
                        {formatTokens(call.tokensIn + call.tokensOut)}
                      </TableCell>
                      <TableCell className="text-right text-xs">{formatCost(call.estimatedCost)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/settings/api-usage/page.tsx
git commit -m "feat(ui): add API usage page at /settings/api-usage"
```

---

## Task 8: Link from Settings Page

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

**Step 1: Add link near API Keys section**

In `src/app/(app)/settings/page.tsx`, find the API Keys `<Card>` `<CardHeader>` section (~line 766-773). Add a link button inside the header:

```tsx
<CardHeader>
  <div className="flex items-center justify-between">
    <div>
      <CardTitle>API Keys</CardTitle>
      <CardDescription>
        Configure API keys for AI extraction and integrations.
        Keys are encrypted at rest.
      </CardDescription>
    </div>
    <Link href="/settings/api-usage">
      <Button variant="outline" size="sm">
        <Zap className="h-4 w-4 mr-1" />
        View API Usage
      </Button>
    </Link>
  </div>
</CardHeader>
```

Add `Zap` to the Lucide imports at the top of the file (it's not there yet — check first).

**Step 2: Verify dev server renders correctly**

Run: `npm run dev`
Navigate to `/settings` — confirm "View API Usage" button appears in API Keys section header.

**Step 3: Commit**

```bash
git add src/app/(app)/settings/page.tsx
git commit -m "feat(ui): add API usage link to settings page"
```

---

## Task 9: TypeScript + Lint + Build Verification

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Lint**

Run: `npm run lint`
Expected: No new errors.

**Step 3: Build**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Commit any fixes if needed**

---

## Task Summary

| Task | What | Files |
|------|------|-------|
| 1 | Prisma model | `prisma/schema.prisma` |
| 2 | Pricing map + logger | `src/lib/ai/pricing.ts`, `src/lib/ai/usage-logger.ts` |
| 3 | Instrument extraction | `src/lib/ai/extraction.ts` |
| 4 | Instrument other AI calls | `gemini.ts`, `encounter-generator.ts`, `rules.service.ts`, `obsidian-extraction.ts`, extract route |
| 5 | Thread userId through workers | `worker.ts`, `homebrew-pdf.service.ts`, `homebrew-extraction.service.ts` |
| 6 | tRPC router | `src/server/routers/api-usage.ts`, `_app.ts` |
| 7 | UI page | `src/app/(app)/settings/api-usage/page.tsx` |
| 8 | Settings link | `src/app/(app)/settings/page.tsx` |
| 9 | Verify build | — |
