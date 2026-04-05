# RecapForge Phase 1 — Schema & Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all Prisma schema changes for the RecapForge module — 4 new models, 3 enum groups, and extensions to 4 existing models — in a single `db:push`.

**Architecture:** All changes live in `prisma/schema.prisma`. New models (`SessionRecap`, `ClarificationQA`, `CampaignContext`, `SpeakerMapping`) are appended at the end of the file before the final closing. Existing models (`Campaign`, `GameSession`, `SessionRecording`, `Character`) each receive new fields/relations inline. No application code is touched in this phase.

**Tech Stack:** Prisma ORM, PostgreSQL + pgvector (already active via `extensions = [vector]` in schema)

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Modify | `prisma/schema.prisma` | Add 3 enums, extend 4 models, add 4 new models |

That's it. One file.

---

## Task 1: Add RecapForge enums

**Files:**
- Modify: `prisma/schema.prisma` — append enums before the end of the file (after line 1565)

Three new enums are needed by the new models. Add them at the bottom of the schema file, after the last existing model (`WorldPressureHistory`).

- [ ] **Step 1: Append the three enums to schema.prisma**

Open `prisma/schema.prisma` and add the following after the last closing brace (line 1565):

```prisma
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

enum ContextType {
  CAMPAIGN_BRIEF
  SESSION_EXTRACT
  SOURCEBOOK_LABEL
}
```

- [ ] **Step 2: Verify the schema parses**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(recapforge): add RecapStyle, RecapStatus, ContextType enums"
```

---

## Task 2: Extend the Campaign model

**Files:**
- Modify: `prisma/schema.prisma` — Campaign model, lines ~294–316 (content relations block)

Add three fields to the existing `Campaign` model: the two new relation arrays and the sourcebook label string.

- [ ] **Step 1: Add fields to Campaign**

In the Campaign model, after the `brainIngestSources` / `entityMergeRules` / `pressureHistory` relation lines (around line 318, before `createdAt`), add:

```prisma
  // RecapForge
  campaignContexts  CampaignContext[]
  speakerMappings   SpeakerMapping[]
  sourcebookLabel   String?           // e.g. "Curse of Strahd" — informational label only
```

- [ ] **Step 2: Validate**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

Note: validate will fail here if `CampaignContext` and `SpeakerMapping` models don't exist yet — that is expected and will be resolved in Tasks 5 and 6. If you want to validate early, add stub models temporarily, or skip validation until Task 6.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(recapforge): extend Campaign with context/speaker/sourcebook fields"
```

---

## Task 3: Extend the GameSession model

**Files:**
- Modify: `prisma/schema.prisma` — GameSession model, around line 554 (before `createdAt`)

Add two relation arrays to `GameSession`.

- [ ] **Step 1: Add fields to GameSession**

In the `GameSession` model, after the `worldEventProposals` relation (around line 561, before `@@unique`), add:

```prisma
  // RecapForge
  recaps            SessionRecap[]
  campaignContexts  CampaignContext[]
```

- [ ] **Step 2: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(recapforge): extend GameSession with recaps and campaignContexts relations"
```

---

## Task 4: Extend the SessionRecording model

**Files:**
- Modify: `prisma/schema.prisma` — SessionRecording model, around line 858 (before `createdAt`)

Add Craig multi-track fields to the existing `SessionRecording` model.

- [ ] **Step 1: Add fields to SessionRecording**

In the `SessionRecording` model, after the `transcripts` relation line (around line 859, before `createdAt`), add:

```prisma
  // RecapForge — Craig multi-track support
  isCraigMultiTrack Boolean  @default(false)
  craigTrackFiles   Json?    // [{ filename, discordUsername, r2Key, duration }]
  craigMergeStatus  String?  // "pending" | "processing" | "complete" | "failed"
```

- [ ] **Step 2: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(recapforge): extend SessionRecording with Craig multi-track fields"
```

---

## Task 5: Extend the Character model

**Files:**
- Modify: `prisma/schema.prisma` — Character model, around line 471 (after `homebrewFeats`)

