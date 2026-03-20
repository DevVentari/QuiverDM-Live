# Session Detail Rework + Post-Session Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the session detail page into a clean summary-first layout, strip filler words from transcripts, auto-trigger AI summary after transcription, post summaries to Discord, and add sourcebook + Discord webhook to campaign settings.

**Architecture:** Filler stripping is a pure util applied in `transcription-worker.ts` before saving `correctedText` (rawText stays original). Auto-summary and Discord post are pipeline additions to existing workers. Session detail page is a full rewrite — linear sections replacing the tabbed monolith. Campaign settings extended via existing `settings` JSON field.

**Tech Stack:** Next.js 15, tRPC, Prisma, BullMQ, Discord webhook (fetch only — no SDK), Tailwind + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-03-16-session-detail-rework-design.md`

---

## Chunk 1: Filler Word Stripping

### Task 1: `strip-fillers.ts` utility

**Files:**
- Create: `src/lib/transcription/strip-fillers.ts`

- [ ] **Step 1: Create the util**

  ```ts
  // src/lib/transcription/strip-fillers.ts

  const FILLER_PATTERNS = [
    /\b(um+|uh+|er+|ah+)\b/gi,
    /\b(you know,?\s*)/gi,
    /\b(i mean,?\s*)/gi,
    /\b(sort of,?\s*)/gi,
    /\b(kind of,?\s*)/gi,
    /\b(basically,?\s*)/gi,
    /\b(literally,?\s*)/gi,
  ];

  export function stripFillers(text: string): string {
    let result = text;
    for (const pattern of FILLER_PATTERNS) {
      result = result.replace(pattern, '');
    }
    // Collapse double spaces left by removal
    return result.replace(/\s{2,}/g, ' ').trim();
  }
  ```

- [ ] **Step 2: Write unit test**

  Create `src/lib/transcription/__tests__/strip-fillers.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest';
  import { stripFillers } from '../strip-fillers';

  describe('stripFillers', () => {
    it('removes um and uh', () => {
      expect(stripFillers('we um went to the uh dungeon')).toBe('we went to the dungeon');
    });

    it('removes you know', () => {
      expect(stripFillers('it was, you know, dangerous')).toBe('it was, dangerous');
    });

    it('removes i mean', () => {
      expect(stripFillers('i mean we should go')).toBe('we should go');
    });

    it('handles repeated fillers', () => {
      expect(stripFillers('um um basically uh we went')).toBe('we went');
    });

    it('collapses double spaces', () => {
      expect(stripFillers('the  dungeon')).toBe('the dungeon');
    });

    it('preserves normal text', () => {
      expect(stripFillers('we entered the dungeon at midnight')).toBe(
        'we entered the dungeon at midnight'
      );
    });
  });
  ```

- [ ] **Step 3: Run tests**

  ```bash
  npx vitest run src/lib/transcription/__tests__/strip-fillers.test.ts
  ```

  Expected: all 6 pass.

- [ ] **Step 4: Apply in transcription worker**

  In `src/lib/transcription/db.ts`, find where `correctedText` is set (around line 105-106) and apply stripping:

  ```ts
  import { stripFillers } from './strip-fillers';

  // After building textWithSpeakers:
  correctedText: textWithSpeakers ? stripFillers(textWithSpeakers) : stripFillers(result.text),
  ```

  `rawText` stays unchanged — it stores the original.

- [ ] **Step 5: Type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/transcription/strip-fillers.ts \
          src/lib/transcription/__tests__/strip-fillers.test.ts \
          src/lib/transcription/db.ts
  git commit -m "feat(transcript): strip filler words from correctedText, preserve rawText"
  ```

---

## Chunk 2: Pipeline — Auto-Summary + Discord Post

### Task 2: Auto-enqueue summary after transcription

**Files:**
- Modify: `src/lib/queue/transcription-worker.ts`

