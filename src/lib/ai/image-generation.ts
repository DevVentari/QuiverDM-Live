/**
 * Image Generation Abstraction Layer
 *
 * Provider fallback chain: ComfyUI (local) -> Replicate SDXL -> DALL-E 3
 */
import OpenAI from 'openai';
import Replicate from 'replicate';
import { storage } from '../storage';
import { isComfyUIAvailable, queueComfyUIPrompt, waitForComfyUIResult } from './comfyui';

export interface ImageGenerationRequest {
  homebrewId: string;
  userId: string;
  type: string; // 'item', 'creature', 'spell', 'character', etc.
  name: string;
  description?: string;
  imagePromptHint?: string; // Visual description extracted from source PDF
  prompt?: string; // Custom prompt override
}

export interface ImageGenerationResult {
  url: string;
  provider: 'comfyui' | 'replicate' | 'dalle';
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

function storageKey(userId: string, homebrewId: string): string {
  return `homebrew-images/generated/${userId}/${homebrewId}/${Date.now()}.png`;
}

async function generateWithComfyUI(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const start = Date.now();
  const prompt = request.prompt || buildPrompt(request.type, request.name, request.description, request.imagePromptHint);

  const { promptId, seed } = await queueComfyUIPrompt(prompt, NEGATIVE_PROMPT);
  const imageBuffer = await waitForComfyUIResult(promptId);

  const key = storageKey(request.userId, request.homebrewId);
  const url = await storage.upload(key, imageBuffer, 'image/png');
  const model = process.env.COMFYUI_MODEL || 'sd_xl_base_1.0.safetensors';

  return {
    url,
    provider: 'comfyui',
    metadata: { prompt, generationTimeMs: Date.now() - start, model, seed, width: 1024, height: 1024, cfg: 7, steps: 20 },
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

  const key = storageKey(request.userId, request.homebrewId);
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

  const key = storageKey(request.userId, request.homebrewId);
  const url = await storage.upload(key, buffer, 'image/png');

  return {
    url,
    provider: 'dalle',
    metadata: { prompt, generationTimeMs: Date.now() - start, model: 'dall-e-3', width: 1024, height: 1024 },
  };
}

/**
 * Generate an image using the best available provider.
 * Tries: ComfyUI -> Replicate -> DALL-E
 */
export async function generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  const providers: Array<{
    name: string;
    enabled: boolean;
    fn: () => Promise<ImageGenerationResult>;
  }> = [
    {
      name: 'comfyui',
      enabled: process.env.COMFYUI_ENABLED === 'true',
      fn: () => generateWithComfyUI(request),
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

  for (const p of providers) {
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

  throw new Error(`All image generation providers failed. ${errors.join(' | ')}`);
}
