# Feedback Overlay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a global floating overlay that captures console logs + a DOM screenshot, lets users describe a bug/feature/feedback, then posts a Discord forum thread and auto-posts a Claude triage analysis in the thread.

**Architecture:** Extend the existing `Feedback` model + service + router. A client-side console ring buffer provider intercepts `console.error/warn` before the widget opens. On submit, the tRPC mutation uploads the screenshot to Discord CDN, saves to DB, creates a Discord forum thread with the report embed + screenshot attachment, then calls Claude haiku to triage and posts the analysis as a follow-up embed.

**Tech Stack:** html2canvas (DOM snapshot), Discord REST API v10 (bot token, no gateway), `@anthropic-ai/sdk` (already installed), tRPC mutation, existing Prisma `Feedback` model.

**Design doc:** `docs/plans/2026-03-01-feedback-overlay-design.md`

---

## Pre-flight: Discord Bot Setup (manual, one-time)

Do this before starting Task 1. You need two values from Discord.

1. Go to https://discord.com/developers/applications → New Application → name it "QuiverDM Feedback"
2. Go to Bot tab → Add Bot → copy **Bot Token** → this is `DISCORD_BOT_TOKEN`
3. In your Discord server: create a **Forum channel** named `#feedback-reports`
4. Right-click the channel → Copy Channel ID → this is `DISCORD_FEEDBACK_CHANNEL_ID`
5. Invite the bot: OAuth2 → URL Generator → scopes: `bot` → permissions: `Send Messages`, `Create Public Threads`, `Attach Files`, `Embed Links`
6. Add to `.env` (local) and Vercel env vars (prod):
   ```
   DISCORD_BOT_TOKEN=your_bot_token
   DISCORD_FEEDBACK_CHANNEL_ID=your_channel_id
   ```

---

## Task 1: Install html2canvas

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install the package**

```bash
cd E:/Projects/QuiverDM
npm install html2canvas
npm install --save-dev @types/html2canvas
```

**Step 2: Verify it installed**

```bash
node -e "require('html2canvas'); console.log('ok')"
```
Expected: `ok`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add html2canvas for feedback overlay screenshots"
```

---

## Task 2: Console log ring buffer provider

**Files:**
- Create: `src/components/feedback/console-log-capture.tsx`

**What it does:** Installs `console.error` and `console.warn` intercepts on mount. Stores last 50 entries in a module-level array (survives re-renders). Exposes `getConsoleLogs()` and `clearConsoleLogs()` as named exports.

**Step 1: Create the file**

```tsx
// src/components/feedback/console-log-capture.tsx
'use client';

import { useEffect } from 'react';

export type CapturedLog = {
  ts: number;
  level: 'error' | 'warn';
  msg: string;
};

const MAX_LOGS = 50;
const MAX_MSG_LENGTH = 500;
const logBuffer: CapturedLog[] = [];

const originalError = typeof console !== 'undefined' ? console.error.bind(console) : null;
const originalWarn = typeof console !== 'undefined' ? console.warn.bind(console) : null;

function push(level: 'error' | 'warn', args: unknown[]) {
  const msg = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')
    .slice(0, MAX_MSG_LENGTH);
  if (logBuffer.length >= MAX_LOGS) logBuffer.shift();
  logBuffer.push({ ts: Date.now(), level, msg });
}

export function getConsoleLogs(): CapturedLog[] {
  return [...logBuffer];
}

export function clearConsoleLogs() {
  logBuffer.length = 0;
}

export function ConsoleLogCapture() {
  useEffect(() => {
    console.error = (...args: unknown[]) => {
      push('error', args);
      originalError?.(...args);
    };
    console.warn = (...args: unknown[]) => {
      push('warn', args);
      originalWarn?.(...args);
    };
    return () => {
      if (originalError) console.error = originalError;
      if (originalWarn) console.warn = originalWarn;
    };
  }, []);

  return null;
}
```

**Step 2: Verify TypeScript**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "console-log-capture" | head -5
```
Expected: no output (no errors)

**Step 3: Commit**

```bash
git add src/components/feedback/console-log-capture.tsx
git commit -m "feat(feedback): add console log ring buffer capture"
```

---

## Task 3: Feedback widget UI

**Files:**
- Create: `src/components/feedback/feedback-widget.tsx`

**What it does:** Floating button (fixed, bottom-right). Opens a Dialog. On open: runs html2canvas to capture the DOM. Shows type toggle (Bug / Feature / Feedback), description textarea, screenshot preview with retake button, collapsible console log list. Calls `trpc.feedback.createReport.useMutation()` on submit.

