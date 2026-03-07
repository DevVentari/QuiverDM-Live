# E2E Pipeline Fix + UI 2.0 Prep — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken transcription pipeline, add campaign image upload with simple/advanced creation, verify image generation E2E, create Ollama test agent, audit create pages, and write style cards.

**Architecture:** 6 independent tasks. Task 1 fixes the transcription pipeline by wiring the existing BullMQ queue into the recording upload flow. Task 2 adds banner upload + advanced fields to campaign creation. Tasks 3-6 are verification, tooling, and documentation.

**Tech Stack:** Next.js 15, tRPC, BullMQ, Prisma, shadcn/ui, Ollama, ComfyUI/fal.ai

---

### Task 1: Fix Transcription Pipeline — Wire Queue to Recording Upload

The transcription worker (`src/lib/queue/transcription-worker.ts`) is fully implemented with AssemblyAI but never receives jobs. The `sessionRecordings.create` mutation sets `processingStatus: 'queued'` but doesn't enqueue. The old `sessionTranscription.transcribeSession` runs everything inline (30-min polling loop — impossible on Vercel).

**Files:**
- Modify: `src/server/routers/session-recordings.ts:24-40`
- Modify: `src/server/routers/session-transcription.ts:46-262`
- Modify: `src/lib/queue/transcription-queue.ts` (verify job data shape)
- Test: Manual E2E (upload recording, verify worker picks it up)

**Step 1: Add queue import and enqueue call to `sessionRecordings.create`**

In `src/server/routers/session-recordings.ts`, add the import and enqueue after recording creation:

```typescript
// Add to imports at top:
import { addTranscriptionJob } from '@/lib/queue/transcription-queue';
import { createTranscriptionJob } from '@/lib/transcription/progress';
```

Replace the create mutation body (lines 24-40) with:

```typescript
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const access = await authz.session(input.sessionId, userId).verify();
      await usageService.incrementSessionUploads(userId);

      const recording = await prisma.sessionRecording.create({
        data: {
          sessionId: input.sessionId,
          type: input.type,
          originalUrl: input.url,
          fileSize: input.fileSize,
          durationSeconds: input.durationSeconds,
          processingStatus: 'queued',
        },
      });

      // Create progress tracking job
      const jobId = await createTranscriptionJob({
        sessionId: input.sessionId,
        recordingId: recording.id,
        filePath: input.url,
        modelSize: 'medium',
        language: undefined,
        useGPU: false,
        useSpeakers: true,
        speakerNames: undefined,
        numSpeakers: undefined,
      });

      // Enqueue to BullMQ for async processing
      await addTranscriptionJob({
        jobId,
        sessionId: input.sessionId,
        recordingId: recording.id,
        userId,
        audioUrl: input.url,
        isVideo: input.type === 'video',
        speakerLabels: true,
        language: undefined,
        deleteOriginalFile: true,
        fileUrl: input.url,
        campaignId: access.campaignId,
      });

      return recording;
    }),
```

**Step 2: Deprecate inline `transcribeSession` mutation**

In `src/server/routers/session-transcription.ts`, replace the `transcribeSession` mutation body (lines 67-261) with a simple queue enqueue:

```typescript
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await authz.session(input.sessionId, userId).verify();

      const session = await prisma.gameSession.findUnique({
        where: { id: input.sessionId },
        select: { campaignId: true },
      });

      // Create progress tracking job
      const jobId = await createTranscriptionJob({
        sessionId: input.sessionId,
        recordingId: input.recordingId,
        filePath: input.filePath,
        modelSize: input.modelSize,
        language: input.language,
        useGPU: input.useGPU,
        useSpeakers: input.useSpeakers,
        speakerNames: input.speakerNames,
        numSpeakers: input.numSpeakers,
      });

      // Import queue function
      const { addTranscriptionJob } = await import('@/lib/queue/transcription-queue');

      await addTranscriptionJob({
        jobId,
        sessionId: input.sessionId,
        recordingId: input.recordingId,
        userId,
        audioUrl: input.filePath,
        isVideo: input.filePath.match(/\.(mp4|mkv|avi|mov|webm)$/i) !== null,
        speakerLabels: input.useSpeakers,
        speakersExpected: input.numSpeakers,
        language: input.language,
        deleteOriginalFile: input.deleteOriginalFile,
        fileUrl: input.fileUrl,
        campaignId: session?.campaignId,
      });

      return { success: true, jobId };
    }),
```

