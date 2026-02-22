# Feature 5: Visual Homebrew Assets

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend existing image generation to support prompt templates (npc/location/handout/item), attach images to NPCs, add image gallery tab on homebrew + NPC pages, and optionally route through ComfyUI.

**Architecture:** Extend existing `homebrew-image.ts` router and `ImageGenerationJob` model. Add `imageUrl`/`imageJobId` to `NPC` and `HomebrewContent`. New `generateForNpc` procedure. Gallery component reuses existing `getJobStatus` polling. `src/lib/ai/comfyui.ts` already exists — wire it via `COMFYUI_URL` env check in the image worker.

**Tech Stack:** Prisma, tRPC, BullMQ, existing `image-generation-worker.ts`, shadcn/ui, React

---

## Task 1: Schema — imageUrl + imageJobId on NPC and HomebrewContent

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add fields**

In `model NPC`, add before `createdAt`:
```prisma
imageUrl   String?
imageJobId String?
```

In `model HomebrewContent`, add before `createdAt`:
```prisma
imageUrl   String?
imageJobId String?
```

**Step 2:**
```bash
npm run db:push
git add prisma/schema.prisma
git commit -m "feat(schema): add imageUrl + imageJobId to NPC and HomebrewContent"
```

---

## Task 2: Check existing ComfyUI integration

**Files:**
- Read: `src/lib/ai/comfyui.ts`
- Read: `src/lib/queue/image-generation-worker.ts`

**Step 1: Read comfyui.ts** to understand existing interface, then read the worker to see how it selects providers.

**Step 2: Confirm the worker checks `COMFYUI_URL`**

In `image-generation-worker.ts`, find where the image generation provider is selected. If not already there, add:

```typescript
// At the top of the worker's process function:
const comfyUrl = process.env.COMFYUI_URL;
if (comfyUrl) {
  // Use ComfyUI
  // import generateWithComfyUI from '@/lib/ai/comfyui'
  result = await generateWithComfyUI({ prompt: builtPrompt, comfyUrl });
} else {
  // Use existing Ollama/default flow
}
```

If the ComfyUI module already has a compatible export, just wire it in. If not, add a stub that logs and falls through to Ollama.

**Step 3:**
```bash
git add src/lib/queue/image-generation-worker.ts
git commit -m "feat(worker): route image gen through ComfyUI when COMFYUI_URL is set"
```

---

## Task 3: Prompt Templates + generateForNpc in homebrew-image router

**Files:**
- Modify: `src/server/routers/homebrew-image.ts`

**Step 1: Add prompt templates**

Add a constant at the top of the router file:

```typescript
const PROMPT_TEMPLATES: Record<string, string> = {
  npc: 'Fantasy character portrait, detailed face, dramatic lighting, oil painting style, D&D 5e aesthetic',
  location: 'Fantasy environment concept art, wide establishing shot, atmospheric lighting, detailed architecture',
  handout: 'Aged parchment document, fantasy script, decorative border, sepia tones, prop design',
  item: 'Fantasy item product shot, magical glow, dark background, detailed textures, treasure art style',
  creature: 'Monster illustration, full body, dramatic pose, dark fantasy style, detailed anatomy',
  spell: 'Magical spell effect, ethereal energy, colorful particle effects, dynamic composition',
};
```

**Step 2: Add `generateForNpc` procedure**

Append to the `homebrewImageRouter` object:

```typescript
generateForNpc: protectedProcedure
  .input(z.object({
    npcId: z.string(),
    prompt: z.string().max(500).optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.session.user.id;

    const npc = await prisma.npc.findUnique({
      where: { id: input.npcId },
      include: { campaign: { select: { userId: true } } },
    });
    if (!npc) throw new NotFoundError('npc', input.npcId);

    // Check user is campaign owner or DM
    const member = await prisma.campaignMember.findFirst({
      where: { campaignId: npc.campaignId, userId, role: { in: ['OWNER', 'CO_DM'] } },
    });
    if (!member && npc.campaign.userId !== userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only DMs can generate NPC images' });
    }

    const { allowed, remaining, limit } = await checkImageGenerationLimit(userId);
    if (!allowed) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `Image generation limit reached (${limit}/month).` });
    }

    const job = await prisma.imageGenerationJob.create({
      data: {
        userId,
        prompt: input.prompt || PROMPT_TEMPLATES.npc,
        provider: 'auto',
        status: 'queued',
        // Note: homebrewId is required by schema — create a null-safe approach
        // If homebrewId is not nullable, store npcId in metadata field or use a placeholder
        homebrewId: 'npc-placeholder', // adjust based on actual schema
      },
    });

    // Store npcId reference for the worker
    await addImageGenerationJob({
      jobId: job.id,
      homebrewId: npc.id, // reuse field for NPC id
      userId,
      type: 'npc',
      name: npc.name,
      description: npc.description ?? undefined,
      imagePromptHint: input.prompt || PROMPT_TEMPLATES.npc,
      customPrompt: input.prompt,
    });

    // Update NPC with pending job ID
    await prisma.npc.update({ where: { id: npc.id }, data: { imageJobId: job.id } });

    return { jobId: job.id, remaining: remaining - 1, limit };
  }),

getJobStatus: protectedProcedure
  .input(z.object({ jobId: z.string() }))
  .query(async ({ input, ctx }) => {
    const job = await prisma.imageGenerationJob.findUnique({ where: { id: input.jobId } });
    if (!job) throw new NotFoundError('image job', input.jobId);
    return job;
  }),
```