- [ ] **Step 1: Add import and auto-enqueue**

  In `src/lib/queue/transcription-worker.ts`, after the `addSessionEventsJob` block (around line 230), add:

  ```ts
  import { addAiSummaryJob } from './ai-summary-queue';

  // Auto-trigger AI summary if not already generated
  {
    const session = await prisma.gameSession.findUnique({
      where: { id: data.sessionId },
      select: { aiSummaryStatus: true },
    });
    if (session?.aiSummaryStatus === 'none') {
      await prisma.gameSession.update({
        where: { id: data.sessionId },
        data: { aiSummaryStatus: 'pending' },
      });
      addAiSummaryJob({ sessionId: data.sessionId }).catch(() => undefined);
    }
  }
  ```

- [ ] **Step 2: Check `addAiSummaryJob` signature**

  ```bash
  grep -n "export.*addAiSummaryJob\|interface AiSummaryJobData" src/lib/queue/ai-summary-queue.ts
  ```

  Confirm `{ sessionId }` is the correct input shape. Adjust if needed.

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/queue/transcription-worker.ts
  git commit -m "feat(pipeline): auto-enqueue AI summary after transcription completes"
  ```

---

### Task 3: Discord post utility

**Files:**
- Create: `src/lib/discord/post-summary.ts`

- [ ] **Step 1: Create the util**

  ```ts
  // src/lib/discord/post-summary.ts

  const FREE_LIMIT = 2000;
  const SUB_LIMIT = 4000;

  export async function postSummaryToDiscord(
    webhookUrl: string,
    sessionTitle: string,
    summary: string,
    isSubscribed: boolean
  ): Promise<void> {
    const limit = isSubscribed ? SUB_LIMIT : FREE_LIMIT;
    const header = `**${sessionTitle}**\n`;
    const available = limit - header.length;
    const body = summary.length > available ? summary.slice(0, available - 1) + '…' : summary;

    const messages: string[] = [];

    if (isSubscribed && body.length > FREE_LIMIT - header.length) {
      // Split across 2 messages for subscribers
      const firstChunk = body.slice(0, FREE_LIMIT - header.length);
      const secondChunk = body.slice(FREE_LIMIT - header.length);
      messages.push(header + firstChunk);
      if (secondChunk) messages.push(secondChunk);
    } else {
      messages.push(header + body);
    }

    for (const content of messages) {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
      }
    }
  }
  ```

- [ ] **Step 2: Write unit test**

  Create `src/lib/discord/__tests__/post-summary.test.ts`:

  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  // Mock fetch
  const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
  vi.stubGlobal('fetch', mockFetch);

  import { postSummaryToDiscord } from '../post-summary';

  describe('postSummaryToDiscord', () => {
    beforeEach(() => mockFetch.mockClear());

    it('sends single message for free users', async () => {
      await postSummaryToDiscord('https://discord.com/api/webhooks/test', 'Session 7', 'Short summary', false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.content).toContain('**Session 7**');
      expect(body.content).toContain('Short summary');
    });

    it('truncates to 2000 chars for free users', async () => {
      const longSummary = 'a'.repeat(3000);
      await postSummaryToDiscord('https://discord.com/api/webhooks/test', 'S', longSummary, false);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.content.length).toBeLessThanOrEqual(2000);
    });

    it('sends 2 messages for subscribers with long summary', async () => {
      const longSummary = 'b'.repeat(3000);
      await postSummaryToDiscord('https://discord.com/api/webhooks/test', 'S', longSummary, true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws on webhook error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Bad Request' });
      await expect(
        postSummaryToDiscord('https://discord.com/api/webhooks/test', 'S', 'summary', false)
      ).rejects.toThrow('Discord webhook failed');
    });
  });
  ```