Add the back-relation so `SpeakerMapping` can FK to `Character`.

- [ ] **Step 1: Add speakerMappings relation to Character**

In the `Character` model, after the `homebrewFeats` relation line (around line 472, before `createdAt`), add:

```prisma
  // RecapForge — speaker attribution
  speakerMappings   SpeakerMapping[]
```

- [ ] **Step 2: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(recapforge): add speakerMappings back-relation to Character"
```

---

## Task 6: Add the SpeakerMapping model

**Files:**
- Modify: `prisma/schema.prisma` — append after `WorldPressureHistory` (before the new enums from Task 1)

- [ ] **Step 1: Add SpeakerMapping model**

Append the following model after `WorldPressureHistory` and before the enums added in Task 1:

```prisma
// RecapForge — persistent speaker-to-character mapping per campaign
model SpeakerMapping {
  id            String    @id @default(cuid())
  campaignId    String
  campaign      Campaign  @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  speakerLabel  String    // Discord username or "Speaker 0" etc.
  characterId   String?
  character     Character? @relation(fields: [characterId], references: [id], onDelete: SetNull)

  characterName String    // Denormalised for display without join
  isDM          Boolean   @default(false)

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([campaignId, speakerLabel])
  @@index([campaignId])
}
```

- [ ] **Step 2: Validate**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`  
(Will still fail if `SessionRecap` / `CampaignContext` models are missing — that's resolved in Tasks 7 and 8.)

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(recapforge): add SpeakerMapping model"
```

---

## Task 7: Add the CampaignContext model

**Files:**
- Modify: `prisma/schema.prisma` — append after `SpeakerMapping`

- [ ] **Step 1: Add CampaignContext model**

Append after `SpeakerMapping` and before the enums:

```prisma
// RecapForge — rolling semantic memory per campaign, grounding AI summarisation
model CampaignContext {
  id         String      @id @default(cuid())
  campaignId String
  campaign   Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  sessionId  String?
  session    GameSession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  type       ContextType // CAMPAIGN_BRIEF | SESSION_EXTRACT | SOURCEBOOK_LABEL
  content    String      @db.Text

  // pgvector embedding for semantic search (1536 dimensions — OpenAI ada-002 compatible)
  embedding  Unsupported("vector(1536)")?

  // Structured extraction fields (populated for SESSION_EXTRACT type)
  keyEvents    Json? // ["Event description", ...]
  npcsInvolved Json? // ["NPC Name", ...]
  decisions    Json? // ["Decision made", ...]
  lootGained   Json? // ["Item name", ...]

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([campaignId])
  @@index([sessionId])
}
```

- [ ] **Step 2: Validate**

```bash
npx prisma validate
```

Expected: valid (only `SessionRecap` relation still missing from `GameSession.recaps` — but `recaps` points to `SessionRecap` which comes in Task 8).

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(recapforge): add CampaignContext model with pgvector embedding"
```

---

## Task 8: Add the ClarificationQA and SessionRecap models

**Files:**
- Modify: `prisma/schema.prisma` — append after `CampaignContext`

These two models reference each other (`SessionRecap` has `clarifications ClarificationQA[]`, `ClarificationQA` has `recap SessionRecap`), so they must be added together.

- [ ] **Step 1: Add ClarificationQA model**

Append after `CampaignContext` and before the enums:

```prisma
// RecapForge — AI-generated clarification questions answered by DM before final summary
model ClarificationQA {
  id       String       @id @default(cuid())
  recapId  String
  recap    SessionRecap @relation(fields: [recapId], references: [id], onDelete: Cascade)

  question     String  // The AI-generated question text
  context      String? @db.Text // Relevant transcript excerpt
  timestamp    Float?  // Position in recording (seconds) where ambiguity occurs

  questionType String  // "binary" | "short_answer" | "multiple_choice"
  options      Json?   // For binary/multiple_choice: ["Yes, sincere", "No, sarcastic"]

  answer  String?  // DM's response
  skipped Boolean  @default(false)

  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  @@index([recapId])
}
```

- [ ] **Step 2: Add SessionRecap model**

Append after `ClarificationQA` and before the enums:

```prisma
// RecapForge — AI-generated session summary in one of four styles
model SessionRecap {
  id        String      @id @default(cuid())
  sessionId String
  session   GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  style  RecapStyle
  status RecapStatus @default(AUTO_GENERATED)

  // Content — sectioned JSON and raw concatenated text
  sections   Json   // [{ key: "setup", title: "Setup", content: "..." }, ...]
  rawContent String @db.Text

  // Discord formatting
  discordFormatted  String?  @db.Text
  discordCharLimit  Int      @default(2000)
  discordThreadMode Boolean  @default(false)

  // Generation provenance
  promptVersion    String
  modelUsed        String
  tokensUsed       Int?
  generationTimeMs Int?

  // Clarification round
  clarifications       ClarificationQA[]
  clarificationSkipped Boolean           @default(false)

  // Edit history — [{ sectionKey, previousContent, editedAt, editType }]
  editHistory Json?

  // Workflow timestamps
  approvedAt DateTime?
  sharedAt   DateTime?
  sharedTo   String?   // "discord" | "clipboard" | "markdown"

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([sessionId])
  @@index([status])
}
```

- [ ] **Step 3: Validate the full schema**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid!`

If you see errors about `CampaignContext` or `SpeakerMapping` not found, check that Tasks 6 and 7 committed correctly.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(recapforge): add ClarificationQA and SessionRecap models"
```

---

## Task 9: Push schema to local database and verify

**Files:**
- No file changes — this task runs commands only

- [ ] **Step 1: Confirm Docker services are running**

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "postgres|redis"
```

Expected: both postgres and redis containers show `Up`.

- [ ] **Step 2: Push schema**

```bash
npm run db:push
```

Expected output includes lines like:
```
✔ Generated Prisma Client
The following migration(s) have been applied:
...
Your database is now in sync with your Prisma schema.
```

If you see an error about `vector` extension not found:
```bash
# Connect to the local DB and enable it manually:
docker exec -it <postgres-container-name> psql -U postgres -d quiverdm -c "CREATE EXTENSION IF NOT EXISTS vector;"
# Then re-run db:push
```

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Verify new tables exist**

```bash
npx prisma studio
```

Open `http://localhost:5555`. Confirm these models appear in the left sidebar:
- `SessionRecap`
- `ClarificationQA`
- `CampaignContext`
- `SpeakerMapping`

Also confirm the existing models show new fields:
- `Campaign` → `sourcebookLabel`, `campaignContexts`, `speakerMappings`
- `GameSession` → `recaps`, `campaignContexts`
- `SessionRecording` → `isCraigMultiTrack`, `craigTrackFiles`, `craigMergeStatus`
- `Character` → `speakerMappings`

Close Prisma Studio when done (`Ctrl+C`).

- [ ] **Step 5: Run TypeScript check to confirm generated client is clean**

```bash
npx tsc --noEmit
```

Expected: zero errors. If you see errors about `RecapStyle`, `RecapStatus`, or `ContextType` not found in `@prisma/client`, re-run `npx prisma generate` and try again.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(recapforge): phase 1 complete — schema pushed and client generated"
```

Then push:

```bash
git push origin main
```

---

## Self-Review Notes

- pgvector: `extensions = [vector]` already declared in datasource — no manual SQL needed locally. Neon prod already uses pgvector (existing `WorldEntity` embedding columns confirm this).
- `CampaignContext.embedding` uses `Unsupported("vector(1536)")` — Prisma won't generate typed access for this column, which is correct. Raw SQL will be used for vector similarity search in Phase 4.
- `SessionRecap.sections` stores `[{ key, title, content }]` — the shape is enforced at the application layer, not by Prisma. No migration needed to change section structure later.
- `SpeakerMapping` has a `@@unique([campaignId, speakerLabel])` constraint — prevents duplicate mappings for the same speaker in a campaign.
- `ClarificationQA` is ordered before `SessionRecap` in the file because Prisma resolves forward references, but the back-reference (`SessionRecap`) must also be defined in the same push. Both go in Task 8 together.
