# Phase 3: Cloud AI Fallback - Planning Document

## Overview

Provide image generation for users without GPU via Replicate (Stable Diffusion XL) or DALL-E 3.

**Goal:** Ensure all users can generate images, with tiered usage limits and cost tracking.

**Timeline:** Week 5 (7 days)

## Objectives

1. ✅ Replicate SDXL integration
2. ✅ DALL-E 3 integration
3. ✅ Provider selection logic with fallback chain
4. ✅ Usage tracking per user
5. ✅ Tier-based limits enforcement
6. ✅ Cost estimation and tracking

## Architecture Design

### Provider Fallback Chain

```
User requests generation
    ↓
Check tier limits → Reject if exceeded
    ↓
Try ComfyUI (if enabled + healthy)
    ↓ [fails or unavailable]
Try Replicate SDXL (if API key configured)
    ↓ [fails or unavailable]
Try DALL-E 3 (if API key configured)
    ↓ [all fail]
Return error to user
```

### Tier Limits

| Tier | Images/Month | Cloud Provider | Cost/Image |
|------|--------------|----------------|------------|
| Free | 10 | Replicate SDXL | $0.002-$0.02 |
| Pro | 100 | Replicate SDXL | $0.002-$0.02 |
| Team | Unlimited* | Replicate SDXL | $0.002-$0.02 |

*Soft limit of 1000/month with email notification

### Cost Estimates

**Replicate SDXL:**
- $0.0023/second compute
- ~10 seconds per image = $0.023/image
- Free tier budget: $0.23/month (10 images)
- Pro tier budget: $2.30/month (100 images)

**DALL-E 3:**
- Standard 1024x1024: $0.040/image
- HD 1024x1024: $0.080/image
- Use only as last resort fallback

## Files to Modify/Create

### 1. `src/lib/ai/image-generation.ts` (MODIFY)

Add provider implementations:

```typescript
/**
 * Generate image using Replicate SDXL
 */
async function generateWithReplicate(
  request: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_KEY,
  });

  const prompt = buildPrompt(request.type, request.name, request.description);

  const output = await replicate.run(
    "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
    {
      input: {
        prompt,
        negative_prompt: "nsfw, gore, violence, low quality, blurry",
        width: 1024,
        height: 1024,
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
    }
  );

  // Download image from Replicate URL
  const imageUrl = Array.isArray(output) ? output[0] : output;
  const response = await fetch(imageUrl as string);
  const buffer = Buffer.from(await response.arrayBuffer());

  // Store via storage abstraction
  const storageKey = generateImageStorageKey(request);
  const finalUrl = await storage.upload(storageKey, buffer, 'image/png');

  return {
    url: finalUrl,
    provider: 'replicate',
    metadata: {
      prompt,
      generationTimeMs: 0, // Replicate doesn't provide this
      model: 'sdxl',
    },
  };
}

/**
 * Generate image using DALL-E 3
 */
async function generateWithDALLE(
  request: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = buildPrompt(request.type, request.name, request.description);

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "standard", // or "hd" for $0.080
  });

  const imageUrl = response.data[0].url;
  if (!imageUrl) {
    throw new Error('DALL-E returned no image URL');
  }

  // Download image
  const imageResponse = await fetch(imageUrl);
  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  // Store via storage abstraction
  const storageKey = generateImageStorageKey(request);
  const finalUrl = await storage.upload(storageKey, buffer, 'image/png');

  return {
    url: finalUrl,
    provider: 'dalle',
    metadata: {
      prompt,
      generationTimeMs: 0,
      model: 'dall-e-3',
    },
  };
}

/**
 * Main generation function with provider selection
 */
export async function generateImage(
  request: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const startTime = Date.now();

  // Try providers in order
  const providers: Array<{
    name: string;
    enabled: boolean;
    generate: () => Promise<ImageGenerationResult>;
  }> = [
    {
      name: 'comfyui',
      enabled: process.env.COMFYUI_ENABLED === 'true',
      generate: () => generateWithComfyUI(request),
    },
    {
      name: 'replicate',
      enabled: !!process.env.REPLICATE_API_KEY,
      generate: () => generateWithReplicate(request),
    },
    {
      name: 'dalle',
      enabled: !!process.env.OPENAI_API_KEY,
      generate: () => generateWithDALLE(request),
    },
  ];

  const errors: Array<{ provider: string; error: string }> = [];

  for (const provider of providers) {
    if (!provider.enabled) {
      continue;
    }

    try {
      console.log(`[ImageGen] Trying ${provider.name}...`);
      const result = await provider.generate();
      console.log(`[ImageGen] Success with ${provider.name} (${Date.now() - startTime}ms)`);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ImageGen] ${provider.name} failed: ${errorMsg}`);
      errors.push({ provider: provider.name, error: errorMsg });
    }
  }

  // All providers failed
  throw new Error(
    `All image generation providers failed: ${errors.map((e) => `${e.provider}: ${e.error}`).join('; ')}`
  );
}
```

### 2. `src/server/services/usage-tracking.service.ts` (CREATE)

**Purpose:** Track and enforce tier limits

```typescript
import { prisma } from '@/lib/prisma';
import { NotFoundError, ForbiddenError } from '@/server/errors';