- [ ] **Step 3: Run tests**

  ```bash
  npx vitest run src/lib/discord/__tests__/post-summary.test.ts
  ```

  Expected: all 4 pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/discord/post-summary.ts src/lib/discord/__tests__/post-summary.test.ts
  git commit -m "feat(discord): add postSummaryToDiscord util with free/subscribed limits"
  ```

---

### Task 4: Auto-post to Discord after summary completes

**Files:**
- Modify: `src/lib/queue/ai-summary-worker.ts`

- [ ] **Step 1: Find where summary is saved**

  ```bash
  grep -n "aiSummaryStatus.*done\|aiSummary.*result" src/lib/queue/ai-summary-worker.ts | head -10
  ```

- [ ] **Step 2: Add Discord post after summary saves**

  After the `aiSummaryStatus: 'done'` update block, add:

  ```ts
  import { postSummaryToDiscord } from '@/lib/discord/post-summary';

  // Auto-post to Discord if campaign has webhook configured
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: session.campaignId },
      select: { settings: true, owner: { select: { subscriptionTier: true } } },
    });
    const settings = (campaign?.settings ?? {}) as Record<string, unknown>;
    const webhookUrl = settings.discordWebhookUrl as string | undefined;
    if (webhookUrl) {
      const isSubscribed = campaign?.owner?.subscriptionTier === 'pro' ||
                           campaign?.owner?.subscriptionTier === 'team';
      await postSummaryToDiscord(
        webhookUrl,
        session.title ?? `Session ${session.sessionNumber}`,
        result.summary,
        isSubscribed
      );
    }
  } catch (err) {
    console.error('[AiSummaryWorker] Discord post failed:', err);
    // Non-fatal — summary is already saved
  }
  ```

- [ ] **Step 3: Check Campaign owner field**

  ```bash
  grep -n "owner\|subscriptionTier\|userId" prisma/schema.prisma | grep -i "campaign\|user" | head -10
  ```

  Adjust the query path to `subscriptionTier` based on actual schema.

- [ ] **Step 4: Type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/queue/ai-summary-worker.ts
  git commit -m "feat(pipeline): auto-post summary to Discord after AI generation completes"
  ```

---

## Chunk 3: Campaign Settings + tRPC

### Task 5: Add sourcebook + Discord webhook to campaign settings UI

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/settings/page.tsx`

- [ ] **Step 1: Read the settings page**

  Open `src/app/(app)/campaigns/[slug]/settings/page.tsx` and find where settings are displayed/edited.

- [ ] **Step 2: Check if `campaigns.updateSettings` mutation exists**

  ```bash
  grep -n "updateSettings\|update.*settings" src/server/routers/campaigns.ts | head -5
  ```

  If it doesn't exist, add it:

  ```ts
  // In src/server/routers/campaigns.ts
  updateSettings: campaignOwnerProcedure
    .input(z.object({
      campaignId: z.string(),
      sourcebook: z.string().optional(),
      discordWebhookUrl: z.string().url().optional().or(z.literal('')),
    }))
    .mutation(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { settings: true },
      });
      const current = (campaign?.settings ?? {}) as Record<string, unknown>;
      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: {
          settings: {
            ...current,
            ...(input.sourcebook !== undefined && { sourcebook: input.sourcebook }),
            ...(input.discordWebhookUrl !== undefined && { discordWebhookUrl: input.discordWebhookUrl }),
          },
        },
      });
    }),
  ```

- [ ] **Step 3: Add fields to the settings UI**

  In the settings page, add two new fields in a "Integrations" or "AI & Integrations" section:

  ```tsx
  // Sourcebook field
  <div className="space-y-2">
    <Label htmlFor="sourcebook">Sourcebook</Label>
    <Input
      id="sourcebook"
      placeholder="e.g. Vecna: Eye of Ruin"
      value={sourcebook}
      onChange={(e) => setSourcebook(e.target.value)}
    />
    <p className="text-xs text-muted-foreground">
      Used by AI to provide lore-accurate summaries and suggestions.
    </p>
  </div>

  // Discord webhook field
  <div className="space-y-2">
    <Label htmlFor="discord-webhook">Discord Webhook URL</Label>
    <Input
      id="discord-webhook"
      placeholder="https://discord.com/api/webhooks/..."
      value={discordWebhookUrl}
      onChange={(e) => setDiscordWebhookUrl(e.target.value)}
    />
    <p className="text-xs text-muted-foreground">
      Session summaries will be posted here automatically.
    </p>
  </div>
  ```

  Wire to `trpc.campaigns.updateSettings.useMutation()` on save.

- [ ] **Step 4: Inject sourcebook into AI summary prompt**

  In `src/lib/queue/ai-summary-worker.ts`, fetch the campaign sourcebook before generating summary:

  ```ts
  const campaign = await prisma.campaign.findUnique({
    where: { id: session.campaignId },
    select: { settings: true },
  });
  const sourcebook = ((campaign?.settings ?? {}) as Record<string, unknown>).sourcebook as string | undefined;

  // Prepend to prompt if set:
  const sourcebookContext = sourcebook
    ? `This session is part of a campaign running "${sourcebook}". Use this for context when referencing locations, factions, and lore.\n\n`
    : '';
  ```

  Prepend `sourcebookContext` to the existing user prompt string.

- [ ] **Step 5: Type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/app/"(app)"/campaigns/"[slug]"/settings/page.tsx \
          src/server/routers/campaigns.ts \
          src/lib/queue/ai-summary-worker.ts
  git commit -m "feat(campaign): add sourcebook and Discord webhook to campaign settings"
  ```

