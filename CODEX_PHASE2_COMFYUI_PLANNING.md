# Phase 2: ComfyUI Integration - Planning Document

## Overview

Enable free local AI image generation using ComfyUI (requires GPU).

**Goal:** Implement asynchronous image generation workflow that uses local GPU when available.

**Timeline:** Week 3-4 (10 days)

## Objectives

1. ✅ ComfyUI REST client implementation
2. ✅ Image generation abstraction layer
3. ✅ BullMQ queue for async generation
4. ✅ Worker process for generation jobs
5. ✅ Database schema for generation tracking
6. ✅ tRPC router for client access
7. ✅ Docker Compose integration

## Architecture Design

### System Flow

```
User clicks "Generate Image" button
    ↓
tRPC mutation: homebrew-image.generateImage()
    ↓
Service validates request + creates ImageGenerationJob
    ↓
BullMQ enqueues job
    ↓
Worker picks up job → calls ComfyUI API
    ↓
Poll ComfyUI for completion
    ↓
Download generated image → store via storage abstraction
    ↓
Update HomebrewContent.images array
    ↓
WebSocket notification to client
```

### Database Schema

```prisma
model ImageGenerationJob {
  id              String   @id @default(cuid())
  homebrewId      String
  userId          String
  prompt          String   @db.Text
  provider        String   // 'comfyui', 'replicate', 'dalle'
  status          String   @default("queued") // queued, processing, completed, failed
  progress        Int      @default(0)
  workflowId      String?  // ComfyUI workflow/prompt ID
  resultUrl       String?  // Final image URL
  errorMessage    String?
  metadata        Json?    // Provider-specific data
  createdAt       DateTime @default(now())
  completedAt     DateTime?

  @@index([homebrewId, userId, status])
  @@index([status, createdAt])
}
```

### Files to Create

#### 1. `src/lib/ai/comfyui.ts`

**Purpose:** ComfyUI REST API client

**Functions:**
- `checkHealth()` - Test ComfyUI availability
- `queuePrompt(workflow)` - Submit generation job
- `pollStatus(workflowId)` - Check generation progress
- `downloadImage(workflowId)` - Get result image

**Reference:** ComfyUI API docs at https://github.com/comfyanonymous/ComfyUI

**Key considerations:**
- Default endpoint: `http://localhost:8188`
- Timeout handling (generation can take 30-120 seconds)
- Error handling for GPU out-of-memory
- Progress tracking if supported

#### 2. `src/lib/ai/image-generation.ts`

**Purpose:** High-level image generation abstraction

**Interface:**
```typescript
export interface ImageGenerationRequest {
  homebrewId: string;
  userId: string;
  prompt?: string; // Optional custom prompt
  type: 'item' | 'creature' | 'spell' | 'character';
  name: string;
  description?: string;
}

export interface ImageGenerationResult {
  url: string;
  provider: 'comfyui' | 'replicate' | 'dalle';
  metadata: {
    prompt: string;
    generationTimeMs: number;
    model?: string;
  };
}
```

**Functions:**
- `generateImage(request)` - Main entry point
- `buildPrompt(type, name, description)` - D&D prompt engineering
- `selectProvider()` - ComfyUI → Replicate → DALL-E fallback

**Prompt Engineering:**
```typescript
function buildPrompt(type: string, name: string, description?: string): string {
  const basePrompt = "D&D 5e fantasy art, professional illustration, detailed concept art";
  const typePrompts = {
    item: "magic item, neutral background, game asset",
    creature: "fantasy creature, dramatic lighting, character art",
    spell: "magical effect, energy visualization, spell effect",
    character: "character portrait, heroic pose, detailed character art",
  };

  return `${basePrompt}, ${typePrompts[type]}, ${name}, ${description || ''}, high quality, digital art`;
}
```

#### 3. `src/lib/queue/image-generation-queue.ts`

**Purpose:** BullMQ queue for async generation

**Pattern:** Follow `src/lib/queue/queue.ts`

**Queue config:**
```typescript
export const imageGenerationQueue = new Queue('image-generation', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600, // 1 hour
    },
    removeOnFail: {
      age: 86400, // 24 hours
    },
  },
});
```

#### 4. `src/lib/queue/image-generation-worker.ts`

**Purpose:** Worker process to execute generation jobs

**Pattern:** Follow `src/lib/queue/worker.ts`

**Workflow:**
1. Receive job from queue
2. Load ImageGenerationJob from database
3. Call ComfyUI API (or fallback provider)
4. Poll for completion with progress updates
5. Download generated image
6. Store image via storage abstraction
7. Update HomebrewContent.images array
8. Update ImageGenerationJob status
9. Send WebSocket notification

**Progress updates:**
```typescript
await updateProgress(jobId, {
  progress: 10,
  status: 'processing',
  message: 'Queued in ComfyUI',
});

// Poll loop
while (!complete) {
  const status = await comfyui.pollStatus(workflowId);
  await updateProgress(jobId, {
    progress: status.progress,
    message: status.message,
  });
  await sleep(1000);
}
```

