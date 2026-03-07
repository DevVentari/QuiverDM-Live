# E2E Pipeline Fix + UI 2.0 Prep — Design

Date: 2026-03-06

## Context

Three pipelines need E2E verification before UI 2.0 work begins. One (transcription) is broken — runs inline instead of via worker queue. Image generation is wired but untested. Campaign creation is missing image upload. PostHog is wired and tracking 6 events but NPC creation isn't tracked.

## 1. Transcription Pipeline Fix

**Problem**: `sessionTranscription.transcribeSession` runs a 30-min polling loop inline in the tRPC handler. Timeouts on Vercel (10s limit). Queue + worker exist (`transcription-queue.ts`, `transcription-worker.ts`) but are never called.

**Fix**: Rewire router to enqueue via `addTranscriptionJob()` instead of running inline. Router becomes: validate -> enqueue -> return jobId. Frontend already polls status via `useTranscriptionProgress` (Redis-backed).

**Files**:
- `src/server/routers/session-transcription.ts` — gut inline logic, call `addTranscriptionJob()`
- `src/lib/queue/transcription-worker.ts` — ensure it contains the full AssemblyAI flow (download, submit, poll, save)
- `src/lib/queue/transcription-queue.ts` — verify job data shape matches worker expectations

## 2. Campaign Creation — Simple/Advanced + Banner Upload

**Simple (default)**:
- Name (required, max 100)
- Banner image upload (drag-drop, reuses `/api/upload/campaign-banner`)
- Description (optional)

**Advanced (collapsible, closed by default)**:
- Game system (dropdown: D&D 5e, Pathfinder 2e, Other)
- Setting/world name (text)
- Player count target (number)
- Session schedule (day/time/frequency)
- Starting level (1-20)
- House rules (textarea)
- Link to "Import from Obsidian"

**Schema**: Campaign model likely already has `bannerUrl`. Create page uploads image first, passes URL to `campaigns.create` mutation. May need to add metadata JSON field for advanced fields (gameSystem, settingName, playerCount, schedule, startingLevel, houseRules).

**Files**:
- `src/app/(app)/campaigns/new/page.tsx` — add image upload + advanced toggle
- `src/server/routers/campaigns.ts` — accept `bannerUrl` + metadata in create mutation
- Prisma schema — check if Campaign has bannerUrl + metadata fields, add if missing

## 3. Image Generation E2E Test

**Goal**: Verify the full chain: UI trigger -> queue -> worker -> provider -> storage -> display.

**Providers**: ComfyUI (local GPU) -> Replicate SDXL -> DALL-E 3. Consider swapping Replicate for fal.ai (already have account in credentials.env).

**Test plan**:
- Start `worker:image` locally
- Trigger from homebrew ImageGenerationDialog
- Trigger from NPC portrait generation
- Verify image appears in gallery / on card
- Test fallback chain (disable ComfyUI, verify cloud provider works)

## 4. Ollama Test Agent

**Purpose**: Dev/test LLM that returns structured mock data matching expected schemas.

**Modelfile** (`deploy/ollama/Modelfile.test`):
```
FROM tinyllama
SYSTEM You are a test agent for QuiverDM. When asked to extract D&D content, return valid JSON matching the requested schema with placeholder values. Always include: {"test_mode": true, "received_prompt_length": <n>, "timestamp": "<iso>"}. Keep responses under 200 tokens.
```

Register as `quiverdm-test`. Set as default when `NODE_ENV=development` in extraction config.

## 5. Create Pages Audit

All pages already use `CreatePageShell` + glass-panel. Remaining work:
- Verify all success redirects land correctly
- Test homebrew create dialog -> detail page linking
- Add PostHog tracking for NPC creation (`npc_created` event)
- Test mobile viewport on all create flows (44px touch targets)
- Verify character creation tabs all function (race/class/background selectors)

## 6. Style Cards

Create `docs/design-system/` with:
- `colors.md` — CSS variable tokens from globals.css
- `typography.md` — display, body, mono fonts + scale
- `components.md` — shadcn inventory, usage patterns
- `patterns.md` — CreatePageShell, glass-panel, section-rule, label-overline, grain
- `anti-patterns.md` — from CLAUDE.md design system section with examples

## Implementation Order

1. Transcription fix (broken, highest priority)
2. Campaign create with image + simple/advanced
3. Image gen E2E test + fal.ai swap consideration
4. Ollama test agent
5. Create pages audit + missing PostHog events
6. Style cards
