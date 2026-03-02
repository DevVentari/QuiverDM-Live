# Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add PostHog analytics to QuiverDM — autocapture for page views/clicks, user identification tied to NextAuth session, 6 typed conversion events, and a React error boundary for client-side error capture.

**Architecture:** `posthog-js` in the browser (autocapture + user identification + error boundary); `posthog-node` in tRPC mutations (server-side conversion events). A single typed `analytics.ts` helper prevents raw event name strings. Page views fired manually via a `PostHogPageView` component (required for App Router).

**Tech Stack:** `posthog-js`, `posthog-node`, Next.js 15 App Router, NextAuth v5, tRPC v11, Vitest

---

## Context

**Key files:**
- `src/app/providers.tsx` — add PostHogProvider, posthog.init, user identification
- `src/app/layout.tsx` — add ErrorBoundary + PostHogPageView (in Suspense)
- `src/server/routers/campaigns.ts:64` — `create` mutation
- `src/server/routers/homebrew.ts:34` — `createContent` mutation
- `src/server/routers/onboarding.ts:45,52` — `completeFirstCampaign` + `skip`
- `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx` — cockpit mount
- `src/hooks/useLiveTranscription.ts:103` — `start()` function
- `src/app/api/homebrew/upload-pdf/route.ts` — PDF upload success path
- `docs/obsidian-vault/00-System/services-billing.md` — update PostHog entry after signup

**Test location:** `tests/lib/` (matches vitest config: `include: ['tests/**/*.test.ts']`)

**Env vars to add:**
```env
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

**Before starting:** Sign up at https://posthog.com → create project → select EU region → copy Project API Key.

---

## Task 1: Install packages and add env vars

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.env.local`

**Step 1: Install PostHog packages**

```bash
cd /e/Projects/QuiverDM
npm install posthog-js posthog-node
```

Expected: both packages added to `dependencies` in `package.json`.

**Step 2: Add env vars to `.env.local`**

Add these two lines:
```env
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

Get the key from: PostHog dashboard → Project Settings → Project API Key.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add posthog-js and posthog-node"
```

---

## Task 2: Typed analytics helpers

**Files:**
- Create: `src/lib/analytics.ts` (client-side wrapper)
- Create: `src/lib/analytics.server.ts` (server-side wrapper)
- Create: `tests/lib/analytics.test.ts`
- Create: `tests/lib/analytics.server.test.ts`

### 2a: Client-side analytics helper

**Step 1: Write failing test**

```typescript
// tests/lib/analytics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCapture = vi.fn();
const mockCaptureException = vi.fn();

vi.mock('posthog-js', () => ({
  default: {
    capture: mockCapture,
    captureException: mockCaptureException,
  },
}));

// Import AFTER mock
const { track, EVENTS } = await import('@/lib/analytics');

describe('analytics', () => {
  beforeEach(() => {
    mockCapture.mockClear();
    mockCaptureException.mockClear();
  });

  it('track calls posthog.capture with event name and properties', () => {
    track(EVENTS.CAMPAIGN_CREATED, { campaign_id: 'abc' });
    expect(mockCapture).toHaveBeenCalledWith('campaign_created', { campaign_id: 'abc' });
  });

  it('track works without properties', () => {
    track(EVENTS.ONBOARDING_COMPLETED);
    expect(mockCapture).toHaveBeenCalledWith('onboarding_completed', undefined);
  });

  it('EVENTS contains all 6 tracked event names', () => {
    expect(EVENTS.CAMPAIGN_CREATED).toBe('campaign_created');
    expect(EVENTS.SESSION_STARTED).toBe('session_started');
    expect(EVENTS.PDF_UPLOADED).toBe('pdf_uploaded');
    expect(EVENTS.TRANSCRIPTION_STARTED).toBe('transcription_started');
    expect(EVENTS.HOMEBREW_CREATED).toBe('homebrew_created');
    expect(EVENTS.ONBOARDING_COMPLETED).toBe('onboarding_completed');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /e/Projects/QuiverDM
npm test -- tests/lib/analytics.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/analytics'`

