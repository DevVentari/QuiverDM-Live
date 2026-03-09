import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { Worker } from 'bullmq';
import { WorldEntityType, WorldEntityStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { chatWithAI } from '../ai/chat';
import { buildBrainExtractionPrompt, parseBrainExtractionResponse } from '../ai/brain-extraction';
import { brainRepository } from '../../server/repositories/brain.repository';
import type { BrainIngestionJobData, BrainIngestionJobResult } from './brain-ingestion-queue';
import { getRedisConnection } from './queue';

const ENTITY_TYPE_MAP: Record<string, WorldEntityType> = {
  NPC: WorldEntityType.NPC,
  PC: WorldEntityType.PC,
  FACTION: WorldEntityType.FACTION,
  LOCATION: WorldEntityType.LOCATION,
  ITEM: WorldEntityType.ITEM,
  EVENT: WorldEntityType.EVENT,
  ARC: WorldEntityType.ARC,
  THREAT: WorldEntityType.THREAT,
  SECRET: WorldEntityType.SECRET,
  CUSTOM: WorldEntityType.CUSTOM,
};

const STATUS_MAP: Record<string, WorldEntityStatus> = {
  active: WorldEntityStatus.active,
  dormant: WorldEntityStatus.dormant,
  destroyed: WorldEntityStatus.destroyed,
  resolved: WorldEntityStatus.resolved,
};

export async function processBrainIngestionJob(data: BrainIngestionJobData): Promise<BrainIngestionJobResult> {
  const result: BrainIngestionJobResult = {
    success: false,
    entitiesCreated: 0,
    entitiesUpdated: 0,
    relationshipsUpserted: 0,
    hooksAdded: 0,
  };

  const existingEntities = await brainRepository.findEntities(data.campaignId, { limit: 200 });
  const existingEntityMap = new Map(existingEntities.map(e => [`${e.name}:${e.type}`, e]));

  const prompt = buildBrainExtractionPrompt({
    summary: data.summary,
    highlights: data.highlights,
    existingEntities: existingEntities.map(e => ({ id: e.id, name: e.name, type: e.type })),
  });

  const raw = await chatWithAI(
    [{ role: 'user', content: prompt }],
    { temperature: 0.1 }
  );

  const extracted = parseBrainExtractionResponse(raw);

  for (const entity of extracted.newEntities) {
    const entityType = ENTITY_TYPE_MAP[entity.type];
    if (!entityType) continue;
    try {
      const upserted = await brainRepository.upsertEntity(data.campaignId, {
        type: entityType,
        name: entity.name,
        description: entity.description,
        properties: entity.properties ?? {},
        status: entity.status ? STATUS_MAP[entity.status] : undefined,
        lastSeenSessionId: data.sessionId,
        firstSeenSessionId: data.sessionId,
        confidence: 0.8,
      });

      await brainRepository.recordAppearance({ sessionId: data.sessionId, entityId: upserted.id, campaignId: data.campaignId });

      await brainRepository.logChange({
        campaignId: data.campaignId,
        entityId: upserted.id,
        sessionId: data.sessionId,
        changeType: 'property_update',
        newValue: { name: entity.name, type: entityType, status: entity.status },
        source: 'ingestion',
      });

      const key = `${entity.name}:${entityType}`;
      if (existingEntityMap.has(key)) {
        result.entitiesUpdated++;
      } else {
        result.entitiesCreated++;
      }
    } catch (e) {
      console.warn(`[brain-ingestion] Failed to upsert entity ${entity.name}:`, e);
    }
  }

  for (const update of extracted.entityUpdates) {
    const entityType = ENTITY_TYPE_MAP[update.type];
    if (!entityType) continue;
    const existing = existingEntityMap.get(`${update.name}:${entityType}`);
    if (!existing) continue;
    try {
      await brainRepository.updateEntity(existing.id, {
        properties: { ...(existing.properties as Record<string, unknown>), ...(update.properties ?? {}) },
        status: update.status ? STATUS_MAP[update.status] : undefined,
        lastSeenSessionId: data.sessionId,
      });

      await brainRepository.recordAppearance({ sessionId: data.sessionId, entityId: existing.id, campaignId: data.campaignId });

      await brainRepository.logChange({
        campaignId: data.campaignId,
        entityId: existing.id,
        sessionId: data.sessionId,
        changeType: 'property_update',
        newValue: { name: update.name, status: update.status, properties: update.properties },
        source: 'ingestion',
      });

      result.entitiesUpdated++;
    } catch (e) {
      console.warn(`[brain-ingestion] Failed to update entity ${update.name}:`, e);
    }
  }

  const allEntities = await brainRepository.findEntities(data.campaignId, { limit: 300 });
  const entityByName = new Map(allEntities.map(e => [e.name.toLowerCase(), e]));

  for (const rel of extracted.relationships) {
    const from = entityByName.get(rel.fromEntityName.toLowerCase());
    const to = entityByName.get(rel.toEntityName.toLowerCase());
    if (!from || !to) continue;
    try {
      const upsertedRel = await brainRepository.upsertRelationship({
        campaignId: data.campaignId,
        fromEntityId: from.id,
        toEntityId: to.id,
        type: rel.type,
        strength: rel.strength,
        description: rel.description,
      });
      if (rel.description) {
        await brainRepository.appendRelationshipHistory(upsertedRel.id, {
          sessionId: data.sessionId,
          description: rel.description,
          timestamp: new Date(),
        });
      }
      result.relationshipsUpserted++;
    } catch (e) {
      console.warn(`[brain-ingestion] Failed to upsert relationship ${rel.fromEntityName}->${rel.toEntityName}:`, e);
    }
  }

  const worldState = await brainRepository.getOrCreateState(data.campaignId);

  if (extracted.newHooks.length > 0) {
    const existingHooks = Array.isArray(worldState.hooks) ? worldState.hooks as Array<Record<string, unknown>> : [];

    const newHooks = extracted.newHooks.map(hook => ({
      id: `hook-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: hook.text,
      createdSessionId: data.sessionId,
      ageInSessions: 0,
      urgency: hook.urgency,
      status: 'open',
      linkedEntityNames: hook.linkedEntityNames,
    }));

    await brainRepository.updateState(data.campaignId, {
      hooks: [...existingHooks, ...newHooks],
      lastIngestedSessionId: data.sessionId,
    });
    result.hooksAdded = newHooks.length;
  } else {
    await brainRepository.updateState(data.campaignId, {
      lastIngestedSessionId: data.sessionId,
    });
  }

  const shifts = extracted.pressureShifts;
  if (Object.values(shifts).some(v => v !== 0 && v !== undefined)) {
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    await brainRepository.updateState(data.campaignId, {
      pressurePolitical: clamp(worldState.pressurePolitical + (shifts.political ?? 0)),
      pressureSupernatural: clamp(worldState.pressureSupernatural + (shifts.supernatural ?? 0)),
      pressureEconomic: clamp(worldState.pressureEconomic + (shifts.economic ?? 0)),
      pressureCosmic: clamp(worldState.pressureCosmic + (shifts.cosmic ?? 0)),
      pressureSocial: clamp(worldState.pressureSocial + (shifts.social ?? 0)),
    });

    await brainRepository.logChange({
      campaignId: data.campaignId,
      sessionId: data.sessionId,
      changeType: 'pressure_shift',
      newValue: shifts,
      source: 'ingestion',
    });
  }

  result.success = true;
  return result;
}

const worker = new Worker<BrainIngestionJobData, BrainIngestionJobResult>(
  'brain-ingestion',
  async (job) => {
    try {
      return await processBrainIngestionJob(job.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[brain-ingestion] Job failed for session ${job.data.sessionId}:`, message);
      throw error;
    }
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('completed', (job, result) => {
  console.log(`[brain-ingestion] Job ${job.id} completed: ${result.entitiesCreated} created, ${result.entitiesUpdated} updated, ${result.hooksAdded} hooks`);
});

worker.on('failed', (job, err) => {
  console.error(`[brain-ingestion] Job ${job?.id} failed:`, err.message);
});

console.log('[brain-ingestion] Worker started');

async function shutdown() {
  console.log('[brain-ingestion] Shutting down...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