interface UsageLimits {
  imagesPerMonth: number;
  isUnlimited: boolean;
}

const TIER_LIMITS: Record<string, UsageLimits> = {
  free: {
    imagesPerMonth: 10,
    isUnlimited: false,
  },
  pro: {
    imagesPerMonth: 100,
    isUnlimited: false,
  },
  team: {
    imagesPerMonth: 1000,
    isUnlimited: true, // Soft limit with notification
  },
};

/**
 * Check if user can generate more images this month
 */
export async function checkImageGenerationLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });

  if (!user) {
    throw new NotFoundError('user', userId);
  }

  const limits = TIER_LIMITS[user.tier] || TIER_LIMITS.free;

  // Get current month usage
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const usage = await prisma.imageGenerationJob.count({
    where: {
      userId,
      status: 'completed',
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
  });

  const remaining = Math.max(0, limits.imagesPerMonth - usage);
  const allowed = limits.isUnlimited || remaining > 0;

  return {
    allowed,
    remaining,
    limit: limits.imagesPerMonth,
  };
}

/**
 * Increment usage for a user
 */
export async function recordImageGeneration(
  userId: string,
  provider: string,
  cost: number
) {
  // Record in ImageGenerationJob (already tracked)
  // Optionally: aggregate in UserUsage table

  console.log(`[Usage] User ${userId} generated image via ${provider}, cost: $${cost.toFixed(4)}`);
}

/**
 * Get cost estimate for a generation
 */
export function estimateGenerationCost(provider: string): number {
  const costs: Record<string, number> = {
    comfyui: 0,       // Free (local)
    replicate: 0.023, // ~$0.023 per image
    dalle: 0.040,     // $0.040 for standard quality
  };

  return costs[provider] || 0;
}

/**
 * Get monthly cost for a user
 */