---

### Task 6: Add `postToDiscord` tRPC mutation (manual trigger)

**Files:**
- Modify: `src/server/routers/sessions.ts`

- [ ] **Step 1: Add mutation**

  ```ts
  postToDiscord: campaignDMProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        select: {
          title: true,
          sessionNumber: true,
          aiSummary: true,
          campaign: {
            select: {
              settings: true,
              userId: true,
            },
          },
        },
      });

      if (!session?.aiSummary) {
        throw new Error('No summary available to post');
      }

      const settings = (session.campaign.settings ?? {}) as Record<string, unknown>;
      const webhookUrl = settings.discordWebhookUrl as string | undefined;

      if (!webhookUrl) {
        throw new Error('No Discord webhook configured for this campaign');
      }

      const owner = await prisma.user.findUnique({
        where: { id: session.campaign.userId },
        select: { subscriptionTier: true },
      });

      const isSubscribed = owner?.subscriptionTier === 'pro' || owner?.subscriptionTier === 'team';

      await postSummaryToDiscord(
        webhookUrl,
        session.title ?? `Session ${session.sessionNumber}`,
        session.aiSummary,
        isSubscribed
      );

      return { ok: true };
    }),
  ```

  Add import:
  ```ts
  import { postSummaryToDiscord } from '@/lib/discord/post-summary';
  ```

- [ ] **Step 2: Check `subscriptionTier` field name on User model**

  ```bash
  grep -n "subscriptionTier\|subscription" prisma/schema.prisma | head -10
  ```

  Adjust field name if different (may be `plan`, `tier`, etc.).

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/server/routers/sessions.ts
  git commit -m "feat(sessions): add postToDiscord mutation for manual summary posting"
  ```

---

## Chunk 4: Session Detail Page Rewrite

### Task 7: Rewrite session detail page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`

This is a full rewrite. The current file is a 63KB monolith. The new version is a focused, linear page.

- [ ] **Step 1: Understand what to preserve**

  The current page has these components to keep:
  - `RecordingCard` — keep, move to its own file if large
  - `SummaryPanel` (from `@/components/session/summary-panel`) — reference for summary rendering
  - `AudioRecorder` — keep in recordings section
  - `DmVisibilityControls` — keep

  The following are NOT in the new design:
  - `CockpitLayout` — session detail is not the cockpit
  - The large transcript viewer (speaker turns, search, playback sync)
  - Tabbed layout

