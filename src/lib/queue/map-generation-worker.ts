/**
 * BullMQ Worker for Map Generation
 * Run: npm run worker:map-generation
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { getRedisConnection } from './queue';
import { storage } from '../storage';
import type { MapGenerationJobData, MapGenerationJobResult } from './map-generation-queue';

const prisma = new PrismaClient();

async function generateMapViaComfyUI(prompt: string): Promise<Buffer> {
  const comfyUrl = process.env.COMFYUI_URL;
  if (!comfyUrl) throw new Error('COMFYUI_URL not set');
  const workflow = {
    prompt: {
      '3': {
        class_type: 'KSampler',
        inputs: {
          seed: Math.floor(Math.random() * 1e9),
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
      },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'v1-5-pruned-emaonly.ckpt' } },
      '5': { class_type: 'EmptyLatentImage', inputs: { batch_size: 1, height: 768, width: 1024 } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: 'text, labels, watermark, modern, realistic photo', clip: ['4', 1] } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
      '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'map', images: ['8', 0] } },
    },
  };
  const promptRes = await fetch(`${comfyUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  if (!promptRes.ok) throw new Error(`ComfyUI /prompt failed: ${promptRes.status}`);
  const { prompt_id } = await promptRes.json() as { prompt_id: string };

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const histRes = await fetch(`${comfyUrl}/history/${prompt_id}`);
    const hist = await histRes.json() as Record<string, any>;
    if (hist[prompt_id]?.status?.completed) {
      const outputs = hist[prompt_id].outputs;
      const imageNode = Object.values(outputs).find((n: any) => n.images?.length > 0) as any;
      if (!imageNode) throw new Error('No image output from ComfyUI');
      const img = imageNode.images[0];
      const imgRes = await fetch(`${comfyUrl}/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`);
      return Buffer.from(await imgRes.arrayBuffer());
    }
  }
  throw new Error('ComfyUI timed out after 180s');
}

async function generateMapViaFal(prompt: string): Promise<Buffer> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error('FAL_KEY not set');
  const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: { width: 1024, height: 768 },
      num_images: 1,
    }),
  });
  if (!res.ok) throw new Error(`fal.ai failed: ${res.status}`);
  const data = await res.json() as { images: Array<{ url: string }> };
  const imgRes = await fetch(data.images[0].url);
  return Buffer.from(await imgRes.arrayBuffer());
}

async function processMapGenerationJob(job: Job<MapGenerationJobData>): Promise<MapGenerationJobResult> {
  const { mapId, prompt } = job.data;
  let imageBuffer: Buffer;

  try {
    imageBuffer = await generateMapViaComfyUI(prompt);
  } catch (comfyErr) {
    console.warn(`[map-generation] ComfyUI failed, trying fal.ai:`, comfyErr);
    imageBuffer = await generateMapViaFal(prompt);
  }

  const key = `maps/${mapId}/background.png`;
  const backgroundUrl = await storage.upload(key, imageBuffer, 'image/png');

  await prisma.campaignMap.update({
    where: { id: mapId },
    data: { backgroundType: 'GENERATED', backgroundUrl },
  });

  return { success: true, backgroundUrl };
}

const worker = new Worker<MapGenerationJobData, MapGenerationJobResult>(
  'map-generation',
  processMapGenerationJob,
  { connection: getRedisConnection() as any, concurrency: 2 }
);

worker.on('completed', (job) => console.log(`[map-generation] Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[map-generation] Job ${job?.id} failed:`, err));

console.log('[map-generation] Worker started');

async function shutdown() {
  console.log('[map-generation] Shutting down...');
  await worker.close();
  await prisma.$disconnect();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
