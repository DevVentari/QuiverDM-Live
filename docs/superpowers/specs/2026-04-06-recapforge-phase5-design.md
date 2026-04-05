# RecapForge Phase 5 — Summary Generation Engine Design

## Overview

A BullMQ worker generates AI-powered session recaps in four styles from the enriched transcript and campaign context. A tRPC router exposes generation, retrieval, and export. A minimal UI lives as a tab on the session detail page plus a standalone recap page. Clarification round deferred to Phase 6 (`clarificationSkipped: true` always).

---

## Architecture

### New Files

- `src/lib/queue/recap-generation-queue.ts` — BullMQ queue definition + job type
- `src/lib/queue/recap-generation-worker.ts` — generation worker (Anthropic → parse → upsert → broadcast)
- `src/lib/recap/recap-prompts.ts` — prompt templates for all 4 styles + section-shape constants
- `src/server/routers/recap.ts` — tRPC router (5 procedures)
- `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx` — standalone recap page

### Modified Files

- `src/server/routers/_app.ts` — register `recap` router
- `src/components/recap/speaker-mapping-step.tsx` — auto-trigger NARRATIVE generation after mappings saved
- Session detail page — add "Recap" tab
- `package.json` — add `worker:recap-generation` script
- `deploy/hetzner/start-workers.sh` — add recap-generation worker

---

## Data Model

Uses existing schema — no new migrations required:

```prisma
model SessionRecap {
  id         String      @id @default(cuid())
  sessionId  String
  campaignId String
  style      RecapStyle
  status     RecapStatus @default(AUTO_GENERATED)
  sections   Json        // [{ key, title, content }]
  rawContent String      @db.Text
  discordFormatted  String?  @db.Text
  discordCharLimit  Int      @default(2000)
  discordThreadMode Boolean  @default(false)
  promptVersion     String?
  modelUsed         String?
  tokensUsed        Int?
  generationTimeMs  Int?
  clarifications       ClarificationQA[]
  clarificationSkipped Boolean @default(false)
  editHistory Json?
  approvedAt  DateTime?
  sharedAt    DateTime?
  sharedTo    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum RecapStyle {
  NARRATIVE
  SESSION_LOG
  BARDS_TALE
  PREVIOUSLY_ON
}

enum RecapStatus {
  GENERATING
  AUTO_GENERATED
  CLARIFICATION_PENDING
  REVIEWED
  QUICK_FIRE
}
```

Phase 5 only uses `GENERATING` and `AUTO_GENERATED`. Other statuses are reserved for Phase 6.

---

## Section Shapes

Each style produces a consistent sections array: `[{ key: string, title: string, content: string }]`

| Style | Keys |
|-------|------|
| `NARRATIVE` | `setup`, `key_events`, `resolution`, `cliffhanger` |
| `SESSION_LOG` | `key_events`, `npcs_met`, `decisions`, `loot` |
| `BARDS_TALE` | `tale` |
| `PREVIOUSLY_ON` | `cold_open` |

Section titles are defined in `recap-prompts.ts` as constants and included in the prompt so Claude uses them verbatim.

---

## Prompt Templates (`recap-prompts.ts`)

Each template is a function returning `{ system: string, user: string }`. All templates share the same context injection:

```ts
// Injected into every prompt
interface PromptContext {
  correctedText: string;     // Truncated to 12,000 chars
  speakersJson: string;      // JSON.stringify(transcript.speakers)
  campaignContext: string;   // Last 3 SESSION_EXTRACT contents joined with '\n\n'
  style: RecapStyle;
}
```

System prompt (shared): _"You are an expert D&D session recorder. Respond ONLY with valid JSON — no prose, no markdown fencing."_

User prompt per style requests JSON in the shape `{ "sections": [{ "key": "...", "title": "...", "content": "..." }] }` with exact keys and titles provided.

Style guidance:
- **NARRATIVE**: Third-person prose, dramatic, reads like a novel excerpt. ~150 words per section.
- **SESSION_LOG**: Bullet-point structured log. key_events as numbered list, others as bullets. ~80 words per section.
- **BARDS_TALE**: First-person as a bard recounting at a tavern. Theatrical, rhyme optional. ~300 words.
- **PREVIOUSLY_ON**: 3–4 sentence cold-open for next session readback. ~60 words total.

---

## Worker (`recap-generation-worker`)

### Job Type

```ts
interface RecapGenerationJobData {
  recapId: string;       // SessionRecap already created at GENERATING status
  transcriptId: string;
  campaignId: string;
  sessionId: string;
  style: RecapStyle;
}

interface RecapGenerationJobResult {
  success: boolean;
  recapId: string;
  tokensUsed?: number;
}
```

Queue name: `recap-generation`

### Processing Steps

1. Fetch `SessionRecap` by `recapId`. If `status !== 'GENERATING'`, log and exit — idempotent re-delivery guard.
2. Fetch `Transcript` by `transcriptId`. Truncate `correctedText` to 12,000 chars.
3. Fetch last 3 `CampaignContext` records where `{ campaignId, type: 'SESSION_EXTRACT' }` ordered by `createdAt desc`. Join `content` fields with `'\n\n'`.
4. Build prompt via `recap-prompts.ts` for the given style.
5. Call Anthropic SDK:
   ```ts
   const response = await anthropic.messages.create({
     model: 'claude-sonnet-4-6',
     max_tokens: 4096,
     messages: [{ role: 'user', content: userPrompt }],
     system: systemPrompt,
   });
   ```