- [ ] **Step 2: Write the new page**

  Replace the entire file content:

  ```tsx
  'use client';

  import { useParams } from 'next/navigation';
  import { useState } from 'react';
  import Link from 'next/link';
  import ReactMarkdown from 'react-markdown';
  import { trpc } from '@/lib/trpc';
  import { useCampaign } from '@/components/campaign/campaign-context';
  import { AudioRecorder } from '@/components/session/audio-recorder';
  import { DmVisibilityControls } from '@/components/session/dm-visibility-controls';
  import { Button } from '@/components/ui/button';
  import { Skeleton } from '@/components/ui/skeleton';
  import { Badge } from '@/components/ui/badge';
  import { useToast } from '@/hooks/use-toast';
  import {
    Sparkles, RefreshCw, Send, ChevronDown, ChevronUp,
    Mic, Video, Clock, FileText, ArrowLeft, Pencil
  } from 'lucide-react';
  import { format } from 'date-fns';

  function SummaryCard({ session, sessionId, slug }: { session: any; sessionId: string; slug: string }) {
    const { toast } = useToast();
    const utils = trpc.useUtils();

    const generateSummary = trpc.sessions.generateAiSummary?.useMutation?.({
      onSuccess: () => void utils.sessions.getById.invalidate({ id: sessionId }),
      onError: (e) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
    });

    const postToDiscord = trpc.sessions.postToDiscord.useMutation({
      onSuccess: () => toast({ title: 'Posted to Discord' }),
      onError: (e) => toast({ title: 'Discord post failed', description: e.message, variant: 'destructive' }),
    });

    const status = session.aiSummaryStatus;

    return (
      <div className="rounded-sm border border-border/40 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)' }}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-border/30">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: 'hsl(35 80% 55%)' }} />
            <span className="text-sm font-semibold" style={{ color: 'hsl(35 20% 88%)' }}>Session Summary</span>
          </div>
          <div className="flex gap-2">
            {status === 'done' && (
              <>
                <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs"
                  onClick={() => postToDiscord.mutate({ sessionId })}
                  disabled={postToDiscord.isPending}>
                  <Send className="h-3 w-3" />
                  {postToDiscord.isPending ? 'Posting…' : 'Discord'}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs"
                  onClick={() => generateSummary?.mutate?.({ sessionId })}>
                  <RefreshCw className="h-3 w-3" />
                  Re-analyze
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-4">
          {status === 'none' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm" style={{ color: 'hsl(35 10% 45%)' }}>No summary yet.</p>
              <Button size="sm" onClick={() => generateSummary?.mutate?.({ sessionId })}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Analyze Session
              </Button>
            </div>
          )}
          {(status === 'pending' || status === 'processing') && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <RefreshCw className="h-4 w-4 animate-spin" style={{ color: 'hsl(35 80% 55%)' }} />
              <span className="text-sm" style={{ color: 'hsl(35 10% 48%)' }}>Analyzing session…</span>
            </div>
          )}
          {status === 'done' && session.aiSummary && (
            <div className="prose prose-sm prose-invert max-w-none"
              style={{ '--tw-prose-body': 'hsl(35 15% 65%)', '--tw-prose-headings': 'hsl(35 20% 88%)' } as any}>
              <ReactMarkdown>{session.aiSummary}</ReactMarkdown>
            </div>
          )}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-destructive">{session.aiSummaryError ?? 'Summary generation failed.'}</p>
              <Button size="sm" variant="outline" onClick={() => generateSummary?.mutate?.({ sessionId })}>
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  function RawDataSection({ session }: { session: any }) {
    const [open, setOpen] = useState(false);
    const transcripts: any[] = session.transcripts ?? [];
    if (!transcripts.length) return null;

    return (
      <div className="rounded-sm border border-border/40 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" style={{ color: 'hsl(35 10% 40%)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'hsl(35 10% 40%)' }}>
              Transcript Data
            </span>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {open && (
          <div className="border-t border-border/30 px-5 py-4">
            <pre className="text-[11px] overflow-auto max-h-96 rounded-sm p-3"
              style={{ background: 'hsl(240 10% 6%)', color: 'hsl(35 10% 60%)' }}>
              {JSON.stringify(transcripts[0]?.speakers ?? transcripts[0], null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  function RecordingsSection({ session, sessionId, campaignId }: { session: any; sessionId: string; campaignId: string }) {
    const recordings: any[] = session.recordings ?? [];

    return (
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'hsl(35 80% 48%)' }}>
          Recordings
        </p>
        {recordings.map((rec: any) => (
          <div key={rec.id} className="rounded-sm border border-border/40 px-4 py-3"
            style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)' }}>
            <div className="flex items-center gap-2">
              {rec.type === 'video'
                ? <Video className="h-4 w-4 shrink-0" style={{ color: 'hsl(35 10% 45%)' }} />
                : <Mic className="h-4 w-4 shrink-0" style={{ color: 'hsl(35 10% 45%)' }} />}
              <span className="text-sm capitalize" style={{ color: 'hsl(35 20% 75%)' }}>{rec.type} recording</span>
              {rec.durationSeconds && (
                <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: 'hsl(35 10% 40%)' }}>
                  <Clock className="h-3 w-3" />
                  {Math.floor(rec.durationSeconds / 60)}m
                </span>
              )}
            </div>
          </div>
        ))}
        <AudioRecorder sessionId={sessionId} campaignId={campaignId} />
      </div>
    );
  }

  export default function SessionDetailPage() {
    const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>();
    const { campaignId, isDM } = useCampaign();

    const { data: session, isLoading } = trpc.sessions.getById.useQuery(
      { id: sessionId },
      { staleTime: 30_000, refetchInterval: (data: any) =>
          data?.aiSummaryStatus === 'pending' || data?.aiSummaryStatus === 'processing' ? 5000 : false
      }
    );

    if (isLoading) {
      return (
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      );
    }

    if (!session) return null;

    const s = session as any;

    return (
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        {/* Header */}
        <div className="space-y-3">
          <Link href={`/campaigns/${slug}/sessions`}
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: 'hsl(35 10% 45%)' }}>
            <ArrowLeft className="h-3 w-3" /> Sessions
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-1"
                style={{ color: 'hsl(35 80% 48%)' }}>
                Session {s.sessionNumber}
              </p>
              <h1 className="font-display text-xl font-bold" style={{ color: 'hsl(35 20% 88%)' }}>
                {s.title ?? `Session ${s.sessionNumber}`}
              </h1>
              {s.date && (
                <p className="text-xs mt-1" style={{ color: 'hsl(35 10% 48%)' }}>
                  {format(new Date(s.date), 'd MMM yyyy')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              {isDM && (
                <Link href={`/campaigns/${slug}/sessions/${sessionId}/prep`}>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                    <Pencil className="h-3 w-3" /> Prep
                  </Button>
                </Link>
              )}
            </div>
          </div>
          {isDM && <DmVisibilityControls sessionId={sessionId} visibility={s.playerVisibility} />}
        </div>

        {/* Summary */}
        <SummaryCard session={s} sessionId={sessionId} slug={slug} />

        {/* Recordings */}
        <RecordingsSection session={s} sessionId={sessionId} campaignId={campaignId} />

        {/* Raw transcript data */}
        <RawDataSection session={s} />
      </div>
    );
  }
  ```

