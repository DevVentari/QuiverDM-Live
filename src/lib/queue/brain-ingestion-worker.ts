import dotenv from 'dotenv';
if (!process.env.DATABASE_URL) dotenv.config({ path: '.env.local' });

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

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function nameScore(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(aLower, bLower);
  return 1 - dist / maxLen;
}

interface ResolveResult {
  action: 'merge' | 'create' | 'create_provisional';
  targetId?: string;
  bestMatchId?: string;
  score?: number;
}

async function resolveEntity(
  extractedName: string,
  _extractedType: string,
  campaignId: string,
  candidates: Array<{ id: string; name: string; aliases: string[] }>
): Promise<ResolveResult> {
  // 1. Check EntityMergeRule — learned overrides (by name match against entityA)
  const rules = await prisma.entityMergeRule.findMany({
    where: { campaignId },
    include: { entityA: true, entityB: true },
  });
  for (const rule of rules) {
    const matchesA = rule.entityA.name.toLowerCase() === extractedName.toLowerCase() ||
      rule.entityA.aliases.some(a => a.toLowerCase() === extractedName.toLowerCase());
    if (matchesA) {
      if (rule.decision === 'never') return { action: 'create' };
      if (rule.decision === 'merge') return { action: 'merge', targetId: rule.entityBId };
    }
  }

  // 2. Exact name match (case-insensitive)
  const exactMatch = candidates.find(
    c => c.name.toLowerCase() === extractedName.toLowerCase()
  );
  if (exactMatch) return { action: 'merge', targetId: exactMatch.id };

  // 3. Alias match
  const aliasMatch = candidates.find(
    c => c.aliases.some(a => a.toLowerCase() === extractedName.toLowerCase())
  );
  if (aliasMatch) return { action: 'merge', targetId: aliasMatch.id };

  // 4. Fuzzy scoring via Levenshtein
  const scored = candidates
    .map(c => ({ id: c.id, score: nameScore(extractedName, c.name) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 0.70) return { action: 'create' };
  if (best.score >= 0.95) return { action: 'merge', targetId: best.id };

  return { action: 'create_provisional', bestMatchId: best.id, score: best.score };
}

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

  // Build candidate list once — updated after new entities are created
  let candidates = existingEntities.map(e => ({ id: e.id, name: e.name, aliases: e.aliases }));

  for (const entity of extracted.newEntities) {
    const entityType = ENTITY_TYPE_MAP[entity.type];
    if (!entityType) continue;
    try {
      const resolve = await resolveEntity(entity.name, entity.type, data.campaignId, candidates);

      if (resolve.action === 'merge' && resolve.targetId) {
        await brainRepository.updateEntity(resolve.targetId, {
          description: entity.description ?? undefined,
          properties: entity.properties ?? {},
          status: entity.status ? STATUS_MAP[entity.status] : undefined,
          lastSeenSessionId: data.sessionId ?? undefined,
        });

        if (data.sessionId) {
          await brainRepository.recordAppearance({ sessionId: data.sessionId, entityId: resolve.targetId, campaignId: data.campaignId });
        }

        await brainRepository.logChange({
          campaignId: data.campaignId,
          entityId: resolve.targetId,
          sessionId: data.sessionId ?? undefined,
          changeType: 'property_update',
          newValue: { name: entity.name, type: entityType, status: entity.status },
          source: 'ingestion',
        });

        result.entitiesUpdated++;
      } else {
        // create or create_provisional — upsert entity first
        const upserted = await brainRepository.upsertEntity(data.campaignId, {
          type: entityType,
          name: entity.name,
          description: entity.description,
          properties: entity.properties ?? {},
          status: entity.status ? STATUS_MAP[entity.status] : undefined,
          lastSeenSessionId: data.sessionId ?? undefined,
          firstSeenSessionId: data.sessionId ?? undefined,
          confidence: resolve.action === 'create_provisional' ? 0.5 : 0.8,
        });

        if (data.sessionId) {
          await brainRepository.recordAppearance({ sessionId: data.sessionId, entityId: upserted.id, campaignId: data.campaignId });
        }

        await brainRepository.logChange({
          campaignId: data.campaignId,
          entityId: upserted.id,
          sessionId: data.sessionId ?? undefined,
          changeType: 'property_update',
          newValue: { name: entity.name, type: entityType, status: entity.status },
          source: 'ingestion',
        });

        if (resolve.action === 'create_provisional' && resolve.bestMatchId) {
          await prisma.entityMergeCandidate.create({
            data: {
              campaignId: data.campaignId,
              entityAId: upserted.id,
              entityBId: resolve.bestMatchId,
              score: resolve.score!,
              suggestedCanonical: entity.name,
            },
          });
        }

        // Add to candidate pool so subsequent entities in same job can match
        candidates.push({ id: upserted.id, name: upserted.name, aliases: upserted.aliases });

        const key = `${entity.name}:${entityType}`;
        if (existingEntityMap.has(key)) {
          result.entitiesUpdated++;
        } else {
          result.entitiesCreated++;
        }
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
        lastSeenSessionId: data.sessionId ?? undefined,
      });

      if (data.sessionId) {
        await brainRepository.recordAppearance({ sessionId: data.sessionId, entityId: existing.id, campaignId: data.campaignId });
      }

      await brainRepository.logChange({
        campaignId: data.campaignId,
        entityId: existing.id,
        sessionId: data.sessionId ?? undefined,
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
      if (rel.description && data.sessionId) {
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
      createdSessionId: data.sessionId ?? null,
      ageInSessions: 0,
      urgency: hook.urgency,
      status: 'open',
      linkedEntityNames: hook.linkedEntityNames,
    }));

    await brainRepository.updateState(data.campaignId, {
      hooks: [...existingHooks, ...newHooks],
      lastIngestedSessionId: data.sessionId ?? undefined,
    });
    result.hooksAdded = newHooks.length;
  } else {
    await brainRepository.updateState(data.campaignId, {
      lastIngestedSessionId: data.sessionId ?? undefined,
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
      sessionId: data.sessionId ?? undefined,
      changeType: 'pressure_shift',
      newValue: shifts,
      source: 'ingestion',
    });
  }

  // Write pressure history snapshot
  const finalState = await brainRepository.getOrCreateState(data.campaignId);
  await prisma.worldPressureHistory.create({
    data: {
      campaignId: data.campaignId,
      sessionId: data.sessionId ?? null,
      political: finalState.pressurePolitical,
      supernatural: finalState.pressureSupernatural,
      economic: finalState.pressureEconomic,
      cosmic: finalState.pressureCosmic,
      social: finalState.pressureSocial,
    },
  });

  // Compute threat trajectory for THREAT entities with ≥2 changes in last 5 sessions
  const recentSessions = await prisma.gameSession.findMany({
    where: { campaignId: data.campaignId },
    orderBy: { sessionNumber: 'desc' },
    take: 5,
    select: { id: true },
  });
  const recentSessionIds = recentSessions.map(s => s.id);

  const threatEntities = await prisma.worldEntity.findMany({
    where: { campaignId: data.campaignId, type: WorldEntityType.THREAT },
    select: { id: true, properties: true },
  });

  for (const threat of threatEntities) {
    const changes = await prisma.worldStateChange.findMany({
      where: {
        campaignId: data.campaignId,
        entityId: threat.id,
        sessionId: recentSessionIds.length > 0 ? { in: recentSessionIds } : undefined,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (changes.length < 2) continue;

    const props = (threat.properties ?? {}) as Record<string, unknown>;
    const stressValues: number[] = [];
    for (const change of changes) {
      const nv = change.newValue as Record<string, unknown> | null;
      if (!nv) continue;
      const stress = nv['stress'] ?? nv['influence'];
      if (typeof stress === 'number') stressValues.push(stress);
    }

    if (stressValues.length < 2) continue;

    const first = stressValues[0];
    const last = stressValues[stressValues.length - 1];
    const delta = last - first;
    const sessions = stressValues.length - 1;
    const deltaPerSession = delta / sessions;

    const trajectory: Record<string, unknown> = {
      delta_per_session: deltaPerSession,
      computed_at: new Date().toISOString(),
    };

    if (deltaPerSession > 0 && last < 1.0) {
      trajectory['sessions_to_critical'] = Math.ceil((1.0 - last) / deltaPerSession);
    }

    await prisma.worldEntity.update({
      where: { id: threat.id },
      data: { properties: JSON.parse(JSON.stringify({ ...props, trajectory })) },
    });
  }

  // Map notification pass — update lastEventAt for any pins touched in this job
  try {
    const touchedEntityIds = [
      ...extracted.newEntities.map((e: any) => e.name),
      ...extracted.entityUpdates.map((e: any) => e.name),
    ];

    if (touchedEntityIds.length > 0) {
      const touchedEntities = await prisma.worldEntity.findMany({
        where: {
          campaignId: data.campaignId,
          name: { in: touchedEntityIds },
        },
        select: { id: true, type: true, name: true },
      });
      const touchedIds = touchedEntities.map(e => e.id);

      if (touchedIds.length > 0) {
        await prisma.mapPin.updateMany({
          where: { entityId: { in: touchedIds } },
          data: { lastEventAt: new Date() },
        });
      }

      // Auto-create unplaced pins for new LOCATION entities
      const rootMap = await prisma.campaignMap.findFirst({
        where: { campaignId: data.campaignId, parentLocationId: null },
        select: { id: true },
      });
      if (rootMap) {
        const locationEntities = touchedEntities.filter(e => e.type === 'LOCATION');
        for (const loc of locationEntities) {
          const existingPin = await prisma.mapPin.findFirst({ where: { mapId: rootMap.id, entityId: loc.id } });
          if (!existingPin) {
            await prisma.mapPin.create({
              data: { mapId: rootMap.id, entityId: loc.id, x: 50, y: 50, unplaced: true },
            });
          }
        }
      }
    }
  } catch (mapErr) {
    console.warn('[brain-ingestion] Map notification pass failed (non-fatal):', mapErr);
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
      console.error(`[brain-ingestion] Job failed for session/campaign ${job.data.sessionId ?? job.data.campaignId}:`, message);
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
