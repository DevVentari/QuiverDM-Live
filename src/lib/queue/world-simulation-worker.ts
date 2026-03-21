import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { nanoid } from 'nanoid';
import { chatWithAI } from '../ai/chat';
import { buildWorldSimulationPrompt } from '../ai/world-simulation-prompts';
import { worldSimulationRepository } from '../../server/repositories/world-simulation.repository';
import { brainRepository } from '../../server/repositories/brain.repository';
import { worldSimulationQueue } from './world-simulation-queue';
import { getRedisConnection } from './queue';
import { prisma } from '../prisma';
import type { WorldSimulationJobData, WorldSimulationJobResult } from './world-simulation-queue';
import type { Prisma } from '@prisma/client';

interface ProposedEffect {
  type: 'pressure_shift' | 'hook_resolve' | 'hook_create' | 'entity_status' | 'relationship_change';
  [key: string]: unknown;
}

interface ProposedEvent {
  id: string;
  actorId: string | null;
  description: string;
  effects: ProposedEffect[];
  approved: boolean | null;
}

function parseSimulationResponse(raw: string): ProposedEvent[] {
  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  const events: unknown[] = Array.isArray(parsed) ? parsed : (parsed.events ?? []);
  return events
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .slice(0, 4)
    .map(e => ({
      id: nanoid(),
      actorId: typeof e.actorId === 'string' ? e.actorId : null,
      description: typeof e.description === 'string' ? e.description : '',
      effects: Array.isArray(e.effects) ? (e.effects as ProposedEffect[]) : [],
      approved: null,
    }))
    .filter(e => e.description.length > 0);
}

async function processWorldSimulationJob(data: WorldSimulationJobData): Promise<WorldSimulationJobResult> {
  const { campaignId } = data;

  const pendingProposal = await prisma.worldEventProposal.findFirst({
    where: { campaignId, status: 'pending' },
    select: { id: true },
  });

  if (pendingProposal) {
    console.log(`[world-simulation] Skipping tick — pending proposal exists for campaign ${campaignId}`);
    return { success: true, eventsCreated: 0, thresholdTriggered: false };
  }

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

  let proposedEvents: ProposedEvent[];
  try {
    proposedEvents = parseSimulationResponse(raw);
  } catch {
    console.warn(`[world-simulation] Failed to parse AI response for campaign ${campaignId}`);
    return { success: true, eventsCreated: 0, thresholdTriggered: false };
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
    proposedEvents.push({
      id: nanoid(),
      actorId: null,
      description: `Critical pressure threshold exceeded: ${highPressure.join(', ')}. The world teeters on the edge of major change.`,
      effects: highPressure.map(track => ({
        type: 'pressure_shift' as const,
        track,
        delta: 0.05,
      })),
      approved: null,
    });
    thresholdTriggered = true;
  }

  if (proposedEvents.length === 0) {
    return { success: true, eventsCreated: 0, thresholdTriggered: false };
  }

  await prisma.worldEventProposal.create({
    data: {
      campaignId,
      events: proposedEvents as unknown as Prisma.InputJsonValue,
      status: 'pending',
    },
  });

  await Promise.all(actors.map(a => worldSimulationRepository.updateActorLastTickAt(a.id)));

  return { success: true, eventsCreated: proposedEvents.length, thresholdTriggered };
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