- [ ] **Step 3: Check `generateAiSummary` mutation name**

  ```bash
  grep -n "generateAiSummary\|generateSummary\|triggerSummary" src/server/routers/sessions.ts | head -5
  ```

  Adjust the mutation name in the page to match what's in the router.

- [ ] **Step 4: Check what `sessions.getById` returns**

  ```bash
  grep -n "getById\|include.*transcript\|include.*recording" src/server/routers/sessions.ts | head -10
  ```

  Confirm `transcripts` and `recordings` are included in the query result. If not, update the query or use separate queries.

- [ ] **Step 5: Type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 6: Smoke test**

  Navigate to the session detail page. Verify:
  - Header renders with session title and number
  - Summary card shows correct state (none/processing/done)
  - Recordings section renders
  - Raw data section is collapsed by default
  - Discord button visible when summary is done

- [ ] **Step 7: Commit**

  ```bash
  git add src/app/"(app)"/campaigns/"[slug]"/sessions/"[sessionId]"/page.tsx
  git commit -m "feat(sessions): rework session detail page — summary-first layout, remove transcript viewer"
  ```

---

### Task 8: Final push

- [ ] **Step 1: Run lint**

  ```bash
  npm run lint
  ```

  Fix any lint errors.

- [ ] **Step 2: Final type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 3: Push**

  ```bash
  git push origin main
  ```