Note: Read the current `ImageGenerationJob` model carefully. If `homebrewId` is required and non-nullable, you may need to add a nullable `npcId` field to the schema instead. Check and adjust accordingly.

**Step 3:**
```bash
git add src/server/routers/homebrew-image.ts
git commit -m "feat(router): add generateForNpc + prompt templates to homebrew-image router"
```

---

## Task 4: Image Gallery Component

**Files:**
- Create: `src/components/homebrew/image-gallery.tsx`

**Step 1: Create component**

```tsx
'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Loader2, ImageIcon, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface ImageGalleryProps {
  entityType: 'homebrew' | 'npc';
  entityId: string;
  currentImageUrl?: string | null;
  currentJobId?: string | null;
  canGenerate: boolean;
  entityName: string;
  onImageUpdate?: (imageUrl: string) => void;
}

export function ImageGallery({
  entityType, entityId, currentImageUrl, currentJobId, canGenerate, entityName, onImageUpdate,
}: ImageGalleryProps) {
  const utils = trpc.useUtils();

  const { data: jobStatus, isLoading: jobLoading } = trpc.homebrewImage.getJobStatus.useQuery(
    { jobId: currentJobId! },
    {
      enabled: !!currentJobId,
      refetchInterval: (d) => {
        const status = d?.state?.data?.status;
        return status === 'queued' || status === 'processing' ? 2000 : false;
      },
    }
  );

  const generateMutation = (entityType === 'homebrew'
    ? trpc.homebrewImage.generateImage
    : trpc.homebrewImage.generateForNpc
  ).useMutation({
    onError: (e) => toast.error(e.message),
  });

  const isGenerating = jobStatus?.status === 'queued' || jobStatus?.status === 'processing';
  const displayImageUrl = jobStatus?.resultUrl ?? currentImageUrl;

  return (
    <div className="space-y-3">
      {displayImageUrl ? (
        <div className="relative group rounded-lg overflow-hidden border">
          <Image
            src={displayImageUrl}
            alt={entityName}
            width={512}
            height={512}
            className="w-full object-cover max-h-64"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <a href={displayImageUrl} download>
              <Button size="sm" variant="secondary"><Download className="h-3 w-3 mr-1" /> Download</Button>
            </a>
            {canGenerate && (
              <Button size="sm" variant="secondary" onClick={() => generateMutation.mutate(
                entityType === 'homebrew' ? { homebrewId: entityId } : { npcId: entityId } as any
              )}>
                <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="h-48 rounded-lg border border-dashed flex items-center justify-center bg-muted/30">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Generating image…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
              <p className="text-sm">No image yet</p>
            </div>
          )}
        </div>
      )}

      {canGenerate && !isGenerating && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={generateMutation.isPending}
          onClick={() => generateMutation.mutate(
            entityType === 'homebrew' ? { homebrewId: entityId } : { npcId: entityId } as any
          )}
        >
          {generateMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          {displayImageUrl ? 'Regenerate' : 'Generate'} Image
        </Button>
      )}
    </div>
  );
}
```

**Step 2:**
```bash
git add src/components/homebrew/image-gallery.tsx
git commit -m "feat(component): add ImageGallery with polling, download, regenerate"
```

---

## Task 5: Wire ImageGallery into NPC detail page

**Files:**
- Modify or locate: NPC detail page (likely `src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx` or rendered via a sheet/dialog)

**Step 1:** Find where NPC details are displayed. Import and add `ImageGallery`:

```typescript
import { ImageGallery } from '@/components/homebrew/image-gallery';
```

```tsx
<ImageGallery
  entityType="npc"
  entityId={npc.id}
  currentImageUrl={npc.imageUrl}
  currentJobId={npc.imageJobId}
  canGenerate={isDM}
  entityName={npc.name}
/>
```

**Step 2:**
```bash
git add src/app/\(app\)/campaigns/\[slug\]/npcs/
git commit -m "feat(ui): add image gallery to NPC detail page"
```

---

## Task 6: Wire ImageGallery into Homebrew detail page

**Files:**
- Modify: homebrew content detail page or card component

**Step 1:** Find the homebrew content detail view. Import and add `ImageGallery`:

```tsx
<ImageGallery
  entityType="homebrew"
  entityId={homebrew.id}
  currentImageUrl={homebrew.imageUrl}
  currentJobId={homebrew.imageJobId}
  canGenerate={isOwner}
  entityName={homebrew.name}
/>
```

**Step 2:**
```bash
git add src/app/\(app\)/homebrew/ src/components/homebrew/
git commit -m "feat(ui): add image gallery to homebrew content detail"
```

---

## Task 7: Type check

```bash
npx tsc --noEmit
git add -A && git commit -m "feat: Feature 5 — visual homebrew assets complete"
```