**Step 3: Implement `src/lib/analytics.ts`**

```typescript
'use client';

import posthog from 'posthog-js';

export const EVENTS = {
  CAMPAIGN_CREATED: 'campaign_created',
  SESSION_STARTED: 'session_started',
  PDF_UPLOADED: 'pdf_uploaded',
  TRANSCRIPTION_STARTED: 'transcription_started',
  HOMEBREW_CREATED: 'homebrew_created',
  ONBOARDING_COMPLETED: 'onboarding_completed',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export function track(event: EventName, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- tests/lib/analytics.test.ts
```

Expected: 3/3 PASS

### 2b: Server-side analytics helper

**Step 5: Write failing test**

```typescript
// tests/lib/analytics.server.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCapture = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: mockCapture,
    shutdown: mockShutdown,
  })),
}));

const { serverTrack } = await import('@/lib/analytics.server');

describe('serverTrack', () => {
  beforeEach(() => {
    mockCapture.mockClear();
    mockShutdown.mockClear();
  });

  it('calls posthog.capture with userId, event, and properties', async () => {
    await serverTrack('user-123', 'campaign_created', { campaign_id: 'abc' });
    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: 'user-123',
      event: 'campaign_created',
      properties: { campaign_id: 'abc' },
    });
  });

  it('calls shutdown after capture', async () => {
    await serverTrack('user-123', 'campaign_created');
    expect(mockShutdown).toHaveBeenCalled();
  });

  it('works without properties', async () => {
    await serverTrack('user-456', 'onboarding_completed');
    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: 'user-456',
      event: 'onboarding_completed',
      properties: undefined,
    });
  });
});
```

**Step 6: Run test to verify it fails**

```bash
npm test -- tests/lib/analytics.server.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/analytics.server'`

**Step 7: Implement `src/lib/analytics.server.ts`**

```typescript
import { PostHog } from 'posthog-node';

export async function serverTrack(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  client.capture({ distinctId: userId, event, properties });
  await client.shutdown();
}
```

**Step 8: Run all analytics tests**

```bash
npm test -- tests/lib/analytics.test.ts tests/lib/analytics.server.test.ts
```

Expected: 6/6 PASS

**Step 9: Commit**

```bash
git add src/lib/analytics.ts src/lib/analytics.server.ts \
  tests/lib/analytics.test.ts tests/lib/analytics.server.test.ts
git commit -m "feat(analytics): typed track helpers — client (posthog-js) and server (posthog-node)"
```

---

## Task 3: PostHog provider, page view tracker, user identification

**Files:**
- Modify: `src/app/providers.tsx`
- Create: `src/components/analytics/posthog-page-view.tsx`
- Modify: `src/app/layout.tsx`

No unit tests for these — they are wiring/provider code tested via the running app.

**Step 1: Read `src/app/providers.tsx` before editing**

(Required — read the file first to understand current imports and structure.)

**Step 2: Create `src/components/analytics/posthog-page-view.tsx`**

```tsx
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useEffect } from 'react';

export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.location.origin + pathname;
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`;
      }
      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}
```

**Step 3: Update `src/app/providers.tsx`**

Add posthog init (before the component), PostHogProvider wrapper, user identification component, and unhandledrejection listener. Replace the entire file:

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useSession, SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import superjson from 'superjson';
import { Toaster } from '@/components/ui/sonner';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
  });
}

function PostHogUserIdentifier() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;
    if (session?.user?.id) {
      posthog.identify(session.user.id, {
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      });
    } else {
      posthog.reset();
    }
  }, [session, status]);

  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      posthog.captureException(e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  }));
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <PostHogProvider client={posthog}>
      <SessionProvider>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem={false}
              disableTransitionOnChange
            >
              <PostHogUserIdentifier />
              {children}
              <Toaster />
            </ThemeProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </SessionProvider>
    </PostHogProvider>
  );
}
```