export async function getMonthlyCost(userId: string): Promise<number> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const jobs = await prisma.imageGenerationJob.findMany({
    where: {
      userId,
      status: 'completed',
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    select: {
      provider: true,
    },
  });

  return jobs.reduce((total, job) => {
    return total + estimateGenerationCost(job.provider);
  }, 0);
}
```

### 3. `src/server/routers/homebrew-image.ts` (MODIFY)

Add usage checks to `generateImage` mutation:

```typescript
generateImage: protectedProcedure
  .input(z.object({
    homebrewId: z.string(),
    prompt: z.string().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.session.user.id;

    // Check tier limits
    const { allowed, remaining, limit } = await checkImageGenerationLimit(userId);

    if (!allowed) {
      throw ForbiddenError.forTierLimit('image generation', limit);
    }

    // Get homebrew item
    const homebrew = await prisma.homebrewContent.findUnique({
      where: { id: input.homebrewId },
      select: { userId: true, type: true, name: true, data: true },
    });

    if (!homebrew || homebrew.userId !== userId) {
      throw new ForbiddenError('You do not have permission to generate images for this content');
    }

    // Create generation job
    const job = await prisma.imageGenerationJob.create({
      data: {
        homebrewId: input.homebrewId,
        userId,
        prompt: input.prompt || '',
        provider: 'auto', // Will be determined by worker
        status: 'queued',
      },
    });

    // Enqueue for processing
    await imageGenerationQueue.add('generate-image', {
      jobId: job.id,
      homebrewId: input.homebrewId,
      userId,
      type: homebrew.type,
      name: homebrew.name,
      description: homebrew.data?.description,
      customPrompt: input.prompt,
    });

    return {
      jobId: job.id,
      remainingGenerations: remaining - 1,
    };
  }),
```

### 4. Environment Variables

Add to `.env.example`:

```bash
# Cloud Image Generation
REPLICATE_API_KEY=your_replicate_api_key_here
# OPENAI_API_KEY already exists
IMAGE_GENERATION_DEFAULT_PROVIDER=comfyui
```

### 5. Update Worker (src/lib/queue/image-generation-worker.ts)

Modify to use new `generateImage()` function with automatic fallback.

## Implementation Sequence

### Day 1-2: Replicate Integration

1. Install Replicate SDK: `npm install replicate`
2. Implement `generateWithReplicate()`
3. Test with API key
4. Benchmark generation time and quality

### Day 3-4: DALL-E Integration

1. Verify OpenAI SDK is installed
2. Implement `generateWithDALLE()`
3. Test with API key
4. Compare quality vs Replicate

### Day 5: Usage Tracking

1. Create `usage-tracking.service.ts`
2. Implement tier limits
3. Add cost estimation
4. Test limit enforcement

### Day 6-7: Integration + Testing

1. Update worker to use provider fallback
2. Update tRPC router with usage checks
3. End-to-end testing
4. Cost monitoring dashboard (admin)

## Testing Strategy

### Unit Tests

- Provider fallback chain logic
- Usage limit calculations
- Cost estimation accuracy

### Integration Tests

- Replicate API calls with real API key
- DALL-E API calls with real API key
- Usage tracking increments correctly
- Tier limits enforced

### Manual Tests

1. **Free tier user:**
   - Generate 10 images successfully
   - 11th generation rejected with clear error

2. **Pro tier user:**
   - Generate 100 images successfully
   - 101st generation rejected

3. **Fallback testing:**
   - Disable ComfyUI → falls back to Replicate
   - Disable Replicate → falls back to DALL-E
   - Disable all → clear error message

### Cost Monitoring

Track actual costs for 1 week:
- Count generations by provider
- Calculate total cost
- Compare to estimates

## Critical Considerations

1. **API Key Security:** Never commit API keys to repo
2. **Rate Limits:** Replicate/OpenAI have rate limits
3. **Cost Control:** Set budget alerts in Replicate/OpenAI
4. **Quality Variance:** Different providers = different styles
5. **Latency:** Cloud providers may be slower than local ComfyUI

## Success Metrics

- [ ] Replicate SDXL generates quality D&D images
- [ ] DALL-E generates quality D&D images
- [ ] Fallback chain works correctly
- [ ] Usage limits enforced per tier
- [ ] Cost tracking accurate
- [ ] No API key leaks
- [ ] Average generation time <60 seconds

## Risk Assessment

**High Risk:**
- API cost overruns (set budget limits)
- API key exposure (use environment variables)
- Rate limit errors (implement exponential backoff)

**Mitigation:**
- Set Replicate budget limit ($50/month)
- Never log API keys
- Implement retry with backoff
- Monitor costs daily during beta

## Questions to Resolve

1. Should we allow users to choose provider?
2. HD quality for DALL-E worth 2x cost?
3. How to handle NSFW filter rejections?
4. Should we cache/reuse generated images?
5. Email notifications when limit reached?

## Next Phase Dependencies

**Blocks:** Phase 4 (UI) - needs working generation endpoint

**Requires:** Phase 2 complete - ComfyUI integration done
