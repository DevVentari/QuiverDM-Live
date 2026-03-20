# Session Detail Page Rework + Post-Session Pipeline — Design Spec

**Date:** 2026-03-16
**Status:** Approved

---

## Problem

The session detail page is a 63KB monolith. It shows a full transcript viewer with speaker turns, timestamps, and search — too much raw data for DM review. There is no auto-trigger for AI analysis, no Discord integration, and no sourcebook context for AI prompts.

---

## Scope

1. Rework the session detail page layout
2. Strip filler words from transcripts
3. Add sourcebook to campaign settings (AI context)
4. Auto-trigger summary when transcription completes
5. Discord webhook — post summary on completion
6. 2000 char limit (free) / 4000 char limit (subscribed)

---

## Session Detail Page — New Layout

**Route:** `/campaigns/[slug]/sessions/[sessionId]` — same route, full component rewrite.

### Sections (top to bottom)

**1. Header**
- Session title (editable inline), session number, date, status badge
- Action row: Edit Prep, Start/Resume Session, Delete

**2. Summary Card**
- AI summary rendered as markdown
- Status states: `none` (shows "Analyze Session" CTA), `pending/processing` (spinner + "Analyzing…"), `done` (rendered markdown), `error` (error message + retry)
- "Re-analyze" button when done
- Auto-triggers when `aiSummaryStatus` transitions to `none` after transcription completes

**3. Discord Panel** (only shown if campaign has `discordWebhookUrl` set)
- Shows: last posted timestamp or "Not posted yet"
- "Post to Discord" button — manual trigger
- Auto-posts when summary first reaches `done` status
- Post character limit: 2000 chars (free) / 4000 chars (subscribed, split 2 messages)

**4. Recordings**
- Existing `RecordingCard` components, unchanged

**5. Raw Data** (collapsed by default)
- Accordion section: "Transcript Data"
- Shows cleaned transcript as formatted JSON in a `<pre>` scrollable code block
- Same visual pattern as homebrew extraction preview
- No search, no speaker timeline, no playback sync — just the data

### Removed from current page
- Inline transcript viewer (speaker turns, timestamp scrubbing, search)
- The large tabbed layout — replaced with linear sections
- CockpitLayout (desktop 3-panel) — session detail is not the cockpit

---

## Filler Word Stripping

**Where:** Post-transcription processing step in `transcription-worker.ts`, after AssemblyAI returns.

**What gets stripped:** um, uh, er, ah, like (filler use), you know, I mean, sort of, kind of, basically, literally, actually (filler use), right (filler), yeah (mid-sentence), okay (filler)

**Implementation:**
- `src/lib/transcription/strip-fillers.ts` — pure function `stripFillers(text: string): string`
- Regex-based, word-boundary aware, case-insensitive
- Applied to each `utterance.text` in the AssemblyAI response before saving

**Data model:**
- `Transcript` model gets `rawContent Json?` field — stores original unstripped utterances
- Existing `content` field stores the cleaned version
- Migration: additive only

```prisma
// Addition to Transcript model
rawContent  Json? // original utterances before filler stripping
```

---

## Campaign Sourcebook Setting

**Where:** `Campaign.settings` JSON field (already exists, no schema migration needed).

**Shape addition:**
```ts
settings: {
  sourcebook?: string;          // e.g. "Vecna: Eye of Ruin"
  discordWebhookUrl?: string;   // Discord webhook for summary posts
  allowPlayerNotes?: boolean;   // existing
  shareRecaps?: boolean;        // existing
}
```

**UI:** Campaign settings page (`/campaigns/[slug]/settings`) — add two new fields:
- "Sourcebook" text input — freeform, e.g. "Vecna: Eye of Ruin", "Curse of Strahd"
- "Discord Webhook URL" text input — paste webhook URL, validated as Discord webhook format

**AI usage:** `sourcebook` injected into the summary prompt:
> "This session is part of a campaign running the {sourcebook} adventure. Use this for context when referencing locations, factions, and lore."

---

## Auto-Trigger Summary

**Current state:** Summary is manually triggered by the DM clicking "Generate Summary".

**New behaviour:** When transcription worker finishes and sets `Transcript.status = 'completed'`, it enqueues a summary job automatically if `session.aiSummaryStatus === 'none'`.

**Where:** `src/lib/queue/transcription-worker.ts` — after saving transcript, check and enqueue:
```ts
if (session.aiSummaryStatus === 'none') {
  await summaryQueue.add('generate-summary', { sessionId: session.id });
  await prisma.gameSession.update({
    where: { id: session.id },
    data: { aiSummaryStatus: 'pending' }
  });
}
```

No new worker needed — reuses existing `summary-worker`.

---

## Discord Post

**New file:** `src/lib/discord/post-summary.ts`

```ts
postSummaryToDiscord(webhookUrl: string, summary: string, sessionTitle: string, isSubscribed: boolean): Promise<void>
```

- `isSubscribed`: if true, limit = 4000 chars (split 2 messages); if false, limit = 2000 chars (single message)
- Message format:
  ```
  **[Session Title]**
  <summary text>
  ```
- If subscribed and summary > 2000 chars: send message 1 (first 2000), message 2 (remainder up to 2000)
- Uses `fetch` to POST to webhook URL — no Discord SDK needed

**Trigger:** In `summary-worker.ts`, after saving `aiSummary` to DB, check if campaign has `discordWebhookUrl` in settings and call `postSummaryToDiscord`.

**Manual trigger:** `sessions.postToDiscord` tRPC mutation — `campaignDMProcedure`, calls same function, returns `{ ok: boolean }`.

---

## tRPC Changes

| Mutation | Purpose |
|----------|---------|
| `sessions.postToDiscord` | Manual Discord post trigger |
| `campaigns.updateSettings` | Save sourcebook + discordWebhookUrl (may already exist) |

---

## Schema Changes

```prisma
// Transcript model — add rawContent field
rawContent  Json?  // original unstripped utterances

// Campaign.settings JSON (no migration — JSON field)
// Add: sourcebook, discordWebhookUrl
```

Migration: single additive migration for `Transcript.rawContent`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx` | Full rewrite — new layout |
| `src/lib/transcription/strip-fillers.ts` | New — filler stripping util |
| `src/lib/discord/post-summary.ts` | New — Discord post util |
| `src/lib/queue/transcription-worker.ts` | Auto-enqueue summary after transcript done |
| `src/lib/queue/summary-worker.ts` | Auto-post to Discord after summary done |
| `src/app/(app)/campaigns/[slug]/settings/page.tsx` | Add sourcebook + Discord webhook fields |
| `prisma/schema.prisma` | Add `Transcript.rawContent` |
| `src/server/routers/sessions.ts` | Add `postToDiscord` mutation |

---

## Out of Scope

- Discord bot (full bot with slash commands) — webhook only for now
- Transcript editing UI
- Summary editing UI
- Per-session Discord channel override
