/**
 * RunPod Serverless ComfyUI Client
 * Endpoint: quiverdm-comfyui (hlri9qdi746pzp)
 * Scale-to-zero — workers spin up on demand, idle out after 5 min.
 */

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID || 'hlri9qdi746pzp';
const BASE_URL = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`;

export function isRunPodConfigured(): boolean {
  return !!RUNPOD_API_KEY;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${RUNPOD_API_KEY}`,
  };
}

function buildWorkflow(prompt: string, negativePrompt: string, seed: number): Record<string, unknown> {
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
      inputs: { filename_prefix: 'quiverdm', images: ['8', 0] },
      class_type: 'SaveImage',
    },
  };
}

export async function queueRunPodJob(
  prompt: string,
  negativePrompt = 'nsfw, gore, violence, low quality, blurry, watermark'
): Promise<{ jobId: string; seed: number }> {
  const seed = Math.floor(Math.random() * 2 ** 32);
  const workflow = buildWorkflow(prompt, negativePrompt, seed);

  const res = await fetch(`${BASE_URL}/run`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ input: { workflow } }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`RunPod queue failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { id: string };
  return { jobId: data.id, seed };
}

export async function waitForRunPodResult(jobId: string, timeoutMs = 300_000): Promise<Buffer> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));

    const res = await fetch(`${BASE_URL}/status/${jobId}`, {
      headers: headers(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) continue;

    const data = (await res.json()) as {
      status: string;
      output?: { images?: Array<{ url?: string; base64?: string }> };
      error?: string;
    };

    if (data.status === 'FAILED') {
      throw new Error(`RunPod job failed: ${data.error || 'unknown error'}`);
    }

    if (data.status !== 'COMPLETED') continue;

    const image = data.output?.images?.[0];
    if (!image) throw new Error('RunPod returned no image in output');

    if (image.url) {
      const imgRes = await fetch(image.url, { signal: AbortSignal.timeout(30_000) });
      if (!imgRes.ok) throw new Error(`Failed to download RunPod image: ${imgRes.status}`);
      return Buffer.from(await imgRes.arrayBuffer());
    }

    if (image.base64) {
      return Buffer.from(image.base64, 'base64');
    }

    throw new Error('RunPod image has neither url nor base64');
  }

  throw new Error(`RunPod job timed out after ${timeoutMs}ms`);
}
