# Transcript Cleanup Worker — Design

**Date:** 2026-04-29
**Status:** Approved

## Overview

Port the standalone `scripts/cleanup-transcript.ts` pipeline into a BullMQ worker so it runs automatically after multi-track transcription. The cleanup pipeline (term corrections, utterance merging, filler drop, optional AI OOC filtering) currently runs as a manual CLI script. This design integrates it into the app as a background worker with a session hub UI for OOC review.

## Decisions

- **Corrections:** Hybrid — global D&D corrections stay as `docs/transcription-tools/corrections-global.json` (bundled in repo), campaign-specific corrections go in DB (`TranscriptCorrection` model)
- **OOC Review:** Review panel (Sheet) on the session hub with per-line keep/drop actions
- **Trigger:** Automatic `basic` pass fires after multi-track; DM manually triggers `ooc` pass from session hub
- **Architecture:** Single `transcript-cleanup` queue, single worker, `phase` discriminator in job data

## Data Model

### New model: `TranscriptCorrection`

```prisma
model TranscriptCorrection {
  id         String   @id @default(cuid())
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  wrong      String
  correct    String
  createdAt  DateTime @default(now())

  @@index([campaignId])
}
```

### `Transcript` additions

```prisma
cleanupStatus  String?  // pending | processing | complete | ooc_pending_review | failed
oocReviewItems Json?    // Array<{ index, speaker, text, start_formatted, classification, confidence, reason }>
```

## Queue & Worker

**File:** `src/lib/queue/transcript-cleanup-queue.ts`

```ts
interface TranscriptCleanupJobData {
  transcriptId: string;
  sessionId: string;
  campaignId: string;
  phase: 'basic' | 'ooc';
}
```

**File:** `src/lib/queue/transcript-cleanup-worker.ts`

### Phase: `basic` (auto-triggered)

1. Load `Transcript.timestamps` JSON (structured utterances from multi-track merge)
2. Load global corrections from `docs/transcription-tools/corrections-global.json`
3. Load campaign corrections from `TranscriptCorrection` DB rows
4. Apply term corrections (regex word-boundary replacement)
5. Trim pre-session noise (scan for session-start phrases, drop preceding lines)
6. Run merge passes (up to 10 forward+backward): merge utterances ≤4 words into adjacent same-speaker lines within 8s gap
7. Drop standalone filler words (yeah, uh, um, hmm, etc.)
8. Write `correctedText` (markdown formatted) + set `cleanupStatus = 'complete'`

### Phase: `ooc` (DM-triggered)

1. Read existing `correctedText` → parse back to utterances
2. Run AI OOC batches (GPT-4o-mini, 100 utterances/batch)
3. Auto-drop lines with `classification = 'ooc'` and `confidence ≥ 0.92`
4. Store uncertain lines (`classification = 'uncertain'` or `confidence < 0.92`) in `oocReviewItems`
5. Update `correctedText` with auto-drops applied + set `cleanupStatus = 'ooc_pending_review'`

**Trigger:** `multi-track-worker.ts` enqueues `basic` job after step 8 (broadcast complete), same pattern as `contextExtractionQueue`.

**npm script:** `worker:transcript-cleanup`

## Session Hub UI

### Transcript status badge

Shown on the transcript card within the session hub:

| `cleanupStatus` | Display |
|---|---|
| `pending` / `processing` | Spinner + "Cleaning transcript…" |
| `complete` | "Transcript ready" + "Run OOC filter" button |
| `ooc_pending_review` | Amber badge "N lines flagged" (opens review sheet) |
| `failed` | "Cleanup failed" + retry button |
| `null` | Not shown (single-track sessions, feature n/a) |

### OOC Review Sheet

Right-side drawer (`shadcn Sheet`), opened from the flagged badge:

- Header: "Review Flagged Lines — N uncertain"
- List of flagged utterances:
  - `[timestamp] Speaker: utterance text`
  - AI reason shown below in muted text
  - Two buttons per line: **Keep** / **Drop** (toggle, default Keep)
- Footer: "Confirm Review" button — applies decisions, closes sheet

### tRPC procedures

- `sessions.triggerOocCleanup({ sessionId })` — enqueues `ooc` phase job, sets `cleanupStatus = 'processing'`
- `sessions.confirmOocReview({ sessionId, drops: string[] })` — removes dropped utterances from `correctedText`, clears `oocReviewItems`, sets `cleanupStatus = 'complete'`

## Error Handling

- `basic` fails → `cleanupStatus = 'failed'`, non-fatal. Existing summary worker still fires from `rawText`.
- `ooc` fails → `cleanupStatus = 'complete'` (falls back to basic-cleaned text, review panel just doesn't appear).
- No `timestamps` JSON on Transcript (single-track upload) → `basic` job exits early, `cleanupStatus` stays `null`.
- Global corrections file missing → worker logs warning, continues without global corrections.
- `confirmOocReview` with no drops → no-op, status remains `ooc_pending_review`.

## Files Affected

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `TranscriptCorrection` model, add `cleanupStatus` + `oocReviewItems` to `Transcript` |
| `src/lib/queue/transcript-cleanup-queue.ts` | New — queue + job type definitions |
| `src/lib/queue/transcript-cleanup-worker.ts` | New — worker with basic + ooc phases |
| `src/lib/queue/multi-track-worker.ts` | Enqueue cleanup `basic` job after broadcast |
| `src/server/routers/sessions.ts` | Add `triggerOocCleanup` + `confirmOocReview` procedures |
| `src/app/(app)/campaigns/[slug]/sessions/[id]/` | Transcript status badge + OOC review sheet |
| `package.json` | Add `worker:transcript-cleanup` script |
| `docs/transcription-tools/corrections-global.json` | Already exists — no change needed |