Remove unused imports: `randomUUID` is no longer needed if not used elsewhere. Remove `fs`, `path`, `os`, `processVideoForTranscription`, `cleanupFiles`, `transcribeChunksWithWhisperX`, `checkWhisperXAvailability`, `WhisperXOptions`, `ProgressEvent`, `updateTranscriptionProgress`, `TranscriptionProgressTracker`, `saveTranscript`, `deleteFromLocal`, `extractKeyFromLocalUrl`, `getAbsolutePathFromKey`, `deleteFromR2`, `extractKeyFromUrl`, `usageService`.

Keep: `createTranscriptionJob`, `getTranscriptionProgress`, `getTranscriptionProgressBySessionId`, `prisma`, `ForbiddenError`, `NotFoundError`, `authz`.

**Step 3: Verify worker handles the job data shape**

Check `transcription-worker.ts` expects `TranscriptionJobData` which has: `jobId`, `sessionId`, `recordingId?`, `userId`, `audioUrl`, `isVideo`, `speakerLabels`, `speakersExpected?`, `language?`, `wordBoost?`, `deleteOriginalFile`, `fileUrl?`, `campaignId?`. This matches what we enqueue above.

**Step 4: Test locally**

```bash
# Terminal 1: Start worker
npm run worker:transcription

# Terminal 2: Start dev server
npm run dev

# In browser: Go to a session, upload a recording
# Watch worker terminal for "[TranscriptionWorker] Processing job..."
```

**Step 5: Commit**

```bash
git add src/server/routers/session-recordings.ts src/server/routers/session-transcription.ts
git commit -m "fix(transcription): wire BullMQ queue — recordings auto-enqueue for async processing

Previously transcription ran inline in the tRPC handler (30-min polling loop),
which times out on Vercel. Now recording upload enqueues to BullMQ and the
existing transcription worker processes asynchronously."
```

---

### Task 2: Campaign Creation — Banner Upload + Simple/Advanced

**Files:**
- Modify: `src/app/(app)/campaigns/new/page.tsx`
- Modify: `src/server/routers/campaigns.ts:18-22` (add settings to CreateCampaignSchema)
- Modify: `src/server/services/campaign.service.ts:155-183` (pass settings through)
- No schema migration needed — Campaign already has `bannerUrl` and `settings Json?`

**Step 1: Extend CreateCampaignSchema to accept settings**

In `src/server/routers/campaigns.ts`, update the schema:

```typescript
const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional(),
  bannerUrl: z.string().optional(),
  settings: z.object({
    gameSystem: z.string().optional(),
    settingName: z.string().optional(),
    playerCount: z.number().min(1).max(20).optional(),
    startingLevel: z.number().min(1).max(20).optional(),
    schedule: z.object({
      day: z.string().optional(),
      time: z.string().optional(),
      frequency: z.string().optional(),
    }).optional(),
    houseRules: z.string().optional(),
  }).optional(),
});
```

**Step 2: Pass settings through in campaign service**

In `src/server/services/campaign.service.ts`, update the create method to pass settings:

```typescript
  const campaign = await campaignRepository.create({
    name: normalizedName,
    slug,
    description: input.description,
    bannerUrl: input.bannerUrl,
    userId,
    settings: input.settings ?? undefined,
  });
```

Check the repository `create` method accepts `settings` — it likely uses `Prisma.CampaignCreateInput` which already includes `settings`.

**Step 3: Add type for CreateCampaignInput**

Check `campaign.service.ts` for the `CreateCampaignInput` type. If it's manually defined, add `settings` to it. If it's inferred from the router schema, no change needed.

**Step 4: Rebuild campaign creation page**

Replace `src/app/(app)/campaigns/new/page.tsx` with:

- Banner image upload zone (drag-drop, click) at the top of the form
  - Reuse upload pattern from NPC create page (same `/api/upload/campaign-banner` endpoint)
  - Show uploaded image in the preview card (replace gradient placeholder)
- Name + Description fields (existing)
- "Advanced Settings" collapsible section (`Collapsible` from shadcn or a simple `useState` toggle)
  - Game System: `Select` with options ["D&D 5e", "Pathfinder 2e", "Other"]
  - Setting/World Name: `Input`
  - Player Count: `Input` type="number" min=1 max=20
  - Starting Level: `Input` type="number" min=1 max=20
  - Session Schedule: day `Select` + time `Input` + frequency `Select` ["Weekly", "Biweekly", "Monthly", "Irregular"]
  - House Rules: `Textarea`
  - Link: "Or import from an Obsidian vault" → `/campaigns/new/import-obsidian`