**Step 1: Create the file**

```tsx
// src/components/feedback/feedback-widget.tsx
'use client';

import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { MessageSquare, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';
import { getConsoleLogs, type CapturedLog } from './console-log-capture';

type ReportType = 'bug' | 'feature' | 'feedback';

const TYPE_LABELS: Record<ReportType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  feedback: 'Feedback',
};

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReportType>('bug');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [logs, setLogs] = useState<CapturedLog[]>([]);
  const [logsVisible, setLogsVisible] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const createReport = trpc.feedback.createReport.useMutation({
    onSuccess: () => {
      setOpen(false);
      setDescription('');
      setScreenshot(null);
      setLogsVisible(false);
    },
  });

  async function captureScreen() {
    setCapturing(true);
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        scale: 0.5,
        ignoreElements: (el) => el === dialogRef.current,
      });
      setScreenshot(canvas.toDataURL('image/png'));
    } finally {
      setCapturing(false);
    }
  }

  function handleOpen() {
    setLogs(getConsoleLogs());
    setOpen(true);
    // Capture after dialog renders (next tick)
    setTimeout(captureScreen, 100);
  }

  function handleSubmit() {
    if (!description.trim() || description.trim().length < 10) return;
    createReport.mutate({
      type,
      description: description.trim(),
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      screenshotBase64: screenshot ?? '',
      consoleLogs: logs,
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Report feedback"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Feedback
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent ref={dialogRef} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report an issue</DialogTitle>
          </DialogHeader>

          {/* Type toggle */}
          <div className="flex gap-1">
            {(Object.keys(TYPE_LABELS) as ReportType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  type === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Description */}
          <Textarea
            placeholder="Describe what happened or what you'd like..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[80px] resize-none text-sm"
          />

          {/* Screenshot preview */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Screenshot</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={captureScreen}
                disabled={capturing}
              >
                <RefreshCw className={`mr-1 h-3 w-3 ${capturing ? 'animate-spin' : ''}`} />
                Retake
              </Button>
            </div>
            {screenshot ? (
              <img
                src={screenshot}
                alt="App screenshot"
                className="w-full rounded border border-border object-cover"
                style={{ maxHeight: 120 }}
              />
            ) : (
              <div className="flex h-20 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
                {capturing ? 'Capturing...' : 'No screenshot'}
              </div>
            )}
          </div>

          {/* Console logs */}
          {logs.length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setLogsVisible((v) => !v)}
                className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
              >
                <span>Console logs ({logs.length} captured)</span>
                {logsVisible ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {logsVisible && (
                <div className="max-h-32 overflow-y-auto rounded bg-muted p-2 font-mono text-[10px] space-y-0.5">
                  {logs.map((l, i) => (
                    <div key={i} className={l.level === 'error' ? 'text-destructive' : 'text-yellow-500'}>
                      [{new Date(l.ts).toLocaleTimeString()}] {l.level.toUpperCase()}: {l.msg}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={description.trim().length < 10 || createReport.isPending}
            >
              {createReport.isPending ? 'Sending...' : 'Submit'}
            </Button>
          </div>

          {createReport.isError && (
            <p className="text-xs text-destructive">
              Failed to submit. Please try again.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Step 2: Verify TypeScript**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "feedback-widget" | head -10
```
Expected: no output

**Step 3: Commit**

```bash
git add src/components/feedback/feedback-widget.tsx
git commit -m "feat(feedback): add feedback overlay widget with screenshot capture"
```

---

## Task 4: Mount widget in AppShell

**Files:**
- Modify: `src/app/(app)/app-shell.tsx`

**Step 1: Edit AppShell to mount both components**

In `src/app/(app)/app-shell.tsx`, add the two imports after existing imports:

```tsx
import { ConsoleLogCapture } from '@/components/feedback/console-log-capture';
import { FeedbackWidget } from '@/components/feedback/feedback-widget';
```

Then inside the returned JSX, add both components just before the closing `</OnboardingCheck>` tag:

```tsx
      <ConsoleLogCapture />
      <FeedbackWidget />
    </OnboardingCheck>
```