**Step 4: Update `src/app/layout.tsx` to add PostHogPageView**

`useSearchParams()` requires a Suspense boundary. Add the import and wrap PostHogPageView in Suspense inside the body. Replace the return statement:

```tsx
import { Suspense } from 'react';
import { PostHogPageView } from '@/components/analytics/posthog-page-view';

// Inside RootLayout's return, add PostHogPageView inside Providers:
return (
  <html lang="en" className={`${bricolage.variable} ${cinzel.variable}`} suppressHydrationWarning>
    <body className="min-h-screen bg-background font-sans antialiased">
      <Providers>
        <Suspense fallback={null}>
          <PostHogPageView />
        </Suspense>
        {children}
      </Providers>
    </body>
  </html>
);
```

**Step 5: Verify TypeScript**

```bash
cd /e/Projects/QuiverDM
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors (or pre-existing errors only — none in the new files).

**Step 6: Commit**

```bash
git add src/app/providers.tsx src/app/layout.tsx \
  src/components/analytics/posthog-page-view.tsx
git commit -m "feat(analytics): PostHog provider, page view tracker, user identification"
```

---

## Task 4: React error boundary

**Files:**
- Create: `src/components/analytics/error-boundary.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create `src/components/analytics/error-boundary.tsx`**

```tsx
'use client';

import { Component, ReactNode, ErrorInfo } from 'react';
import posthog from 'posthog-js';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AnalyticsErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    posthog.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
```

**Step 2: Wrap app body in `src/app/layout.tsx`**

Add import and wrap `{children}` with the error boundary:

```tsx
import { AnalyticsErrorBoundary } from '@/components/analytics/error-boundary';

// In RootLayout return:
<Providers>
  <Suspense fallback={null}>
    <PostHogPageView />
  </Suspense>
  <AnalyticsErrorBoundary>
    {children}
  </AnalyticsErrorBoundary>
</Providers>
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors in new files.

**Step 4: Commit**

```bash
git add src/components/analytics/error-boundary.tsx src/app/layout.tsx
git commit -m "feat(analytics): React error boundary — captures unhandled render errors to PostHog"
```

---

## Task 5: Server-side conversion events in tRPC routers

**Files:**
- Modify: `src/server/routers/campaigns.ts`
- Modify: `src/server/routers/homebrew.ts`
- Modify: `src/server/routers/onboarding.ts`

For each router, add `import { serverTrack } from '@/lib/analytics.server'` and fire the event after the service call resolves. Use `void` (fire-and-forget) — never `await` in a router to avoid adding latency.

**Step 1: Read all three routers before editing**

Read:
- `src/server/routers/campaigns.ts`
- `src/server/routers/homebrew.ts`
- `src/server/routers/onboarding.ts`

**Step 2: Update `campaigns.ts` — `create` mutation**

Find the `create` mutation (line ~64). Convert the arrow function body to add tracking:

```typescript
create: protectedProcedure
  .input(CreateCampaignSchema)
  .mutation(async ({ input, ctx }) => {
    const campaign = await campaignService.create(ctx.session.user.id, input);
    void serverTrack(ctx.session.user.id, 'campaign_created', { campaign_id: campaign.id });
    return campaign;
  }),
```

**Step 3: Update `homebrew.ts` — `createContent` mutation**

Find the `createContent` mutation (line ~34). Add tracking after the service call:

```typescript
createContent: protectedProcedure
  // ... existing .input(...)
  .mutation(async ({ input, ctx }) => {
    const content = await homebrewService.createContent(ctx.session.user.id, { ...input, data: input.data ?? {} });
    void serverTrack(ctx.session.user.id, 'homebrew_created', { source: input.sourceType ?? 'manual' });
    return content;
  }),
```

**Step 4: Update `onboarding.ts` — `completeFirstCampaign` and `skip`**

```typescript
completeFirstCampaign: protectedProcedure.mutation(async ({ ctx }) => {
  const result = await onboardingService.completeFirstCampaign(ctx.session.user.id);
  void serverTrack(ctx.session.user.id, 'onboarding_completed');
  return result;
}),

