import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { chatWithAI } from '../ai/chat';
import { buildWorldSimulationPrompt } from '../ai/world-simulation-prompts';
import { worldSimulationRepository } from '../../server/repositories/world-simulation.repository';
import { brainRepository } from '../../server/repositories/brain.repository';
import { worldSimulationQueue } from './world-simulation-queue';
import { getRedisConnection } from './queue';
import type { WorldSimulationJobData, WorldSimulationJobResult } from './world-simulation-queue';

function parseSimulationResponse(raw: string): Array<{ actorId?: string; type: string; description: string; causalChain?: unknown[] }> {
  let text = raw.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/i, '').replace(/\s*```$/, '');
  }
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

async function processWorldSimulationJob(data: WorldSimulationJobData): Promise<WorldSimulationJobResult> {
  const { campaignId } = data;

  const [actors, worldState] = await Promise.all([
    worldSimulationRepository.listActors(campaignId),
    brainRepository.getOrCreateState(campaignId),
  ]);

  if (actors.length === 0) {
    return { success: true, eventsCreated: 0, thresholdTriggered: false };
  }

  const entities = await brainRepository.findEntities(campaignId, { limit: 100 });
  const prompt = buildWorldSimulationPrompt(actors, { worldState, entities });

  let raw: string;
  try {
    raw = await chatWithAI([{ role: 'user', content: prompt }], { temperature: 0.7 });
  } catch (err) {
    console.warn(`[world-simulation] AI call failed for campaign ${campaignId}:`, err);
    return { success: false, eventsCreated: 0, thresholdTriggered: false, error: String(err) };
  }

  let parsed: Array<{ actorId?: string; type: string; description: string; causalChain?: unknown[] }>;
  try {
    parsed = parseSimulationResponse(raw);
  } catch {
    console.warn(`[world-simulation] Failed to parse AI response for campaign ${campaignId}`);
    return { success: true, eventsCreated: 0, thresholdTriggered: false };
  }

  let eventsCreated = 0;
  for (const event of parsed.slice(0, 4)) {
    if (!event.type || !event.description) continue;
    try {
      await worldSimulationRepository.createEvent(campaignId, {
        actorId: event.actorId,
        type: event.type,
        description: event.description,
        causalChain: event.causalChain,
      });
      eventsCreated++;
    } catch (err) {
      console.warn(`[world-simulation] Failed to create event:`, err);
    }
  }

  const pressures = [
    worldState.pressurePolitical,
    worldState.pressureSupernatural,
    worldState.pressureEconomic,
    worldState.pressureCosmic,
    worldState.pressureSocial,
  ];

  let thresholdTriggered = false;
  if (pressures.some(p => p > 0.8)) {
    const highPressure = ['political', 'supernatural', 'economic', 'cosmic', 'social'].filter(
      (_, i) => pressures[i] > 0.8
    );
    await worldSimulationRepository.createEvent(campaignId, {
      type: 'threshold_trigger',
      description: `Critical pressure threshold exceeded: ${highPressure.join(', ')}. The world teeters on the edge of major change.`,
      causalChain: [{ trigger: 'pressure_threshold', tracks: highPressure }],
    });
    eventsCreated++;
    thresholdTriggered = true;
  }

  await Promise.all(actors.map(a => worldSimulationRepository.updateActorLastTickAt(a.id)));

  return { success: true, eventsCreated, thresholdTriggered };
}

const worker = new Worker<WorldSimulationJobData, WorldSimulationJobResult>(
  worldSimulationQueue.name,
  async (job) => {
    try {
      return await processWorldSimulationJob(job.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[world-simulation] Job failed for campaign ${job.data.campaignId}:`, message);
      throw error;
    }
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 2,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[world-simulation] Job ${job.id} completed: ${result.eventsCreated} events created, threshold=${result.thresholdTriggered}`);
});

worker.on('failed', (job, err) => {
  console.error(`[world-simulation] Job ${job?.id} failed:`, err.message);
});

console.log('[world-simulation] Worker started');

async function shutdown() {
  console.log('[world-simulation] Shutting down...');
  await worker.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