Full updated return for reference:
```tsx
return (
  <OnboardingCheck>
    <NavigationProgress />
    <div className="app-ambient-glow" />
    <div className="flex h-screen overflow-hidden app-grain app-vignette">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="glass-shell flex h-14 items-center justify-between border-b border-border px-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="glass-shell w-60 p-0 border-r border-border">
              <div className="flex h-16 items-center px-4 border-b border-border">
                <span className="font-display text-lg font-bold text-foreground">QuiverDM</span>
              </div>
              <MobileSidebar />
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
          <UserMenu />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
    <ConsoleLogCapture />
    <FeedbackWidget />
  </OnboardingCheck>
);
```

**Step 2: Verify TypeScript**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "app-shell" | head -5
```
Expected: no output

**Step 3: Quick smoke test**

```bash
cd E:/Projects/QuiverDM && npm run dev
```
Open http://localhost:3847, log in, verify "Feedback" button appears bottom-right. Click it — dialog should open with a screenshot. Do not submit yet (backend not wired).

**Step 4: Commit**

```bash
git add src/app/\(app\)/app-shell.tsx
git commit -m "feat(feedback): mount console capture and feedback widget in AppShell"
```

---

## Task 5: Add `createReport` tRPC mutation

**Files:**
- Modify: `src/server/routers/feedback.ts`

**Step 1: Add the new mutation to the router**

Add this import at the top of `src/server/routers/feedback.ts` (after existing imports):

```ts
// No new imports needed — feedbackService already imported
```

Add this new procedure inside the `router({...})` call, after the existing `updateStatus` procedure:

```ts
  /**
   * Submit a rich report from the feedback overlay
   * Captures screenshot, console logs, page URL, user agent
   */
  createReport: protectedProcedure
    .input(
      z.object({
        type: z.enum(['bug', 'feature', 'feedback']),
        description: z.string().min(10).max(5000),
        pageUrl: z.string().url(),
        userAgent: z.string().max(500),
        screenshotBase64: z.string().max(5_000_000), // ~3.5MB PNG
        consoleLogs: z
          .array(
            z.object({
              ts: z.number(),
              level: z.string(),
              msg: z.string().max(500),
            })
          )
          .max(50),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return feedbackService.createReport(ctx.session.user.id, ctx.session.user.email ?? '', input);
    }),
```

**Step 2: Verify TypeScript**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "feedback" | head -10
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/server/routers/feedback.ts
git commit -m "feat(feedback): add createReport tRPC mutation"
```

---

## Task 6: Implement `createReport` in feedback service

**Files:**
- Modify: `src/server/services/feedback.service.ts`

This is the core server logic. It:
1. Saves to DB
2. Uploads screenshot to Discord CDN
3. Creates a Discord forum thread with report embed
4. Calls Claude for triage
5. Posts Claude analysis in the thread

**Step 1: Add the `createReport` method and helpers**

Add these methods to the `feedbackService` object in `src/server/services/feedback.service.ts`. Place them after `notifyNewFeedback`:

```ts
  /**
   * Full overlay report: saves to DB, posts Discord thread, posts Claude triage
   */
  async createReport(
    userId: string,
    userEmail: string,
    data: {
      type: 'bug' | 'feature' | 'feedback';
      description: string;
      pageUrl: string;
      userAgent: string;
      screenshotBase64: string;
      consoleLogs: { ts: number; level: string; msg: string }[];
    }
  ) {
    // Map overlay type to existing DB enum
    const dbType = data.type === 'feedback' ? 'improvement' : data.type;

    const feedback = await prisma.feedback.create({
      data: {
        userId,
        type: dbType,
        title: `[${data.type.toUpperCase()}] ${data.pageUrl}`,
        description: data.description,
        metadata: {
          pageUrl: data.pageUrl,
          userAgent: data.userAgent,
          consoleLogs: data.consoleLogs,
          source: 'overlay',
        },
      },
    });

    // Fire-and-forget Discord + Claude (don't block the user)
    void this.postDiscordThread(feedback, userEmail, data);

    return { id: feedback.id };
  },

  /**
   * Post report to Discord forum channel as a thread, then post Claude triage
   */
  async postDiscordThread(
    feedback: { id: string; type: string; description: string },
    userEmail: string,
    data: {
      type: string;
      pageUrl: string;
      userAgent: string;
      screenshotBase64: string;
      consoleLogs: { ts: number; level: string; msg: string }[];
    }
  ) {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_FEEDBACK_CHANNEL_ID;
    if (!botToken || !channelId) return;

    const typeColors: Record<string, number> = {
      bug: 0xff4444,
      feature: 0x5865f2,
      feedback: 0x00c853,
    };

    const color = typeColors[data.type] ?? 0x888888;

    try {
      // 1. Upload screenshot to Discord CDN (if present)
      let screenshotUrl: string | null = null;
      if (data.screenshotBase64 && data.screenshotBase64.length > 100) {
        screenshotUrl = await this.uploadScreenshotToDiscord(
          botToken,
          channelId,
          data.screenshotBase64
        );
      }

      // 2. Create forum thread (POST /channels/{id}/threads creates a forum post)
      const threadTitle = `[${data.type.toUpperCase()}] ${new URL(data.pageUrl).pathname} — ${new Date().toLocaleDateString()}`;

      const threadBody: Record<string, unknown> = {
        name: threadTitle.slice(0, 100),
        message: {
          embeds: [
            {
              title: `${data.type.charAt(0).toUpperCase() + data.type.slice(1)} Report`,
              description: feedback.description,
              color,
              fields: [
                { name: 'Page', value: data.pageUrl, inline: false },
                { name: 'User', value: userEmail, inline: true },
                { name: 'Feedback ID', value: feedback.id, inline: true },
                {
                  name: 'Console logs',
                  value: data.consoleLogs.length > 0 ? `${data.consoleLogs.length} captured` : 'None',
                  inline: true,
                },
              ],
              timestamp: new Date().toISOString(),
              ...(screenshotUrl ? { image: { url: screenshotUrl } } : {}),
            },
          ],
        },
      };

      const threadRes = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/threads`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(threadBody),
        }
      );

      if (!threadRes.ok) {
        console.error('[Feedback] Discord thread creation failed:', await threadRes.text());
        return;
      }

      const thread = (await threadRes.json()) as { id: string };

      // 3. Post top console logs as a code block message in the thread
      if (data.consoleLogs.length > 0) {
        const logText = data.consoleLogs
          .slice(-20)
          .map((l) => `[${new Date(l.ts).toISOString()}] ${l.level.toUpperCase()}: ${l.msg}`)
          .join('\n');

        await fetch(`https://discord.com/api/v10/channels/${thread.id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: `\`\`\`\n${logText.slice(0, 1900)}\n\`\`\``,
          }),
        });
      }

      // 4. Get Claude triage and post in thread
      const triage = await this.triageWithClaude(data.type, feedback.description, data.pageUrl, data.consoleLogs);
      if (triage) {
        const severityColors: Record<string, number> = {
          critical: 0xff0000,
          high: 0xff8c00,
          medium: 0xffd700,
          low: 0x00c853,
        };
        await fetch(`https://discord.com/api/v10/channels/${thread.id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            embeds: [
              {
                title: `Claude Triage — ${triage.severity?.toUpperCase() ?? 'UNKNOWN'} severity`,
                color: severityColors[triage.severity ?? 'medium'] ?? 0xffd700,
                fields: [
                  { name: 'Likely cause', value: triage.likely_cause ?? 'Unknown', inline: false },
                  {
                    name: 'Affected files',
                    value: (triage.affected_files ?? []).join('\n') || 'Unknown',
                    inline: true,
                  },
                  { name: 'Suggested fix', value: triage.suggested_fix ?? 'See description', inline: false },
                  ...(triage.reproduction_steps
                    ? [{ name: 'Reproduction', value: triage.reproduction_steps, inline: false }]
                    : []),
                ],
                footer: { text: 'Powered by Claude haiku' },
              },
            ],
          }),
        });
      }
    } catch (err) {
      console.error('[Feedback] Discord post failed:', err);
    }
  },

  /**
   * Upload a base64 PNG to Discord CDN via the channel's message attachment endpoint
   * Returns the CDN URL or null on failure
   */
  async uploadScreenshotToDiscord(
    botToken: string,
    channelId: string,
    base64: string
  ): Promise<string | null> {
    try {
      // Strip data URL prefix if present
      const raw = base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(raw, 'base64');

      const form = new FormData();
      form.append(
        'file',
        new Blob([buffer], { type: 'image/png' }),
        'screenshot.png'
      );
      // Attach a dummy message so Discord accepts the upload
      form.append('payload_json', JSON.stringify({ content: '' }));

      // We upload to a temporary channel message to get CDN URL, then we reference it
      // Actually, simpler: use the thread message attachment flow directly
      // Here we upload to the channel itself and get back the attachment URL
      const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bot ${botToken}` },
        body: form,
      });

      if (!res.ok) return null;
      const data = (await res.json()) as { attachments?: { url: string }[] };
      return data.attachments?.[0]?.url ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Call Claude haiku to triage a bug report
   * Returns structured JSON or null on failure
   */
  async triageWithClaude(
    type: string,
    description: string,
    pageUrl: string,
    consoleLogs: { ts: number; level: string; msg: string }[]
  ): Promise<{
    severity: string;
    likely_cause: string;
    affected_files: string[];
    suggested_fix: string;
    reproduction_steps?: string;
  } | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    try {
      const { Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const logSummary = consoleLogs
        .slice(-20)
        .map((l) => `${l.level.toUpperCase()}: ${l.msg}`)
        .join('\n');

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system:
          'You are a bug triage agent for QuiverDM, an AI-powered D&D session management web app built with Next.js 15, tRPC, Prisma, and PostgreSQL. Analyze the report and respond with JSON ONLY — no markdown, no explanation.',
        messages: [
          {
            role: 'user',
            content: `Type: ${type}
Page: ${pageUrl}
Description: ${description}

Console logs (last 20):
${logSummary || 'None'}

Respond with this JSON schema:
{
  "severity": "low" | "medium" | "high" | "critical",
  "likely_cause": "1-2 sentence explanation",
  "affected_files": ["array of likely source file paths"],
  "suggested_fix": "concrete action to fix this",
  "reproduction_steps": "optional steps to reproduce"
}`,
          },
        ],
      });

      const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
      return JSON.parse(text);
    } catch (err) {
      console.error('[Feedback] Claude triage failed:', err);
      return null;
    }
  },
