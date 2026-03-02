# Analytics Design

**Goal:** Auto-capture product analytics, user funnels, and client-side errors via PostHog Cloud with zero manual instrumentation for page views and clicks.

**Architecture:** PostHog JS SDK (autocapture) in the browser + PostHog Node SDK for server-side conversion events in tRPC mutations. User identity tied to NextAuth session. React error boundary + unhandledrejection listener for error capture.

**Tech Stack:** `posthog-js`, `posthog-node`, Next.js App Router, NextAuth v5, tRPC v11

---

## Architecture

Single PostHog project (EU region). Two SDKs:

- `posthog-js` — browser autocapture (clicks, form submits, page views, session replay, error capture)
- `posthog-node` — server-side events from tRPC mutations (campaign_created, homebrew_created, etc.)

Integration points:
- `src/app/providers.tsx` — PostHogProvider wraps app; user identification on session load; unhandledrejection listener
- `src/components/analytics/posthog-page-view.tsx` — fires page views on App Router route changes (required — App Router doesn't trigger full reloads)
- `src/components/analytics/error-boundary.tsx` — React error boundary calling posthog.captureException()
- `src/lib/analytics.ts` — typed track() helper; server-side posthog-node client

---

## User Identification

On NextAuth session load (client-side):
```ts
posthog.identify(user.id, { email: user.email, name: user.name })
```

On sign-out:
```ts
posthog.reset()
```

Ties all autocaptured events to a real user. Enables per-user session history in PostHog dashboard.

---

## Key Manual Events

All routed through `analytics.track()` — no raw strings in call sites.

| Event | Trigger | Properties |
|---|---|---|
| `campaign_created` | campaigns router, after insert | `{ campaign_id }` |
| `session_started` | cockpit page mount | `{ campaign_id, session_id }` |
| `pdf_uploaded` | homebrew PDF upload route | `{ file_size_kb }` |
| `transcription_started` | useLiveTranscription hook | `{ session_id }` |
| `homebrew_created` | homebrew router, after insert | `{ source: 'pdf' | 'manual' | 'dndbeyond' }` |
| `onboarding_completed` | onboarding router, final step | — |

Server-side events (tRPC) use posthog-node with `posthog.capture({ distinctId: userId, event, properties })`.
Client-side events use `posthog.capture(event, properties)` via the track() helper.

---

## Error Tracking

**React error boundary** (`src/components/analytics/error-boundary.tsx`):
- Wraps app body in root layout
- `componentDidCatch` calls `posthog.captureException(error, { componentStack })`

**Unhandled promise rejections** (in PostHog provider):
```ts
window.addEventListener('unhandledrejection', (e) => {
  posthog.captureException(e.reason)
})
```

Server-side tRPC errors not captured — PostHog error tracking is client-focused. Add Sentry later if server stack traces become necessary.

---

## Environment Variables

```env
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

Both `NEXT_PUBLIC_` so they're available in the browser bundle. The Node SDK reads the same key from `process.env.NEXT_PUBLIC_POSTHOG_KEY`.

---

## What's Excluded (YAGNI)

- No server-side page view tracking (client handles it)
- No tracking of campaign names, NPC names, or other user content (PII risk)
- No Sentry (add later if server error traces needed)
- No feature flags (PostHog supports it — add when needed)
- No A/B testing