- Update preview component to show banner image when uploaded
- Pass `bannerUrl` and `settings` to the `campaigns.create` mutation

**Step 5: Commit**

```bash
git add src/app/\(app\)/campaigns/new/page.tsx src/server/routers/campaigns.ts src/server/services/campaign.service.ts
git commit -m "feat(campaigns): add banner upload + simple/advanced creation

Simple: name, banner image, description. Advanced (collapsible): game system,
setting name, player count, starting level, session schedule, house rules.
Banner uses existing /api/upload/campaign-banner endpoint."
```

---

### Task 3: Image Generation E2E Verification

**Files:**
- Check: `src/lib/ai/image-generation.ts` (provider fallback chain)
- Check: `src/lib/ai/comfyui.ts` (ComfyUI client)
- Check: `C:\Users\mail\.claude\credentials.env` for FAL_KEY or REPLICATE_API_KEY
- Modify: `src/lib/ai/image-generation.ts` if adding fal.ai as provider

**Step 1: Check available API keys**

```bash
grep -i "fal\|replicate\|openai" C:/Users/mail/.claude/credentials.env
```

**Step 2: Test with existing providers**

```bash
# Start image worker
npm run worker:image

# Start dev server
npm run dev

# In browser:
# 1. Go to Homebrew Library
# 2. Create a homebrew item (or use existing)
# 3. Click image generation button
# 4. Watch worker terminal for "[ImageGen]" logs
```

**Step 3: If ComfyUI not available and no cloud API key, add fal.ai provider**

If fal.ai key exists in credentials.env, add as a provider in `image-generation.ts` between ComfyUI and Replicate:

```typescript
import * as fal from '@fal-ai/serverless-client';

async function generateWithFal(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const start = Date.now();
  const prompt = request.prompt || buildPrompt(request.type, request.name, request.description, request.imagePromptHint);

  fal.config({ credentials: process.env.FAL_KEY! });

  const result = await fal.subscribe('fal-ai/flux/dev', {
    input: { prompt, image_size: 'square_hd' },
  }) as { images: Array<{ url: string }> };

  const imageUrl = result.images[0]?.url;
  if (!imageUrl) throw new Error('fal.ai returned no image');

  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!imgRes.ok) throw new Error(`Failed to fetch fal.ai image: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const key = storageKey(request.userId, resolveEntityId(request));
  const url = await storage.upload(key, buffer, 'image/png');

  return {
    url,
    provider: 'fal' as any,
    metadata: { prompt, generationTimeMs: Date.now() - start, model: 'flux-dev', width: 1024, height: 1024 },
  };
}
```

Add to providers array:
```typescript
{
  name: 'fal',
  enabled: !!process.env.FAL_KEY,
  fn: () => generateWithFal(request),
},
```

**Step 4: Test NPC portrait generation**

In browser: Go to an NPC detail page, click generate portrait button. Verify image appears.

**Step 5: Commit if changes made**

```bash
git add src/lib/ai/image-generation.ts
git commit -m "feat(images): add fal.ai as image generation provider (Flux Dev)"
```

---

### Task 4: Ollama Test Agent

**Files:**
- Create: `deploy/ollama/Modelfile.test`
- Modify: `src/lib/ai/extraction.ts` (add test provider shortcut for dev)

**Step 1: Create Modelfile**

```dockerfile
FROM tinyllama
SYSTEM You are a test agent for QuiverDM. When asked to extract D&D content, return valid JSON matching the requested schema with placeholder values. For monsters: {"name":"Test Monster","size":"Medium","type":"beast","alignment":"neutral","ac":13,"hp":45,"speed":"30 ft.","abilities":{"str":14,"dex":12,"con":13,"int":2,"wis":10,"cha":5},"cr":"2","actions":[{"name":"Bite","desc":"Melee: +4 to hit, 1d8+2 piercing"}],"test_mode":true}. For spells: {"name":"Test Spell","level":1,"school":"evocation","castingTime":"1 action","range":"60 feet","components":"V, S","duration":"Instantaneous","description":"A test spell.","test_mode":true}. For items: {"name":"Test Item","type":"Wondrous item","rarity":"uncommon","requiresAttunement":false,"description":"A test magic item.","test_mode":true}. Always include test_mode:true. Keep responses under 200 tokens.
```

**Step 2: Register model**

```bash
docker exec quiverdm-ollama ollama create quiverdm-test -f /tmp/Modelfile.test
```

(Copy Modelfile into container first: `docker cp deploy/ollama/Modelfile.test quiverdm-ollama:/tmp/`)

**Step 3: Verify model responds**

```bash
docker exec quiverdm-ollama ollama run quiverdm-test "Extract this monster: Goblin, Small humanoid, AC 15, HP 7"
```

**Step 4: Commit**

```bash
git add deploy/ollama/Modelfile.test
git commit -m "feat(dev): add Ollama test agent for pipeline testing"
```

---

### Task 5: Create Pages Audit + Missing PostHog Events

**Files:**
- Modify: `src/server/routers/npcs.ts` (add PostHog tracking for NPC creation)
- Modify: `src/lib/analytics-events.ts` (add NPC_CREATED event)
- Test: Manual browser walkthrough of every create flow

**Step 1: Add NPC_CREATED event**

In `src/lib/analytics-events.ts`:

```typescript
export const EVENTS = {
  CAMPAIGN_CREATED: 'campaign_created',
  SESSION_STARTED: 'session_started',
  PDF_UPLOADED: 'pdf_uploaded',
  TRANSCRIPTION_STARTED: 'transcription_started',
  HOMEBREW_CREATED: 'homebrew_created',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  NPC_CREATED: 'npc_created',
} as const;
```

**Step 2: Track NPC creation**

In `src/server/routers/npcs.ts`, find the create mutation and add:

```typescript
import { serverTrack } from '@/lib/analytics.server';
import { EVENTS } from '@/lib/analytics-events';