skip: protectedProcedure.mutation(async ({ ctx }) => {
  const result = await onboardingService.skip(ctx.session.user.id);
  void serverTrack(ctx.session.user.id, 'onboarding_completed');
  return result;
}),
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors in modified files.

**Step 6: Commit**

```bash
git add src/server/routers/campaigns.ts src/server/routers/homebrew.ts \
  src/server/routers/onboarding.ts
git commit -m "feat(analytics): server-side conversion events — campaign_created, homebrew_created, onboarding_completed"
```

---

## Task 6: Client-side events

**Files:**
- Modify: `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx`
- Modify: `src/hooks/useLiveTranscription.ts`
- Modify: `src/app/api/homebrew/upload-pdf/route.ts`

**Step 1: Read all three files before editing**

**Step 2: `session_started` — cockpit page**

In `src/app/(session)/campaigns/[slug]/sessions/[sessionId]/live/page.tsx`, add a `useEffect` that fires once on mount:

```typescript
import { track, EVENTS } from '@/lib/analytics';

// Inside SessionCockpitPage(), after existing useEffect hooks:
useEffect(() => {
  track(EVENTS.SESSION_STARTED, { session_id: sessionId });
}, [sessionId]);
```

**Step 3: `transcription_started` — useLiveTranscription hook**

In `src/hooks/useLiveTranscription.ts`, inside the `start` callback (around line 103), add the track call right after the transcription successfully starts (after the WebSocket `start_live` message is sent, around line 144):

```typescript
import { track, EVENTS } from '@/lib/analytics';

// Inside the start callback, after the successful startMutation.mutateAsync call:
track(EVENTS.TRANSCRIPTION_STARTED, { session_id: sessionId });
```

**Step 4: `pdf_uploaded` — upload route**

In `src/app/api/homebrew/upload-pdf/route.ts`, find where `addPDFProcessingJob` is called successfully and add the server-side event. Read the file first to find the exact location.

Add after the job is queued successfully:
```typescript
import { serverTrack } from '@/lib/analytics.server';

// After addPDFProcessingJob succeeds:
void serverTrack(session.user.id, 'pdf_uploaded', {
  file_size_kb: Math.round(file.size / 1024),
});
```

**Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors in modified files.

**Step 6: Commit**

```bash
git add src/app/\(session\)/campaigns/\[slug\]/sessions/\[sessionId\]/live/page.tsx \
  src/hooks/useLiveTranscription.ts \
  src/app/api/homebrew/upload-pdf/route.ts
git commit -m "feat(analytics): client-side events — session_started, transcription_started, pdf_uploaded"
```

---

## Task 7: Update services register + run full test suite

**Files:**
- Modify: `docs/obsidian-vault/00-System/services-billing.md`

**Step 1: Fill in PostHog entry in services-billing.md**

Find the `### PostHog` section (under Analytics) and update with real account details:

```markdown
### PostHog
- **Purpose:** Product analytics — autocapture, funnels, session replay, error tracking
- **Plan:** Free tier
- **Free tier limits:** 1M events/mo, 5k session recordings/mo
- **Account:** [your PostHog login email]
- **Dashboard:** https://eu.posthog.com/project/[your-project-id]
- **Env vars:** NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST
- **Notes:** EU region. Autocapture enabled. Page views fired manually via PostHogPageView component.
```

**Step 2: Run full test suite**

```bash
cd /e/Projects/QuiverDM
npm test
```

Expected: all tests pass (existing + new analytics tests).

**Step 3: Verify dev server starts cleanly**

```bash
npm run dev
```

Navigate to http://localhost:3847 and open the browser console — should see no PostHog errors. Open PostHog dashboard → Live Events — should see `$pageview` events appearing.

**Step 4: Commit**

```bash
git add docs/obsidian-vault/00-System/services-billing.md
git commit -m "docs: update services register with PostHog account details"
```

---
