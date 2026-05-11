/**
 * Image Generation Abstraction Layer
 *
 * Provider fallback chain: ComfyUI (local) -> Higgsfield nano-banana-2 -> RunPod Serverless -> fal.ai Flux Dev -> Replicate SDXL -> DALL-E 3
 */
import OpenAI from 'openai';
import Replicate from 'replicate';
import * as fal from '@fal-ai/serverless-client';
import { storage } from '../storage';
import { isComfyUIAvailable, queueComfyUIPrompt, waitForComfyUIResult } from './comfyui';
import { isRunPodConfigured, queueRunPodJob, waitForRunPodResult } from './runpod-comfyui';

export type ImageProvider = 'comfyui' | 'higgsfield' | 'runpod' | 'fal' | 'replicate' | 'dalle';

export class ProviderUnavailableError extends Error {
  constructor(public providersAllowed: ImageProvider[], public reason: string) {
    super(`No allowed providers available (${providersAllowed.join(',')}): ${reason}`);
    this.name = 'ProviderUnavailableError';
  }
}

export interface ImageGenerationRequest {
  homebrewId?: string;
  npcId?: string;
  userId: string;
  type: string; // 'item', 'creature', 'spell', 'character', etc.
  name: string;
  description?: string;
  imagePromptHint?: string; // Visual description extracted from source PDF
  prompt?: string; // Custom prompt override
  providersAllowed?: ImageProvider[];
  width?: number;
  height?: number;
  workflow?: 'sdxl' | 'flux';
  storageKeyPrefix?: string;
}

export interface ImageGenerationResult {
  url: string;
  provider: ImageProvider;
  metadata: {
    prompt: string;
    generationTimeMs: number;
    model?: string;
    seed?: number;
    width?: number;
    height?: number;
    cfg?: number;
    steps?: number;
  };
}

const NEGATIVE_PROMPT = 'nsfw, gore, violence, low quality, blurry, watermark, text, logo';

const TYPE_STYLE_HINTS: Record<string, string> = {
  item: 'magic item on neutral background, game asset illustration',
  creature: 'fantasy creature, dramatic lighting, monster art',
  spell: 'magical spell effect, energy visualization, mystical',
  character: 'character portrait, heroic pose, detailed face',
  race: 'fantasy race character portrait, detailed illustration',
  subclass: 'D&D subclass concept art, character ability visualization',
  feat: 'magical ability, D&D feat concept art',
  background: 'D&D background, character backstory scene',
  location: 'D&D location, fantasy environment art',
  npc: 'fantasy NPC portrait, character design, dramatic lighting',
  default: 'D&D 5e fantasy art, detailed illustration',
};

export function buildPrompt(type: string, name: string, description?: string, imagePromptHint?: string): string {
  const styleHint = TYPE_STYLE_HINTS[type] || TYPE_STYLE_HINTS.default;

  if (imagePromptHint) {
    // Use the PDF-extracted visual description as the primary prompt
    return `D&D 5e fantasy art, ${styleHint}, ${imagePromptHint}, high quality, digital art, professional illustration`;
  }

  const base = `D&D 5e fantasy art, ${styleHint}, ${name}`;
  const desc = description ? `, ${description.slice(0, 200)}` : '';
  return `${base}${desc}, high quality, digital art, professional illustration`;
}

function storageKey(request: ImageGenerationRequest): string {
  if (request.storageKeyPrefix) {
    return `${request.storageKeyPrefix}/${Date.now()}.png`;
  }
  const entityId = request.homebrewId ?? request.npcId;
  if (!entityId) {
    throw new Error('Image generation requires homebrewId, npcId, or storageKeyPrefix');
  }
  return `homebrew-images/generated/${request.userId}/${entityId}/${Date.now()}.png`;
}

