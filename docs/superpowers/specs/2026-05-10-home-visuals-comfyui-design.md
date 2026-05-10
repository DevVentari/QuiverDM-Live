# Home Page Visuals — ComfyUI-Backed Test Campaign Design

**Status:** approved 2026-05-10
**Source:** desktop V2 home mockup (Stonewardens / Shattered Spire), shared 2026-05-10

## Goal

Light up the V2 home page with real images for a Hameria-Ire test campaign, generated locally via ComfyUI. The home page already renders three image surfaces (hero banner, campaign emblem placeholder, world activity icons) but none of them resolve to actual artwork. This spec adds:

1. The schema fields the components need
2. A minimal Hameria-Ire bootstrap so the home page has something to show
3. A ComfyUI-only image-generation pipeline (no fallback to paid providers)
4. DM-only hover-to-regenerate overlays on each image surface

The end result: a DM viewing `/` (home) on a Hameria-Ire campaign sees a styled, image-rich layout matching the mockup, and can click any image to regenerate it via the local ComfyUI container.

## Non-goals

- Generating images for sessions, items, encounters, or any non-home-visible entity (deferred — see "Future scope")
- Replacing the Lucide-icon fallback in WorldActivityFeed for users without ComfyUI
- Rolling this out to production users (pre-beta dev tooling only)
- A bulk "generate everything" admin tool (per-asset regeneration only for now)

## Architecture

### Schema additions

```prisma
model Campaign {
  bannerUrl  String?  // exists
  emblemUrl  String?  // NEW — heraldic crest, square
}

model WorldEntity {
  imageUrl   String?  // NEW — square thumbnail
}

model WorldEntry {
  imageUrl   String?  // NEW — square thumbnail
}

// NPC.imageUrl already exists, reused as-is
```

Single migration. No data backfill — every new column is nullable.

### Bootstrap: minimal Hameria-Ire seed

New script: `scripts/seed-hameria-ire-min.ts`

- Loads `.env.local` first (per the dotenv-config-local memory)
- Reads `docs/hameria-ire-jsons/NPCs.json`, `Locations.json`, `Factions.json`
- Upserts:
  - 1 `Campaign` row with slug `tales-from-the-bonfire-keep`, owner = `User` matching `ADMIN_EMAILS[0]`
  - 1 `CampaignMember` (OWNER role) for that user
  - 3-5 `NPC` rows (the most prominent NPCs from the JSON)
  - 3-5 `WorldEntity` rows (LOCATION type) from Locations.json
  - 1-2 `WorldEntity` rows (FACTION type) from Factions.json
- Idempotent: re-running upserts on `(campaignId, name, type)` for WorldEntity, on `(campaignId, name)` for NPC
- All image fields left null — they get populated by the regenerate flow

Why minimal: the home page reads at most 5 World Activity items + the active campaign + recent sessions. We don't need the full Hameria-Ire content tree to demonstrate the styling.

### ComfyUI-only generation flag

Edit `src/lib/ai/image-generation.ts`:

- Add optional field on `ImageGenerationRequest`: `providersAllowed?: ImageGenerationResult['provider'][]`
- In `generateImage()`, filter the `providers` array by `providersAllowed` before iteration. If the filtered list is empty after availability checks, throw a typed `ComfyUIUnavailableError` (or `ProviderUnavailableError` keyed to the requested set) with a message that names the missing provider so the worker can surface it.
- The existing fallback behavior is unchanged when `providersAllowed` is absent.

### ComfyUI workflow: Flux.2

The current `buildTxt2ImgWorkflow` in `src/lib/ai/comfyui.ts` is hard-coded for SDXL (`CheckpointLoaderSimple` + `KSampler` + standard CLIP). Flux.2 uses a different node graph:

- `UNETLoader` (loads the Flux UNET checkpoint, e.g. `flux2-dev.safetensors` or whichever Flux.2 variant we install)
- `DualCLIPLoader` (Flux uses two CLIP models: `clip_l` + `t5xxl`)
- `VAELoader` (Flux ships its own VAE)
- `EmptySD3LatentImage` (Flux uses SD3-style latents, not SDXL)
- `BasicGuider` + `KSamplerSelect` + `BasicScheduler` + `SamplerCustomAdvanced` (Flux's recommended sampler stack)
- `VAEDecode` + `SaveImage` (unchanged)

Plan:

- Add `buildFluxTxt2ImgWorkflow(prompt, negativePrompt, seed, width, height)` alongside the existing SDXL workflow. Keep SDXL builder intact for back-compat; the visual-asset worker calls the Flux builder explicitly.
- Drive checkpoint name from `COMFYUI_MODEL` env (existing). Default updated in `.env.example` to a Flux.2 filename — e.g. `flux2-dev.safetensors` — once the model is installed in the ComfyUI volume.
- Flux supports negative prompts only via guidance distillation tricks; for v1 we omit negative prompt (Flux pipelines typically pass `""`) and rely on positive-prompt steering.
- Step count + cfg differ: Flux.2 typical defaults are `steps: 28`, `cfg/guidance: 3.5` (vs SDXL's `steps: 20, cfg: 7`). Encode in the builder.

Model installation is a one-time ops step — drop `flux2-dev.safetensors` (and the matching CLIP + VAE files) into the `comfyui_models` Docker volume per the ai-dock/comfyui directory layout (`models/unet/`, `models/clip/`, `models/vae/`). Out of scope for the code spec but flagged in deploy notes.

### Visual-asset queue

New BullMQ queue + worker following the `quiverdm-worker` skill pattern.

- Queue file: `src/lib/queue/visual-asset-queue.ts`
- Worker file: `src/lib/queue/visual-asset-worker.ts`
- npm script: `worker:visual-assets`
- Job payload:
  ```ts
  type VisualAssetJob =
    | { kind: 'campaign-banner';   campaignId: string; userId: string }
    | { kind: 'campaign-emblem';   campaignId: string; userId: string }
    | { kind: 'world-activity-thumb';
        source: 'WorldEntity' | 'NPC' | 'WorldEntry';
        id: string;
        userId: string;
      }
  ```
- Worker logic:
  1. Read the target row to get `name`, `type`, `description` (and `aliases`/`properties` for entities)
  2. Build a kind-specific prompt (see "Prompt strategy" below)
  3. Call `generateImage({ ...request, providersAllowed: ['comfyui'] })`
  4. On success, write the resulting URL into the right column (`Campaign.bannerUrl|emblemUrl`, `WorldEntity.imageUrl`, `NPC.imageUrl`, `WorldEntry.imageUrl`)
  5. On `ComfyUIUnavailableError`, mark the job failed with a clear error message — BullMQ retries are off (`attempts: 1`) since it's a user-initiated action, not a background backfill

Why a new queue rather than reusing the homebrew/NPC image worker: the existing workers are scoped to a single entity type and a different prompt-construction path. Cleaner to add a small focused worker than to graft three new job shapes onto an existing one.

### Prompt strategy

All prompts share the global negative prompt and image dimensions are kind-specific.

- **campaign-banner** (1280×640, landscape):
  > `D&D 5e fantasy art, atmospheric landscape, [campaign.name], [campaign.description (first 200 chars)], dramatic lighting, deep indigo and amber palette, cinematic wide composition, high quality digital painting`
- **campaign-emblem** (512×512, square):
  > `heraldic shield emblem, fantasy crest, ornate metalwork, gold and dark steel, [campaign.name] sigil, centered composition, plain background, vector-style illustration`
- **world-activity-thumb** for `NPC` / `WorldEntity:NPC` / `WorldEntity:PC` (256×256, square):
  > `D&D 5e character portrait, [name], [description], dramatic lighting, square crop, head-and-shoulders framing`
- **world-activity-thumb** for `WorldEntity:LOCATION` / `WorldEntry:LOCATION` (256×256):
  > `D&D 5e fantasy environment, [name], [description], moody lighting, square crop, establishing shot`
- **world-activity-thumb** for `WorldEntity:FACTION` / `WorldEntity:THREAT` / other (256×256):
  > `D&D 5e fantasy concept art, [type] sigil for [name], [description], dramatic lighting, square crop`

ComfyUI's `buildTxt2ImgWorkflow` already accepts width/height — we extend it to accept these per-call.

### tRPC surface

All three procedures use `campaignDMProcedure` (DM-only access) and a per-user rate limit of 10 generations/minute (reuse the rate-limit helper).

- `campaigns.regenerateBanner({ campaignId }) → { jobId }` — enqueue `campaign-banner`
- `campaigns.regenerateEmblem({ campaignId }) → { jobId }` — enqueue `campaign-emblem`
- `world.regenerateActivityImage({ source, id }) → { jobId }`
  - The procedure verifies the target row belongs to the calling user's campaign before enqueueing
  - Returns `404` if the source/id doesn't resolve

None of these block on generation — they enqueue and return immediately. The UI polls.

### Production gating

These three mutations are dev-tooling for now. Gate them at the procedure level:

```ts
if (process.env.NODE_ENV === 'production' && !ADMIN_EMAILS.includes(ctx.session.user.email)) {
  throw new ForbiddenError(...)
}
```

We can lift this guard once we decide on a real prod image strategy.

### `getRecentActivity` extension

`src/server/routers/world.ts:56` — extend each `select` to include the entity's `imageUrl` (or `bannerUrl` for entities that use that name) and forward it on `WorldActivityItem` as `imageUrl?: string | null`.

### Component wiring

#### HomeHero (`src/components/home/HomeHero.tsx`)

- Add `isDM?: boolean` and `onRegenerate?: () => void` props (or use the trpc hook directly inside the component, since we already have the campaign context)
- Wrap the `<Image>` in a `group` div. When `isDM`, render a top-right pill button (`↻ Regenerate banner`) that's hidden by default and revealed on `group-hover`
- Click → call `regenerateBanner.mutate({ campaignId })` → set local `isGenerating` true → start polling the campaign query (5s interval) until `bannerUrl` changes → clear `isGenerating`
- During generation: shimmer overlay across the image area + "Generating banner…" text

#### ActiveCampaignSummary (`src/components/home/ActiveCampaignSummary.tsx`)

- Add `emblemUrl?: string | null` and `isDM?: boolean` props
- When `emblemUrl` is set, replace the Lucide `Shield` with `<Image>` filling the existing 14×14 square slot
- When `isDM`, hovering the slot reveals an overlay `↻` icon-button. Click → `regenerateEmblem` mutation → spinner overlay until refetch
- When `emblemUrl` is null, current Shield icon is the placeholder (matches today's behavior)

#### WorldActivityFeed (`src/components/home/WorldActivityFeed.tsx`)

- The query result now includes `imageUrl?: string | null`
- Each row's `<span>` icon box becomes:
  - When `imageUrl` set: `<Image>` thumbnail (32×32)
  - When null: existing Lucide icon (current behavior)
- When DM (campaign membership context already available via `useCampaign()`), hovering a row reveals a small `↻` button to the left of the `Pill`
- Click → `regenerateActivityImage` mutation → row's icon box swaps to a spinner until refetch updates the URL

The Lucide icon path stays as the empty-state fallback so non-DM users (or users running without ComfyUI) still see something sensible.

### Storage

Reuses `storage.upload()` (R2 in dev, R2 in prod). Storage keys:

- `campaign-images/banner/{userId}/{campaignId}/{timestamp}.png`
- `campaign-images/emblem/{userId}/{campaignId}/{timestamp}.png`
- `world-activity/{userId}/{campaignId}/{source}/{id}/{timestamp}.png`

Old URLs are not cleaned up — re-generation orphans the previous image. Acceptable for dev; flagged for prod.

### Deploy notes

- New worker `visual-asset-worker` needs to be added to `deploy/homelab/ecosystem.config.cjs` so PM2 picks it up on the next homelab redeploy
- Hetzner deploy is unchanged for now — the visual-asset worker is dev-only until we lift the prod gate

## Tech stack

Next.js 15, tRPC v11, Prisma + PostgreSQL, BullMQ + Redis, ComfyUI (via the existing client at `src/lib/ai/comfyui.ts`), R2 storage, Tailwind + shadcn/ui, Next/Image.

## Test plan

- `tests/workflows/home-visuals.workflow.spec.ts` — DM clicks each regenerate trigger; mock the queue enqueue; verify:
  - The optimistic "generating…" state appears
  - When the (mocked) URL change comes in via refetch, the new image is rendered
  - Non-DM users do not see the regenerate buttons
- Unit test in `src/lib/ai/__tests__/image-generation.test.ts` — `generateImage({ providersAllowed: ['comfyui'] })` rejects when `isComfyUIAvailable()` returns false; the rejection message names ComfyUI explicitly
- Manual smoke test:
  1. Run the bootstrap seed
  2. `docker-compose up -d comfyui`
  3. `npm run worker:visual-assets`
  4. Visit `/` as the seed-owner user
  5. Click each regenerate button, confirm ComfyUI receives the request, image renders within ~60s

## Risks

- **Flux.2 model + supporting files must be installed in the ComfyUI volume** before the worker can run. If the checkpoint/CLIP/VAE files are missing, ComfyUI will return a workflow validation error, not a generation failure — surface that error message verbatim in the worker so the cause is obvious.
- **Flux.2 is heavier than SDXL.** Expect ~1.5-2× the VRAM and ~30-90s per image on consumer GPUs. The `isComfyUIAvailable()` check only verifies the server is up, not that it has enough VRAM for Flux.2 — failures here surface as worker errors, not pre-flight rejections.
- **Heraldic shields are still hard.** Flux.2 is markedly better than SDXL for graphic-design output but isn't a vector tool. Prompt nudges toward "vector-style illustration, flat colors, symmetrical composition" to bias the output. Manual touch-up may still be needed for v1 emblems.
- **20-60s per image.** UI must clearly communicate "in progress" or users will spam-click. Mitigated via the `isGenerating` state + disabled button + shimmer.
- **R2 orphaning.** Re-generating leaves old images in storage. Pre-beta acceptable. Production cleanup is a separate concern.
- **Worker not running locally.** If a DM clicks a button without `worker:visual-assets` running, the job sits forever. Acceptable for dev tooling — the user can `npm run worker:visual-assets` and the existing job will pick up.
- **Prod gate could leak**. The `NODE_ENV === 'production'` check is a soft gate; combine with `ADMIN_EMAILS` membership for defense-in-depth.

## Future scope

- Bulk "generate visuals for all entities in this campaign" admin tool
- Session-card cover art (mockup doesn't render it; would extend RecentSessionsList)
- Entity-detail-page regeneration (when a user opens an NPC/Location detail and wants to refresh its portrait)
- Production rollout: pick a paid provider tier or expose a per-campaign opt-in for ComfyUI-on-homelab
- LoRA / IP-Adapter support on top of Flux.2 — character-consistency LoRAs trained on the campaign's existing portraits, IP-Adapter for style locking across all banners in a campaign
- Image cleanup job: delete orphaned R2 objects when an entity is regenerated or deleted
