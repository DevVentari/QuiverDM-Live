# Usage Caps & Cost Guardrails — Design

**Date:** 2026-02-26
**Status:** approved

---

## Problem

The usage service (`usage.service.ts`) has complete cap checking and increment logic for all 7 limit families, but enforcement is only wired in 4 of 7 places:

| Limit | Enforced? | Where |
|---|---|---|
| Campaigns | ✅ | `campaign.service.ts` |
| AI recaps | ✅ | `session.service.ts` |
| Image generations | ✅ | `homebrew-image.ts` |
| Semantic searches | ✅ | `search.ts` |
| PDF uploads | ❌ | Missing in `homebrew-pdf.ts` |
| Session uploads | ❌ | Missing in `session-recordings.ts` |
| Transcription | ❌ | Missing in transcription worker/service |

There is also no user-facing UI showing how much of each limit they've consumed, and no alerting when users approach their limits.

---

## Design

### Part 1: Wire missing enforcement

Three routers/services need `incrementX` calls added:

1. `homebrewPdf.ts` → `usageService.incrementPdfUploads(userId)` in `createPDF` procedure before creating the DB record
2. `session-recordings.ts` → `usageService.incrementSessionUploads(userId)` in the `create` procedure before creating the DB record
3. Transcription worker → `usageService.incrementTranscription(userId, durationSeconds)` after successful transcription completes

All three use the existing "check + throw RateLimitedError" pattern already in `incrementX` methods.

### Part 2: Admin cost-alert emails

Add a `checkAndAlertThreshold` helper to `usage.service.ts`:

- Called (fire-and-forget) from every `incrementX` method when the new usage crosses 80% of the limit
- Sends an admin email via `src/lib/email.ts` (Resend) to all `ADMIN_EMAILS`
- Email contains: user ID, tier, limit family, current usage, limit, period end
- Skips if limit is -1 (unlimited)
- Never throws (fire-and-forget)

No per-user cost dollar tracking in MVP — threshold % is enough signal.

### Part 3: User usage dashboard

New page at `src/app/(app)/settings/usage/page.tsx`:

- Shows tier badge with upgrade CTA if free/pro
- Progress bars for all 7 limit families (color: green < 60%, yellow 60-80%, red > 80%)
- Period reset date: "Resets in X days"
- Powered by `trpc.usage.getStatus.useQuery()`
- Link from account/settings sidebar nav

---

## Non-goals

- Per-request cost dollar tracking in DB
- Per-user budget cap (separate billing feature)
- Live spend dashboards
- Blocking free trial without card (separate billing feature)