async function generateWithComfyUI(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const start = Date.now();
  const prompt = request.prompt || buildPrompt(request.type, request.name, request.description, request.imagePromptHint);
  const width = request.width ?? 1024;
  const height = request.height ?? 1024;
  const workflow = request.workflow ?? 'sdxl';

  const { promptId, seed } = await queueComfyUIPrompt(prompt, NEGATIVE_PROMPT, { workflow, width, height });
  const imageBuffer = await waitForComfyUIResult(promptId);

  const key = storageKey(request);
  const url = await storage.upload(key, imageBuffer, 'image/png');
  const model = process.env.COMFYUI_MODEL || (workflow === 'flux' ? 'flux2-dev.safetensors' : 'sd_xl_base_1.0.safetensors');

  return {
    url,
    provider: 'comfyui',
    metadata: { prompt, generationTimeMs: Date.now() - start, model, seed, width, height, cfg: workflow === 'flux' ? 3.5 : 7, steps: workflow === 'flux' ? 28 : 20 },
  };
}

// NOTE: platform.higgsfield.ai REST API was deprecated May 2026.
// Using the `higgsfield` CLI (npm i -g @higgsfield/cli) as a bridge.
// TODO: migrate to https://mcp.higgsfield.ai REST endpoints once documented.
async function generateWithHiggsfield(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const start = Date.now();
  const prompt = request.prompt || buildPrompt(request.type, request.name, request.description, request.imagePromptHint);

  const { spawnSync } = await import('child_process');
  const result = spawnSync(
    'higgsfield',
    ['generate', 'create', 'flux_2', '--prompt', prompt, '--aspect_ratio', '1:1', '--resolution', '2k', '--model', 'pro', '--wait'],
    { encoding: 'utf8', timeout: 180_000 },
  );

  if (result.error) throw new Error(`Higgsfield CLI unavailable: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Higgsfield CLI failed: ${(result.stderr ?? '').slice(0, 300)}`);

  const imageUrl = result.stdout.trim();
  if (!imageUrl.startsWith('http')) throw new Error(`Higgsfield CLI unexpected output: ${imageUrl.slice(0, 200)}`);

  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!imgRes.ok) throw new Error(`Failed to fetch Higgsfield image: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const key = storageKey(request);
  const url = await storage.upload(key, buffer, 'image/png');

  return {
    url,
    provider: 'higgsfield',
    metadata: { prompt, generationTimeMs: Date.now() - start, model: 'flux_2', width: 1024, height: 1024 },
  };
}

async function generateWithRunPod(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const start = Date.now();
  const prompt = request.prompt || buildPrompt(request.type, request.name, request.description, request.imagePromptHint);

  const { jobId, seed } = await queueRunPodJob(prompt, NEGATIVE_PROMPT);
  const imageBuffer = await waitForRunPodResult(jobId);

  const key = storageKey(request);
  const url = await storage.upload(key, imageBuffer, 'image/png');
  const model = process.env.COMFYUI_MODEL || 'sd_xl_base_1.0.safetensors';

  return {
    url,
    provider: 'runpod',
    metadata: { prompt, generationTimeMs: Date.now() - start, model, seed, width: 1024, height: 1024, cfg: 7, steps: 20 },
  };
}

async function generateWithFal(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const start = Date.now();
  const prompt = request.prompt || buildPrompt(request.type, request.name, request.description, request.imagePromptHint);

  fal.config({ credentials: process.env.FAL_KEY! });

  const result = await fal.subscribe('fal-ai/flux/dev', {
    input: {
      prompt,
      image_size: 'square_hd',
      num_inference_steps: 28,
      guidance_scale: 3.5,
    },
  }) as { images: Array<{ url: string; width: number; height: number }> };

  const imageUrl = result.images[0]?.url;
  if (!imageUrl) throw new Error('fal.ai returned no image');

  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!imgRes.ok) throw new Error(`Failed to fetch fal.ai image: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const key = storageKey(request);
  const url = await storage.upload(key, buffer, 'image/png');

  return {
    url,
    provider: 'fal',
    metadata: {
      prompt,
      generationTimeMs: Date.now() - start,
      model: 'flux-dev',
      width: result.images[0]?.width ?? 1024,
      height: result.images[0]?.height ?? 1024,
    },
  };
}

