# Feedback Overlay — Design

**Date:** 2026-03-01
**Status:** Approved
**Approach:** Extend existing feedback system (Approach A)

## Goal

A floating overlay accessible from anywhere in the app that captures console logs + a DOM screenshot, lets the user describe an issue or request, then posts a Discord forum thread and a Claude triage analysis automatically.

---

## Data Flow

```
User clicks floating button
  → html2canvas captures DOM snapshot → base64 PNG
  → Console ring buffer (last 50 error/warn) flushed to array
  → User fills in: type (bug/feature/feedback), description
  → Submit → tRPC feedback.createReport mutation

Server (tRPC):
  → Validate input
  → Upload screenshot PNG via Discord multipart API
  → prisma.feedback.create (metadata: { consoleLogs, screenshotUrl, pageUrl, userAgent })
  → Discord REST API (bot token):
      POST /channels/{forum_channel}/threads  → creates forum post (= thread)
      POST /channels/{threadId}/messages      → Claude analysis as follow-up embed
  → Claude API call (claude-haiku-4-5):
      Input: type, description, pageUrl, top 20 console logs
      Output: { severity, likely_cause, affected_files[], suggested_fix }

Discord thread structure:
  [Message 1] User report embed (type, description, page, user, screenshot)
  [Message 2] Claude triage embed (severity badge, cause, affected files, fix suggestion)
```

---

## UI / Components

### Floating widget

- Fixed position, bottom-right, z-50, visible in AppShell (all authenticated pages)
- Small button with MessageSquare icon ("Report / Feedback")
- Opens a Dialog (not a drawer — keeps screenshot preview usable on all screen sizes)

### Dialog layout

```
┌─────────────────────────────────┐
│  Report an issue                │
│  ─────────────────              │
│  [Bug] [Feature] [Feedback]     │  ← toggle buttons
│                                 │
│  Description                    │
│  [                           ]  │
│  [                           ]  │
│                                 │
│  Screenshot preview  [retake]   │
│  [░░░░░░░░░░░░░░░░░░░░░░░░░░]  │  ← captured on dialog open
│                                 │
│  Console logs (12 captured)     │
│  [show / hide]                  │  ← collapsible, hidden by default
│                                 │
│              [Cancel] [Submit]  │
└─────────────────────────────────┘
```

### Console log capture

- Client-side provider installed at root, wraps AppShell
- Intercepts `console.error` and `console.warn`
- Ring buffer: last 50 entries as `{ ts: number, level: string, msg: string }`
- Individual log strings truncated at 500 chars
- Buffer is module-level (survives re-renders), flushed on submit

---

## Files

| Action | Path |
|--------|------|
| New | `src/components/feedback/feedback-widget.tsx` |
| New | `src/components/feedback/console-log-capture.tsx` |
| Edit | `src/app/(app)/app-shell.tsx` — mount both providers |
| Edit | `src/server/routers/feedback.ts` — add `createReport` mutation |
| Edit | `src/server/services/feedback.service.ts` — Discord thread + Claude triage methods |

---

## Backend

### New tRPC mutation: `feedback.createReport`

Input schema:
```ts
{
  type: 'bug' | 'feature' | 'feedback'
  description: string          // min 10 chars
  pageUrl: string
  userAgent: string
  screenshotBase64: string     // PNG, data URL
  consoleLogs: {
    ts: number
    level: string
    msg: string
  }[]
}
```

Server sequence:
1. Upload screenshot to Discord CDN via multipart POST (returns `attachment://` URL)
2. `prisma.feedback.create` — store type, description, metadata JSON
3. `POST /channels/{DISCORD_FEEDBACK_CHANNEL_ID}/threads` — create forum post with screenshot embed
4. Call Claude API (claude-haiku-4-5) — structured triage analysis
5. `POST /channels/{threadId}/messages` — post Claude analysis as color-coded embed

### Claude prompt

```
System: You are a bug triage agent for QuiverDM, an AI-powered D&D session management app.
        Analyze the report and respond with JSON only.

User: Type: {type}
      Page: {pageUrl}
      Description: {description}
      Console logs (last 20):
      {logs}

Response schema:
{
  "severity": "low" | "medium" | "high" | "critical",
  "likely_cause": "string (1-2 sentences)",
  "affected_files": ["string"],
  "suggested_fix": "string (concrete action)",
  "reproduction_steps": "string"
}
```

### Discord embed colors by severity

| Severity | Color |
|----------|-------|
| critical | `0xFF0000` |
| high | `0xFF8C00` |
| medium | `0xFFD700` |
| low | `0x00C853` |
| feature/feedback | `0x5865F2` |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DISCORD_BOT_TOKEN` | Discord REST API auth |
| `DISCORD_FEEDBACK_CHANNEL_ID` | Forum channel ID for feedback threads |
| `DISCORD_FEEDBACK_WEBHOOK_URL` | **Remove** — replaced by bot token approach |

---

## Discord Setup (one-time, manual)

1. Create app at discord.com/developers
2. Add a bot, copy bot token → `DISCORD_BOT_TOKEN`
3. Create a **Forum channel** in your Discord server → copy channel ID → `DISCORD_FEEDBACK_CHANNEL_ID`
4. Invite bot with scopes: `Send Messages`, `Create Public Threads`, `Attach Files`

---

## Dependencies

- `html2canvas` — DOM snapshot (client-only, ~150kb)
- `@anthropic-ai/sdk` — already in project (claude-developer-platform skill)

No new Prisma models. `metadata` JSON field on existing `Feedback` model absorbs console logs, screenshot URL, page URL, userAgent.