```

**Step 2: Verify TypeScript**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "feedback.service" | head -10
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/server/services/feedback.service.ts
git commit -m "feat(feedback): implement Discord thread posting and Claude triage in feedback service"
```

---

## Task 7: Update .env and .env.example

**Files:**
- Modify: `.env` (local — not committed)
- Modify: `.env.example` (committed)

**Step 1: Add env vars to .env**

Open `.env` and add:

```env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_FEEDBACK_CHANNEL_ID=your_forum_channel_id_here
```

(Replace with real values from the Discord bot setup pre-flight step)

**Step 2: Add to .env.example**

```bash
cd E:/Projects/QuiverDM
grep -n "DISCORD" .env.example | head -5
```

Find the Discord section and add:
```env
DISCORD_BOT_TOKEN=
DISCORD_FEEDBACK_CHANNEL_ID=
```

**Step 3: Add to Vercel production env vars**

```bash
# Run these with real values:
vercel env add DISCORD_BOT_TOKEN production
vercel env add DISCORD_FEEDBACK_CHANNEL_ID production
```

Or add via Vercel dashboard → Project Settings → Environment Variables.

**Step 4: Commit .env.example**

```bash
git add .env.example
git commit -m "chore: add DISCORD_BOT_TOKEN and DISCORD_FEEDBACK_CHANNEL_ID env vars"
```