#### 5. `src/server/routers/homebrew-image.ts`

**Purpose:** tRPC router for image generation

**Procedures:**
```typescript
export const homebrewImageRouter = router({
  // Generate image for homebrew item
  generateImage: protectedProcedure
    .input(z.object({
      homebrewId: z.string(),
      prompt: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Create ImageGenerationJob
      // Enqueue job
      // Return job ID
    }),

  // Get generation status
  getGenerationStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Return ImageGenerationJob
    }),

  // Upload image manually
  uploadImage: protectedProcedure
    .input(z.object({
      homebrewId: z.string(),
      imageUrl: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Add URL to HomebrewContent.images
    }),

  // Delete image
  deleteImage: protectedProcedure
    .input(z.object({
      homebrewId: z.string(),
      imageUrl: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Remove from HomebrewContent.images
      // Delete from storage
    }),
});
```

#### 6. `src/server/services/homebrew-image.service.ts`

**Purpose:** Business logic for image generation

**Functions:**
- `createGenerationJob()` - Validate + create job
- `processGenerationJob()` - Execute generation
- `handleGenerationComplete()` - Store result + update homebrew
- `handleGenerationFailed()` - Error handling + cleanup

#### 7. `docker-compose.yml` update

Add ComfyUI service:

```yaml
comfyui:
  image: comfyui/comfyui:latest
  container_name: quiverdm-comfyui
  ports:
    - "8188:8188"
  volumes:
    - comfyui_models:/app/models
    - comfyui_output:/app/output
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
  # Optional: auto-download models on startup
  environment:
    - COMFYUI_AUTO_DOWNLOAD_MODELS=true
```

Add volume:
```yaml
volumes:
  comfyui_models:
  comfyui_output:
```

### Environment Variables

Add to `.env.example`:

```bash
# ComfyUI Configuration
COMFYUI_URL=http://localhost:8188
COMFYUI_ENABLED=true
```

### Dev Commands

Add to `package.json`:

```json
{
  "scripts": {
    "worker:image": "tsx src/lib/queue/image-generation-worker.ts"
  }
}
```

## Implementation Sequence

### Day 1-2: ComfyUI Client

1. Research ComfyUI API documentation
2. Implement `src/lib/ai/comfyui.ts`
3. Write tests with mock ComfyUI responses
4. Test with local ComfyUI instance (if available)

### Day 3-4: Queue + Service

1. Create BullMQ queue
2. Implement service layer
3. Create database migration for ImageGenerationJob
4. Test job creation and queueing

### Day 5-6: Worker

1. Implement worker process
2. Add progress tracking
3. Add error handling
4. Test with mock jobs

### Day 7-8: tRPC Router

1. Create router with procedures
2. Add authorization checks
3. Test mutations and queries
4. Add WebSocket notifications

### Day 9-10: Docker + Testing

1. Add ComfyUI to docker-compose
2. Test GPU passthrough
3. End-to-end integration test
4. Performance testing

## Testing Strategy

### Unit Tests

- ComfyUI client with mocked HTTP responses
- Prompt building logic
- Provider selection fallback chain

### Integration Tests

- Queue → Worker → Database flow
- Image storage via storage abstraction
- tRPC procedures

### Manual Tests

1. **With ComfyUI available:**
   - Generate image for magic item
   - Monitor progress in UI
   - Verify image appears in gallery

2. **Without ComfyUI (simulate failure):**
   - Verify graceful degradation
   - Check error messages
   - Test fallback to Phase 3 providers

### Performance Tests

- Generation time benchmarks
- Queue throughput
- Memory usage during generation

## Critical Considerations

1. **GPU Requirement:** ComfyUI needs NVIDIA GPU with 8GB+ VRAM
2. **Model Downloads:** First run downloads large models (5-10GB)
3. **Generation Time:** 30-120 seconds per image depending on GPU
4. **Error Handling:** Out-of-memory, timeout, model loading failures
5. **Graceful Degradation:** Must work when ComfyUI unavailable

## Success Metrics

- [ ] ComfyUI health check passes when service running
- [ ] Image generation completes in <120 seconds
- [ ] Progress updates reflect actual generation status
- [ ] Generated images stored correctly
- [ ] HomebrewContent.images updated
- [ ] Worker handles errors without crashing
- [ ] Docker Compose setup works with GPU

## Risk Assessment

**High Risk:**
- GPU availability (not all devs have NVIDIA GPU)
- ComfyUI API changes (unofficial API)
- Model compatibility

**Mitigation:**
- Provide fallback to Phase 3 cloud providers
- Mock ComfyUI for testing without GPU
- Document model requirements

## Questions to Resolve

1. Which ComfyUI workflow to use? (SD 1.5, SDXL, Flux?)
2. How to handle model downloads automatically?
3. WebSocket vs polling for progress updates?
4. Should we allow custom workflows?
5. How to handle NSFW content filtering?

## Next Phase Dependencies

**Blocks:** Phase 3 (Cloud Fallback) - needs `generateImage()` interface

**Enables:** Phase 4 (UI) - provides backend for generation dialog
