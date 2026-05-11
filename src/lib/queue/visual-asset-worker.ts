/**
 * Visual Asset Worker
 * Generates campaign banners, emblems, and world activity thumbnails via ComfyUI Flux.2.
 */
import dotenv from 'dotenv';
dotenv.config();

import { Worker } from 'bullmq';
import { prisma } from '../prisma';
import { generateImage, type ImageGenerationRequest } from '../ai/image-generation';
import type { VisualAssetJobData, VisualAssetJobResult, VisualAssetKind } from './visual-asset-queue';

function getRedisConnection(): Record<string, unknown> {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const useTls = url.protocol === 'rediss:';
    return {
      host: url.hostname,
      port: parseInt(url.port || (useTls ? '6380' : '6379')),
      password: url.password || undefined,
      username: url.username !== 'default' ? url.username : undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      ...(useTls ? { tls: {} } : {}),
    };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

interface PromptSpec {
  prompt: string;
  width: number;
  height: number;
}

function buildSpec(kind: VisualAssetKind, name: string, hint?: string): PromptSpec {
  const tone = 'dark fantasy oil painting, candlelit atmosphere, warm amber and deep indigo palette, painterly brushwork, no text';
  switch (kind) {
    case 'campaign-banner':
      return {
        prompt: `${name} — sweeping landscape vista, cinematic wide shot, ${hint ?? 'mysterious realm at dusk'}, ${tone}`,
        width: 1536,
        height: 640,
      };
    case 'campaign-emblem':
      return {
        prompt: `${name} — heraldic emblem, ornate medieval sigil on weathered parchment, centered composition, ${hint ?? 'iconic motif of the realm'}, ${tone}`,
        width: 768,
        height: 768,
      };
    case 'world-activity-thumb':
      return {
        prompt: `${name} — intimate vignette, ${hint ?? 'evocative scene from the realm'}, ${tone}`,
        width: 768,
        height: 768,
      };
  }
}

async function processJob(data: VisualAssetJobData): Promise<VisualAssetJobResult> {
  const campaign = await prisma.campaign.findUnique({ where: { id: data.campaignId } });
  if (!campaign) {
    return { success: false, error: `Campaign not found: ${data.campaignId}` };
  }

  let entryName = campaign.name;
  let entryHint = data.promptHint;
  if (data.kind === 'world-activity-thumb' && data.worldEntryId) {
    const entry = await prisma.worldEntry.findUnique({ where: { id: data.worldEntryId } });
    if (!entry) return { success: false, error: `WorldEntry not found: ${data.worldEntryId}` };
    entryName = entry.name;
    entryHint = entryHint ?? entry.content?.slice(0, 200);
  }

  const spec = buildSpec(data.kind, entryName, entryHint);

  const req: ImageGenerationRequest = {
    userId: data.userId,
    type: data.kind === 'campaign-emblem' ? 'emblem' : 'location',
    name: entryName,
    prompt: spec.prompt,
    providersAllowed: ['comfyui'],
    workflow: 'flux',
    width: spec.width,
    height: spec.height,
    storageKeyPrefix: `visual-assets/${data.kind}/${data.campaignId}`,
  };

  const result = await generateImage(req);

  if (data.kind === 'campaign-banner') {
    await prisma.campaign.update({ where: { id: data.campaignId }, data: { bannerUrl: result.url } });
  } else if (data.kind === 'campaign-emblem') {
    await prisma.campaign.update({ where: { id: data.campaignId }, data: { emblemUrl: result.url } });
  } else if (data.kind === 'world-activity-thumb' && data.worldEntryId) {
    await prisma.worldEntry.update({ where: { id: data.worldEntryId }, data: { imageUrl: result.url } });
  }

  return { success: true, url: result.url };
}

const worker = new Worker<VisualAssetJobData, VisualAssetJobResult>(
  'visual-assets',
  async (job) => processJob(job.data),
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('completed', (job) => {
  console.log(`[visual-assets] Job ${job.id} (${job.data.kind}) completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[visual-assets] Job ${job?.id} failed:`, err.message);
});

console.log('[visual-assets] Worker started');
