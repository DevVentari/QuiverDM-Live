/**
 * ComfyUI REST API Client
 * Docs: https://github.com/comfyanonymous/ComfyUI
 */

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://localhost:8188';

export interface ComfyUIOutput {
  promptId: string;
  imageUrls: string[]; // Data URLs or file paths
}

/**
 * Build a simple text-to-image workflow for SD/SDXL
 * Uses the standard txt2img workflow structure
 */
function buildTxt2ImgWorkflow(prompt: string, negativePrompt: string, seed: number): Record<string, unknown> {
  return {
    '3': {
      inputs: {
        seed,
        steps: 20,
        cfg: 7,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
      class_type: 'KSampler',
    },
    '4': {
      inputs: { ckpt_name: process.env.COMFYUI_MODEL || 'sd_xl_base_1.0.safetensors' },
      class_type: 'CheckpointLoaderSimple',
    },
    '5': {
      inputs: { width: 1024, height: 1024, batch_size: 1 },
      class_type: 'EmptyLatentImage',
    },
    '6': {
      inputs: { text: prompt, clip: ['4', 1] },
      class_type: 'CLIPTextEncode',
    },
    '7': {
      inputs: { text: negativePrompt, clip: ['4', 1] },
      class_type: 'CLIPTextEncode',
    },
    '8': {
      inputs: { samples: ['3', 0], vae: ['4', 2] },
      class_type: 'VAEDecode',
    },
    '9': {
      inputs: {
        filename_prefix: 'quiverdm',
        images: ['8', 0],
      },
      class_type: 'SaveImage',
    },
  };
}

export async function isComfyUIAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${COMFYUI_URL}/system_stats`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface ComfyUIQueueOptions {
  workflow?: 'sdxl' | 'flux';
  width?: number;
  height?: number;
}

export function buildFluxTxt2ImgWorkflow(
  prompt: string,
  seed: number,
  width: number,
  height: number,
): Record<string, unknown> {
  const checkpoint = process.env.COMFYUI_MODEL || 'flux2-dev.safetensors';
  return {
    '10': { inputs: { unet_name: checkpoint, weight_dtype: 'default' }, class_type: 'UNETLoader' },
    '11': { inputs: { clip_name1: 't5xxl_fp8_e4m3fn.safetensors', clip_name2: 'clip_l.safetensors', type: 'flux' }, class_type: 'DualCLIPLoader' },
    '12': { inputs: { vae_name: 'flux_vae.safetensors' }, class_type: 'VAELoader' },
    '6':  { inputs: { text: prompt, clip: ['11', 0] }, class_type: 'CLIPTextEncode' },
    '5':  { inputs: { width, height, batch_size: 1 }, class_type: 'EmptySD3LatentImage' },
    '13': { inputs: { noise_seed: seed }, class_type: 'RandomNoise' },
    '14': { inputs: { sampler_name: 'euler' }, class_type: 'KSamplerSelect' },
    '15': { inputs: { scheduler: 'simple', steps: 28, denoise: 1.0, model: ['10', 0] }, class_type: 'BasicScheduler' },
    '16': { inputs: { conditioning: ['6', 0], guidance: 3.5 }, class_type: 'FluxGuidance' },
    '17': { inputs: { model: ['10', 0], conditioning: ['16', 0] }, class_type: 'BasicGuider' },
    '3':  { inputs: { noise: ['13', 0], guider: ['17', 0], sampler: ['14', 0], sigmas: ['15', 0], latent_image: ['5', 0] }, class_type: 'SamplerCustomAdvanced' },
    '8':  { inputs: { samples: ['3', 0], vae: ['12', 0] }, class_type: 'VAEDecode' },
    '9':  { inputs: { filename_prefix: 'quiverdm-flux', images: ['8', 0] }, class_type: 'SaveImage' },
  };
}

export async function queueComfyUIPrompt(
  prompt: string,
  negativePrompt = 'nsfw, gore, violence, low quality, blurry, watermark',
  options: ComfyUIQueueOptions = {}
): Promise<{ promptId: string; seed: number }> {
  const seed = Math.floor(Math.random() * 2 ** 32);
  const width = options.width ?? 1024;
  const height = options.height ?? 1024;
  const workflow =
    options.workflow === 'flux'
      ? buildFluxTxt2ImgWorkflow(prompt, seed, width, height)
      : buildTxt2ImgWorkflow(prompt, negativePrompt, seed);

  const res = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ComfyUI queue failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { prompt_id: string };
  return { promptId: data.prompt_id, seed };
}

/**
 * Poll ComfyUI until the job completes or times out.
 * Returns base64 image data.
 */
export async function waitForComfyUIResult(promptId: string, timeoutMs = 120_000): Promise<Buffer> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(`${COMFYUI_URL}/history/${promptId}`, {
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) continue;

    const history = (await res.json()) as Record<string, unknown>;
    const job = history[promptId] as Record<string, unknown> | undefined;

    if (!job) continue; // Not in history yet

    const outputs = job.outputs as Record<string, unknown> | undefined;
    if (!outputs) continue;

    // Find first image output
    for (const nodeOutput of Object.values(outputs)) {
      const node = nodeOutput as Record<string, unknown>;
      const images = node.images as Array<{ filename: string; subfolder: string; type: string }> | undefined;
      if (!images || images.length === 0) continue;

      const image = images[0];
      // Download image from ComfyUI
      const imgUrl = `${COMFYUI_URL}/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder)}&type=${image.type}`;
      const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(30_000) });

      if (!imgRes.ok) throw new Error(`Failed to download ComfyUI image: ${imgRes.status}`);

      return Buffer.from(await imgRes.arrayBuffer());
    }
  }

  throw new Error(`ComfyUI generation timed out after ${timeoutMs}ms`);
}