// Inside create mutation, after successful creation:
void serverTrack(ctx.session.user.id, EVENTS.NPC_CREATED, { campaign_id: campaignId });
```

**Step 3: Manual audit checklist**

Run through each flow in browser and verify:

- [ ] Campaign create → redirects to `/campaigns/{slug}` — banner visible
- [ ] NPC create → redirects to `/campaigns/{slug}/npcs/{id}` — portrait visible
- [ ] Character create → redirects to `/characters/{id}` — all 5 tabs work
- [ ] Session create → redirects to prep wizard
- [ ] Homebrew create dialog → item appears in library
- [ ] Homebrew PDF upload → processing starts, items extracted
- [ ] Obsidian import → campaign created with imported content
- [ ] All mobile viewports (set Chrome to 390x844) — touch targets >= 44px

**Step 4: Commit**

```bash
git add src/lib/analytics-events.ts src/server/routers/npcs.ts
git commit -m "feat(analytics): track NPC creation in PostHog"
```

---

### Task 6: Style Cards — Design System Documentation

**Files:**
- Create: `docs/design-system/colors.md`
- Create: `docs/design-system/typography.md`
- Create: `docs/design-system/components.md`
- Create: `docs/design-system/patterns.md`
- Create: `docs/design-system/anti-patterns.md`
- Reference: `src/app/globals.css` (CSS variables)
- Reference: `CLAUDE.md` (design system section)
- Reference: `src/components/ui/` (shadcn inventory)

**Step 1: Extract color tokens from globals.css**

Read `src/app/globals.css`, document all CSS variables in `docs/design-system/colors.md`:
- Background layers (base, card, popover)
- Foreground / muted
- Primary (amber/gold) + secondary
- Destructive
- Border / ring / input
- Custom: glass-panel opacity values

**Step 2: Document typography**

In `docs/design-system/typography.md`:
- Display font (font-display class)
- Body font (system stack)
- Mono font (JetBrains Mono — dice rolls, stats)
- Size scale (text-xs through text-4xl usage patterns)

**Step 3: Component inventory**

In `docs/design-system/components.md`:
- List all shadcn components in `src/components/ui/`
- Note which are actively used vs installed but unused
- Key patterns: Button variants, Card, Dialog, Select, Input, Textarea, Badge, Tabs

**Step 4: Layout patterns**

In `docs/design-system/patterns.md`:
- `CreatePageShell` — split layout (form left, preview right on desktop)
- `glass-panel` + `glass-grain` — card styling with noise texture
- `section-rule` — amber divider between sections
- `label-overline` — small uppercase section labels
- Campaign card pattern (banner + gradient fallback + stats footer)
- Collapsible stat block pattern (NPC create)

**Step 5: Anti-patterns**

In `docs/design-system/anti-patterns.md`:
- Copy from CLAUDE.md design system section
- Add examples of what NOT to do (with code snippets)
- Reference BG3 / D&D Beyond as inspiration sources

**Step 6: Commit**

```bash
git add docs/design-system/
git commit -m "docs: add design system style cards for UI 2.0 prep"
```