---

## Task 8: End-to-end smoke test

**Step 1: Start dev server**

```bash
cd E:/Projects/QuiverDM && npm run dev
```

**Step 2: Test the full flow**

1. Open http://localhost:3847, sign in
2. Click "Feedback" button (bottom-right)
3. Select "Bug", type a description (at least 10 chars)
4. Verify screenshot preview appears
5. Open browser devtools → Console → type `console.warn('test log')` → check it appears in dialog
6. Click Submit
7. Verify dialog closes without error
8. Check Discord server → `#feedback-reports` forum channel → new thread should appear
9. Thread should have: report embed with screenshot + console log code block + Claude triage embed

**Step 3: Check DB**

```bash
cd E:/Projects/QuiverDM && npm run db:studio
```
Open Feedback table → verify new row with `source: 'overlay'` in metadata.

**Step 4: Check TypeScript one final time**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit
```
Expected: 0 errors

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(feedback): complete feedback overlay with Discord threads and Claude triage"
```

---

## Notes

- The `uploadScreenshotToDiscord` method posts the screenshot as a channel message first, then references the CDN URL in the thread. This is the simplest approach without file upload APIs. If the forum channel doesn't allow direct messages this way, fallback: omit screenshot from embed and attach it differently.
- `html2canvas` ignores the feedback dialog itself via `ignoreElements` to avoid capturing the dialog in the screenshot.
- The old `DISCORD_FEEDBACK_WEBHOOK_URL` env var and `notifyNewFeedback` method remain — they're harmless and removing them is optional cleanup later.
- Claude haiku is ~$0.001 per call. With alpha traffic this is negligible.
- The `screenshotBase64` input allows up to 5MB. At 0.5x scale, html2canvas output is typically 100-300kb.