6. Extract text from `response.content[0]` (type: `text`). Parse JSON — if parsing fails, throw (triggers BullMQ retry).
7. Validate sections array structure. If malformed, throw.
8. Build `rawContent`: `sections.map(s => s.content).join('\n\n')`.
9. Record `generationTimeMs` from job start.
10. Update `SessionRecap`:
    ```ts
    await prisma.sessionRecap.update({
      where: { id: recapId },
      data: {
        sections,
        rawContent,
        status: 'AUTO_GENERATED',
        modelUsed: 'claude-sonnet-4-6',
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        generationTimeMs,
        clarificationSkipped: true,
      },
    });
    ```
11. Broadcast: `broadcastRecapComplete(sessionId, recapId)`.

**Failure mode:** Job throws → BullMQ retries ×3 with default backoff. On permanent failure, `SessionRecap` status remains `GENERATING`. The UI detects stuck state when `status === 'GENERATING'` and `createdAt` is > 5 minutes ago — shows error message with a manual retry button.

**Concurrency:** 1 (Anthropic calls are I/O-bound; one concurrent job prevents rate-limit bursts).

### Auto-trigger from Speaker Mapping

In `SpeakerMappingStep.onComplete`:

```ts
try {
  // generateRecap = trpc.recap.generate.useMutation().mutateAsync
  await generateRecap({
    campaignId,
    sessionId,
    transcriptId,
    style: 'NARRATIVE',
  });
} catch (err) {
  console.warn('[SpeakerMappingStep] Auto-recap trigger failed (non-fatal):', err);
}
```

Failure is silent — the DM can manually trigger from the recap page.

---

## tRPC Router (`recap`)

All procedures use `campaignDMProcedure`.

### `generate`

```ts
input: z.object({
  campaignId: z.string(),
  sessionId: z.string(),
  transcriptId: z.string(),
  style: z.nativeEnum(RecapStyle),
})
// returns: { recapId: string }
```

Creates `SessionRecap` at `GENERATING` status, enqueues job, returns `recapId`. Does not check for existing recaps — multiple recaps per session are allowed (one per style per generation run).

### `getBySession`

```ts
input: z.object({
  campaignId: z.string(),
  sessionId: z.string(),
})
// returns: SessionRecap[] ordered by createdAt desc
```

### `getById`

```ts
input: z.object({
  campaignId: z.string(),
  recapId: z.string(),
})
// returns: SessionRecap
```

Throws `NotFoundError` if recap not found or doesn't belong to campaignId.

### `regenerate`

```ts
input: z.object({
  campaignId: z.string(),
  recapId: z.string(),   // Source recap — provides sessionId and transcriptId
  style: z.nativeEnum(RecapStyle),
})
// returns: { recapId: string }  (new recap ID)
```

Fetches source recap to get `sessionId` and `transcriptId`. Creates a new `SessionRecap` at `GENERATING`, enqueues job. Old recap is preserved — the DM can compare styles.

### `exportMarkdown`

```ts
input: z.object({
  campaignId: z.string(),
  recapId: z.string(),
})
// returns: { markdown: string }
```

Builds a markdown string: `# [Session Name]\n\n` followed by each section as `## [title]\n\n[content]\n\n`. Returns as string for client-side clipboard copy.

---

## UI

### Session Detail Page — Recap Tab

Location: existing session detail page (add "Recap" tab to tab bar).

States:
- **No recap**: "Generate Recap" button + style dropdown (defaults to Narrative) + helper text
- **GENERATING**: spinner + "Generating recap…" + started timestamp
- **AUTO_GENERATED**: first section preview (truncated to 3 lines) + "View Full Recap →" link to standalone page + "Recap ready" badge
- **Stuck** (GENERATING > 5 min): red text "Generation failed" + "Retry" button

### Standalone Recap Page

Route: `campaigns/[slug]/sessions/[sessionId]/recap`

Layout (stone-card, full width within campaign shell):
- **Header**: Session name + date
- **Style picker**: 4 pill buttons (Narrative / Session Log / Bard's Tale / Previously On…). Selecting a style that has no existing recap shows "Generate" button. Selecting one with an existing recap displays it.
- **Content area**: One stone-card per section. Section title in Cinzel. Section content in Bricolage Grotesque. GENERATING state shows skeleton loaders per section.
- **Actions bar**: "Regenerate" (re-runs current style, creates new recap) + "Export Markdown" (copies to clipboard) + "← Back to Session" link
- **Recap switcher**: If multiple recaps exist for the same style, a small dropdown shows `[style] — [createdAt]` for each — DM can browse history.

**Polling**: while any recap for the session is `GENERATING`, `getBySession` refetches every 3 seconds. Stops when all are `AUTO_GENERATED` or stuck.

---

## Testing

### Unit Tests

File: `tests/unit/recap/recap-prompts.test.ts`

- Assert each style template returns `{ system, user }` with non-empty strings
- Assert section keys in prompt match section-shape constants
- Assert JSON shape instruction appears in every user prompt

### Workflow Stub

File: `tests/workflows/recapforge-generation.workflow.spec.ts`

```ts
test.fixme('recap generates after speaker mapping completes', async ({ page }) => {
  // Phase 5 — requires Anthropic API key in E2E env
});

test.fixme('DM can manually generate recap with style selection', async ({ page }) => {
  // Phase 5 — requires Anthropic API key in E2E env
});
```

---

## Constraints

- Anthropic SDK called directly in worker (not via `chatWithAI`) — integrate into provider chain in future phase
- `clarificationSkipped: true` always in Phase 5 — clarification round deferred to Phase 6
- No new Prisma migrations — all models exist
- Multiple recaps per session are allowed — `regenerate` creates new records, never overwrites
- Worker concurrency: 1
- Generation failure leaves status as `GENERATING` — UI detects by age (> 5 min)
- `ANTHROPIC_API_KEY` required in worker environment (Hetzner .env)