async function generateWithReplicate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const start = Date.now();
  const prompt = request.prompt || buildPrompt(request.type, request.name, request.description, request.imagePromptHint);

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY! });

  const output = await replicate.run(
    'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
    {
      input: {
        prompt,
        negative_prompt: NEGATIVE_PROMPT,
        width: 1024,
        height: 1024,
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
    }
  );

  const imageUrl = Array.isArray(output) ? (output[0] as unknown as string) : (output as unknown as string);
  if (!imageUrl) throw new Error('Replicate returned no image URL');

  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!imgRes.ok) throw new Error(`Failed to fetch Replicate image: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const key = storageKey(request);
  const url = await storage.upload(key, buffer, 'image/png');

  return {
    url,
    provider: 'replicate',
    metadata: { prompt, generationTimeMs: Date.now() - start, model: 'sdxl', width: 1024, height: 1024, cfg: 7.5, steps: 30 },
  };
}

async function generateWithDALLE(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const start = Date.now();
  const prompt = request.prompt || buildPrompt(request.type, request.name, request.description, request.imagePromptHint);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) throw new Error('DALL-E returned no image URL');

  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!imgRes.ok) throw new Error(`Failed to fetch DALL-E image: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const key = storageKey(request);
  const url = await storage.upload(key, buffer, 'image/png');

  return {
    url,
    provider: 'dalle',
    metadata: { prompt, generationTimeMs: Date.now() - start, model: 'dall-e-3', width: 1024, height: 1024 },
  };
}

/**
 * Generate an image using the best available provider.
 * Tries: ComfyUI -> fal.ai -> Replicate -> DALL-E
 */
export async function generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const allowed = request.providersAllowed;
  const providers: Array<{
    name: ImageProvider;
    enabled: boolean;
    fn: () => Promise<ImageGenerationResult>;
  }> = [
    {
      name: 'comfyui',
      enabled: process.env.COMFYUI_ENABLED === 'true' || !!process.env.COMFYUI_URL,
      fn: () => generateWithComfyUI(request),
    },
    {
      name: 'higgsfield',
      enabled: !!(process.env.HF_API_KEY && process.env.HF_API_SECRET),
      fn: () => generateWithHiggsfield(request),
    },
    {
      name: 'runpod',
      enabled: isRunPodConfigured(),
      fn: () => generateWithRunPod(request),
    },
    {
      name: 'fal',
      enabled: !!process.env.FAL_KEY,
      fn: () => generateWithFal(request),
    },
    {
      name: 'replicate',
      enabled: !!process.env.REPLICATE_API_KEY,
      fn: () => generateWithReplicate(request),
    },
    {
      name: 'dalle',
      enabled: !!process.env.OPENAI_API_KEY,
      fn: () => generateWithDALLE(request),
    },
  ];

  const errors: string[] = [];
  const filtered = allowed ? providers.filter((p) => allowed.includes(p.name)) : providers;

  if (allowed && filtered.length === 0) {
    throw new ProviderUnavailableError(allowed, 'no providers from allowed list are registered');
  }

  for (const p of filtered) {
    if (!p.enabled) continue;

    // Extra health check for ComfyUI before trying
    if (p.name === 'comfyui' && !(await isComfyUIAvailable())) {
      console.log('[ImageGen] ComfyUI not available, skipping');
      continue;
    }

    try {
      console.log(`[ImageGen] Trying provider: ${p.name}`);
      return await p.fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[ImageGen] ${p.name} failed: ${msg}`);
      errors.push(`${p.name}: ${msg}`);
    }
  }

  if (allowed) {
    throw new ProviderUnavailableError(allowed, errors.length ? errors.join(' | ') : 'no allowed provider was enabled');
  }
  throw new Error(`All image generation providers failed. ${errors.join(' | ')}`);
}
