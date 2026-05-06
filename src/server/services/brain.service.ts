import { WorldEntityType, WorldEntityStatus, WorldStateChangeType, WorldStateChangeSource, Prisma } from '@prisma/client';
import { brainRepository } from '../repositories/brain.repository';
import { authz } from './authorization.service';
import { ForbiddenError, NotFoundError } from '../errors';
import { prisma } from '../db';
import { addBrainIngestionJob } from '@/lib/queue/brain-ingestion-queue';
import { callGeminiVision } from '@/lib/ai/gemini';

export class BrainService {
  private async requireDM(campaignId: string, userId: string) {
    const access = await authz.campaign(campaignId, userId).verify();
    if (!access.isDM) {
      throw ForbiddenError.forPermission('manage', 'DM Brain');
    }
    return access;
  }

  async listEntities(campaignId: string, userId: string, opts?: { type?: WorldEntityType; status?: WorldEntityStatus; search?: string }) {
    await this.requireDM(campaignId, userId);
    return brainRepository.findEntities(campaignId, opts);
  }

  async getEntity(entityId: string, campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    const entity = await brainRepository.findEntityById(entityId);
    if (!entity || entity.campaignId !== campaignId) {
      throw new NotFoundError('world entity', entityId);
    }
    return entity;
  }

  async createOrUpdateEntity(campaignId: string, userId: string, data: Parameters<typeof brainRepository.upsertEntity>[1]) {
    await this.requireDM(campaignId, userId);
    const entity = await brainRepository.upsertEntity(campaignId, data);
    await brainRepository.logChange({
      campaignId,
      entityId: entity.id,
      changeType: 'property_update',
      newValue: data,
      source: 'dm_edit',
    });
    return entity;
  }

  async seedFromCreation(
    campaignId: string,
    userId: string,
    input: {
      worldSetup?: {
        startingLocation?: string;
        antagonistName?: string;
        antagonistMotivation?: string;
        openingHook?: string;
        factions?: Array<{
          name: string;
          stance: 'ally' | 'neutral' | 'hostile';
        }>;
      };
      storyText?: string;
    }
  ) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      select: { id: true },
    });
    if (!campaign) {
      throw ForbiddenError.forPermission('manage', 'campaign');
    }

    const { worldSetup, storyText } = input;

    if (worldSetup?.startingLocation?.trim()) {
      await brainRepository.upsertEntity(campaignId, {
        type: WorldEntityType.LOCATION,
        name: worldSetup.startingLocation.trim(),
        sourceType: 'campaign_creation',
      });
    }

    if (worldSetup?.antagonistName?.trim()) {
      await brainRepository.upsertEntity(campaignId, {
        type: WorldEntityType.THREAT,
        name: worldSetup.antagonistName.trim(),
        description: worldSetup.antagonistMotivation?.trim() || undefined,
        sourceType: 'campaign_creation',
      });
    }

    if (worldSetup?.factions) {
      for (const faction of worldSetup.factions) {
        if (!faction.name.trim()) continue;
        await brainRepository.upsertEntity(campaignId, {
          type: WorldEntityType.FACTION,
          name: faction.name.trim(),
          properties: { stance: faction.stance },
          sourceType: 'campaign_creation',
        });
      }
    }

    if (worldSetup?.openingHook?.trim()) {
      const state = await brainRepository.getOrCreateState(campaignId);
      const existingHooks = Array.isArray(state.hooks)
        ? (state.hooks as Record<string, unknown>[])
        : [];
      await brainRepository.updateState(campaignId, {
        hooks: [
          ...existingHooks,
          {
            id: `hook-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text: worldSetup.openingHook.trim(),
            createdSessionId: null,
            ageInSessions: 0,
            urgency: 'medium',
            status: 'open',
            linkedEntityNames: [],
          },
        ],
      });
    }

    if (storyText?.trim()) {
      await addBrainIngestionJob({
        campaignId,
        sessionId: null,
        summary: storyText.trim(),
        highlights: [],
        source: 'campaign_creation',
      });
    }

    return { success: true };
  }

  async updateEntity(entityId: string, campaignId: string, userId: string, data: Parameters<typeof brainRepository.updateEntity>[1]) {
    await this.requireDM(campaignId, userId);
    const existing = await brainRepository.findEntityById(entityId);
    if (!existing || existing.campaignId !== campaignId) {
      throw new NotFoundError('world entity', entityId);
    }
    const updated = await brainRepository.updateEntity(entityId, data);
    await brainRepository.logChange({
      campaignId,
      entityId,
      changeType: 'property_update',
      previousValue: { name: existing.name, status: existing.status, properties: existing.properties },
      newValue: data,
      source: 'dm_edit',
    });
    return updated;
  }

  async deleteEntity(entityId: string, campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    const existing = await brainRepository.findEntityById(entityId);
    if (!existing || existing.campaignId !== campaignId) {
      throw new NotFoundError('world entity', entityId);
    }
    return brainRepository.deleteEntity(entityId);
  }

  async listRelationships(campaignId: string, userId: string, entityId?: string) {
    await this.requireDM(campaignId, userId);
    return brainRepository.findRelationships(campaignId, entityId);
  }

  async upsertRelationship(campaignId: string, userId: string, data: { fromEntityId: string; toEntityId: string; type: string; strength?: number; description?: string }) {
    await this.requireDM(campaignId, userId);
    return brainRepository.upsertRelationship({ campaignId, ...data });
  }

  async deleteRelationship(relationshipId: string, campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    const existing = await brainRepository.findRelationshipById(relationshipId);
    if (!existing || existing.campaignId !== campaignId) {
      throw new NotFoundError('world relationship', relationshipId);
    }
    return brainRepository.deleteRelationship(relationshipId);
  }

  async getState(campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    return brainRepository.getOrCreateState(campaignId);
  }

  async updateState(campaignId: string, userId: string, data: Parameters<typeof brainRepository.updateState>[1]) {
    await this.requireDM(campaignId, userId);
    const existing = await brainRepository.getOrCreateState(campaignId);
    const updated = await brainRepository.updateState(campaignId, data);
    await brainRepository.logChange({
      campaignId,
      changeType: 'pressure_shift',
      previousValue: {
        pressurePolitical: existing.pressurePolitical,
        pressureSupernatural: existing.pressureSupernatural,
        pressureEconomic: existing.pressureEconomic,
        pressureCosmic: existing.pressureCosmic,
        pressureSocial: existing.pressureSocial,
      },
      newValue: data,
      source: 'dm_edit',
    });
    return updated;
  }

  async getTimeline(campaignId: string, userId: string, limit?: number, entityId?: string) {
    await this.requireDM(campaignId, userId);
    return brainRepository.getTimeline(campaignId, limit, entityId);
  }

  async getEntitySessionHistory(entityId: string, campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    return brainRepository.getEntitySessionHistory(entityId);
  }

  async getSessionEntities(sessionId: string, campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    return brainRepository.getSessionEntities(sessionId);
  }

  async getContinuityWarnings(campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);

    const changes = await brainRepository.getTimeline(campaignId, 500);
    const entities = await brainRepository.findEntities(campaignId, { limit: 500 });
    const entityMap = new Map(entities.map(e => [e.id, e]));

    const warnings: Array<{ type: 'destroyed_referenced' | 'contradictory_update'; entityId: string; entityName: string; description: string }> = [];

    const destroyedAt = new Map<string, Date>();
    for (const change of [...changes].reverse()) {
      if (!change.entityId) continue;
      const newVal = change.newValue as Record<string, unknown>;
      if (newVal?.status === 'destroyed' || newVal?.status === WorldEntityStatus.destroyed) {
        destroyedAt.set(change.entityId, change.createdAt);
      }
    }

    for (const change of changes) {
      if (!change.entityId) continue;
      const destroyedTime = destroyedAt.get(change.entityId);
      if (!destroyedTime) continue;
      if (change.createdAt > destroyedTime) {
        const entity = entityMap.get(change.entityId);
        if (!entity) continue;
        const alreadyWarned = warnings.some(w => w.entityId === change.entityId && w.type === 'destroyed_referenced');
        if (!alreadyWarned) {
          warnings.push({
            type: 'destroyed_referenced',
            entityId: change.entityId,
            entityName: entity.name,
            description: `Entity "${entity.name}" was referenced after being destroyed.`,
          });
        }
      }
    }

    const entityPropertyHistory = new Map<string, Array<{ value: unknown; createdAt: Date }>>();
    for (const change of [...changes].reverse()) {
      if (!change.entityId || change.changeType !== 'property_update') continue;
      const entries = entityPropertyHistory.get(change.entityId) ?? [];
      entries.push({ value: change.newValue, createdAt: change.createdAt });
      entityPropertyHistory.set(change.entityId, entries);
    }

    for (const [entityId, history] of entityPropertyHistory) {
      if (history.length < 2) continue;
      const entity = entityMap.get(entityId);
      if (!entity) continue;
      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1].value as Record<string, unknown>;
        const curr = history[i].value as Record<string, unknown>;
        const prevStatus = prev?.status;
        const currStatus = curr?.status;
        if (prevStatus && currStatus && prevStatus !== currStatus &&
            prevStatus === WorldEntityStatus.destroyed && currStatus === WorldEntityStatus.active) {
          const alreadyWarned = warnings.some(w => w.entityId === entityId && w.type === 'contradictory_update');
          if (!alreadyWarned) {
            warnings.push({
              type: 'contradictory_update',
              entityId,
              entityName: entity.name,
              description: `Entity "${entity.name}" was marked active after destruction.`,
            });
          }
        }
      }
    }

    return warnings;
  }

  async ingestDocument(
    campaignId: string,
    userId: string,
    data: { type: 'pdf' | 'image' | 'text'; url?: string; content?: string; sourceLabel: string }
  ) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      select: { id: true },
    });
    if (!campaign) throw ForbiddenError.forPermission('ingest documents into', 'campaign');

    const source = await prisma.brainIngestSource.create({
      data: {
        campaignId,
        type: data.type,
        sourceLabel: data.sourceLabel,
        status: 'processing',
      },
    });

    let summary: string;
    try {
      if (data.type === 'text') {
        if (!data.content) throw new Error('content required for text ingestion');
        summary = data.content;
      } else if (data.type === 'pdf') {
        if (!data.url) throw new Error('url required for pdf ingestion');
        const doclingUrl = process.env.DOCLING_URL ?? 'http://localhost:5001';
        const res = await fetch(`${doclingUrl}/convert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ http_sources: [{ url: data.url }] }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) throw new Error(`Docling error ${res.status}: ${await res.text()}`);
        const json = await res.json() as { document?: { md_content?: string }; md_content?: string };
        summary = json.document?.md_content ?? json.md_content ?? '';
        if (!summary) throw new Error('Docling returned empty markdown');
      } else {
        if (!data.url) throw new Error('url required for image ingestion');
        const imageRes = await fetch(data.url, { signal: AbortSignal.timeout(30_000) });
        if (!imageRes.ok) throw new Error(`Failed to fetch image: ${imageRes.status}`);
        const arrayBuffer = await imageRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imageRes.headers.get('content-type') ?? 'image/jpeg';
        summary = await callGeminiVision(
          'Extract all text, character names, locations, items, factions, events, and lore from this image. Return a descriptive plain-text summary.',
          [{ mimeType, base64Data }]
        );
      }

      await addBrainIngestionJob({
        sessionId: null,
        campaignId,
        summary,
        highlights: [],
        source: 'document',
      });

      await prisma.brainIngestSource.update({
        where: { id: source.id },
        data: { status: 'done', completedAt: new Date() },
      });
    } catch (err) {
      await prisma.brainIngestSource.update({
        where: { id: source.id },
        data: { status: 'failed', errorMessage: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }

    return { sourceId: source.id };
  }

  async listIngestSources(campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    return prisma.brainIngestSource.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async listMergeCandidates(campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    return prisma.entityMergeCandidate.findMany({
      where: { campaignId, status: 'pending' },
      include: { entityA: true, entityB: true },
      orderBy: { score: 'desc' },
    });
  }

  async approveMergeCandidate(candidateId: string, campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    const candidate = await prisma.entityMergeCandidate.findUnique({
      where: { id: candidateId },
      include: { entityA: true, entityB: true },
    });
    if (!candidate || candidate.campaignId !== campaignId) {
      throw new NotFoundError('merge candidate', candidateId);
    }

    // Merge entityA data into entityB, then delete entityA
    const aProps = (candidate.entityA.properties ?? {}) as Record<string, unknown>;
    const bProps = (candidate.entityB.properties ?? {}) as Record<string, unknown>;
    await brainRepository.updateEntity(candidate.entityBId, {
      description: candidate.entityB.description ?? candidate.entityA.description ?? undefined,
      properties: { ...aProps, ...bProps },
    });
    await prisma.worldEntity.delete({ where: { id: candidate.entityAId } });

    await prisma.entityMergeRule.upsert({
      where: { campaignId_entityAId_entityBId: { campaignId, entityAId: candidate.entityAId, entityBId: candidate.entityBId } },
      create: { campaignId, entityAId: candidate.entityBId, entityBId: candidate.entityBId, decision: 'merge' },
      update: { decision: 'merge' },
    });

    await prisma.entityMergeCandidate.update({
      where: { id: candidateId },
      data: { status: 'approved', decidedAt: new Date() },
    });

    return { success: true };
  }

  async rejectMergeCandidate(candidateId: string, campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    const candidate = await prisma.entityMergeCandidate.findUnique({
      where: { id: candidateId },
    });
    if (!candidate || candidate.campaignId !== campaignId) {
      throw new NotFoundError('merge candidate', candidateId);
    }

    await prisma.entityMergeRule.upsert({
      where: { campaignId_entityAId_entityBId: { campaignId, entityAId: candidate.entityAId, entityBId: candidate.entityBId } },
      create: { campaignId, entityAId: candidate.entityAId, entityBId: candidate.entityBId, decision: 'never' },
      update: { decision: 'never' },
    });

    await prisma.entityMergeCandidate.update({
      where: { id: candidateId },
      data: { status: 'rejected', decidedAt: new Date() },
    });

    return { success: true };
  }

  async seedFromExisting(campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);

    const [npcs, campaignChars] = await Promise.all([
      brainRepository.getExistingNpcs(campaignId),
      brainRepository.getExistingCharacters(campaignId),
    ]);

    const results = { npcsSeeded: 0, charactersSeeded: 0, errors: [] as string[] };

    for (const npc of npcs) {
      try {
        await brainRepository.upsertEntity(campaignId, {
          type: WorldEntityType.NPC,
          name: npc.name,
          description: npc.description ?? undefined,
          properties: {
            faction: npc.faction,
            role: npc.role,
          },
          sourceType: 'NPC',
          sourceId: npc.id,
        });
        results.npcsSeeded++;
      } catch (e) {
        results.errors.push(`NPC ${npc.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const cc of campaignChars) {
      if (!cc.character) continue;
      try {
        await brainRepository.upsertEntity(campaignId, {
          type: WorldEntityType.PC,
          name: cc.character.name,
          properties: {
            class: cc.character.class,
            background: cc.character.background,
          },
          sourceType: 'Character',
          sourceId: cc.character.id,
        });
        results.charactersSeeded++;
      } catch (e) {
        results.errors.push(`Character ${cc.character.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return results;
  }

  async listProposals(campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);
    return prisma.worldEventProposal.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async approveProposal(proposalId: string, campaignId: string, userId: string, eventIds: string[]) {
    await this.requireDM(campaignId, userId);

    const proposal = await prisma.worldEventProposal.findUnique({ where: { id: proposalId } });
    if (!proposal || proposal.campaignId !== campaignId) {
      throw new NotFoundError('world event proposal', proposalId);
    }
    if (proposal.status !== 'pending') {
      throw new Error('Proposal is not pending');
    }

    const events = proposal.events as Array<{
      id: string;
      actorId: string | null;
      description: string;
      effects: Array<Record<string, unknown>>;
      approved: boolean | null;
    }>;

    const eventIdSet = new Set(eventIds);
    const updatedEvents = events.map(e => ({
      ...e,
      approved: eventIdSet.has(e.id) ? true : false,
    }));

    const approvedEvents = updatedEvents.filter(e => e.approved === true);
    const allApproved = updatedEvents.every(e => e.approved === true);
    const someApproved = approvedEvents.length > 0;
    const newStatus = allApproved ? 'approved' : someApproved ? 'partially_approved' : 'rejected';

    await prisma.$transaction(async (tx) => {
      for (const event of approvedEvents) {
        for (const effect of event.effects) {
          if (effect.type === 'pressure_shift') {
            const track = effect.track as string;
            const delta = typeof effect.delta === 'number' ? effect.delta : 0;
            const fieldMap: Record<string, string> = {
              political: 'pressurePolitical',
              supernatural: 'pressureSupernatural',
              economic: 'pressureEconomic',
              cosmic: 'pressureCosmic',
              social: 'pressureSocial',
            };
            const field = fieldMap[track];
            if (field) {
              const state = await tx.worldState.findUnique({ where: { campaignId } });
              if (state) {
                const current = (state as Record<string, unknown>)[field] as number;
                const next = Math.max(0, Math.min(1, current + delta));
                await tx.worldState.update({
                  where: { campaignId },
                  data: { [field]: next },
                });
                await tx.worldStateChange.create({
                  data: {
                    campaignId,
                    changeType: WorldStateChangeType.pressure_shift,
                    previousValue: { [field]: current } as Prisma.InputJsonValue,
                    newValue: { [field]: next, track, delta } as Prisma.InputJsonValue,
                    triggerText: event.description,
                    source: WorldStateChangeSource.inference,
                  },
                });
              }
            }
          } else if (effect.type === 'hook_resolve') {
            const hookId = effect.hookId as string;
            const resolution = effect.resolution as string;
            const state = await tx.worldState.findUnique({ where: { campaignId } });
            if (state) {
              const hooks = (state.hooks as Array<Record<string, unknown>>) ?? [];
              const updated = hooks.map(h => h.id === hookId ? { ...h, status: 'resolved', resolution } : h);
              await tx.worldState.update({ where: { campaignId }, data: { hooks: updated as Prisma.InputJsonValue } });
              await tx.worldStateChange.create({
                data: {
                  campaignId,
                  changeType: WorldStateChangeType.status_change,
                  newValue: { hookId, resolution, action: 'hook_resolve' } as Prisma.InputJsonValue,
                  triggerText: event.description,
                  source: WorldStateChangeSource.inference,
                },
              });
            }
          } else if (effect.type === 'hook_create') {
            const { nanoid } = await import('nanoid');
            const state = await tx.worldState.findUnique({ where: { campaignId } });
            if (state) {
              const hooks = (state.hooks as Array<Record<string, unknown>>) ?? [];
              const newHook = {
                id: nanoid(),
                text: effect.hookDescription as string,
                urgency: effect.urgency ?? 'medium',
                status: 'open',
                ageInSessions: 0,
                linkedEntityIds: effect.linkedEntityIds ?? [],
              };
              await tx.worldState.update({ where: { campaignId }, data: { hooks: [...hooks, newHook] as Prisma.InputJsonValue } });
              await tx.worldStateChange.create({
                data: {
                  campaignId,
                  changeType: WorldStateChangeType.property_update,
                  newValue: { action: 'hook_create', hook: newHook } as Prisma.InputJsonValue,
                  triggerText: event.description,
                  source: WorldStateChangeSource.inference,
                },
              });
            }
          } else if (effect.type === 'entity_status') {
            const entityId = effect.entityId as string;
            const newStatus = effect.newStatus as string;
            const entity = await tx.worldEntity.findUnique({ where: { id: entityId } });
            if (entity && entity.campaignId === campaignId) {
              await tx.worldEntity.update({ where: { id: entityId }, data: { status: newStatus as any } });
              await tx.worldStateChange.create({
                data: {
                  campaignId,
                  entityId,
                  changeType: WorldStateChangeType.status_change,
                  previousValue: { status: entity.status } as Prisma.InputJsonValue,
                  newValue: { status: newStatus } as Prisma.InputJsonValue,
                  triggerText: event.description,
                  source: WorldStateChangeSource.inference,
                },
              });
            }
          } else if (effect.type === 'relationship_change') {
            const fromEntityId = effect.fromEntityId as string;
            const toEntityId = effect.toEntityId as string;
            const strengthDelta = typeof effect.strengthDelta === 'number' ? effect.strengthDelta : 0;
            const newDescription = effect.newDescription as string | undefined;
            const rel = await tx.worldRelationship.findFirst({
              where: { campaignId, fromEntityId, toEntityId },
            });
            if (rel) {
              const nextStrength = Math.max(0, Math.min(1, rel.strength + strengthDelta));
              const history = Array.isArray(rel.history) ? rel.history as Array<Record<string, unknown>> : [];
              await tx.worldRelationship.update({
                where: { id: rel.id },
                data: {
                  strength: nextStrength,
                  description: newDescription ?? rel.description,
                  history: [...history, { timestamp: new Date().toISOString(), strengthDelta, description: event.description }] as Prisma.InputJsonValue,
                },
              });
              await tx.worldStateChange.create({
                data: {
                  campaignId,
                  changeType: WorldStateChangeType.relationship_change,
                  newValue: { fromEntityId, toEntityId, strengthDelta, newStrength: nextStrength } as Prisma.InputJsonValue,
                  triggerText: event.description,
                  source: WorldStateChangeSource.inference,
                },
              });
            }
          }
        }

        await tx.worldSimulationEvent.create({
          data: {
            campaignId,
            actorId: event.actorId ?? null,
            type: 'world_proposal',
            description: event.description,
            causalChain: [] as Prisma.InputJsonValue,
          },
        });
      }

      await tx.worldEventProposal.update({
        where: { id: proposalId },
        data: {
          status: newStatus,
          events: updatedEvents as unknown as Prisma.InputJsonValue,
          reviewedAt: new Date(),
        },
      });
    });

    return { success: true, approvedCount: approvedEvents.length, status: newStatus };
  }

  async rejectProposal(proposalId: string, campaignId: string, userId: string) {
    await this.requireDM(campaignId, userId);

    const proposal = await prisma.worldEventProposal.findUnique({ where: { id: proposalId } });
    if (!proposal || proposal.campaignId !== campaignId) {
      throw new NotFoundError('world event proposal', proposalId);
    }
    if (proposal.status !== 'pending') {
      throw new Error('Proposal is not pending');
    }

    const events = (proposal.events as Array<Record<string, unknown>>).map(e => ({ ...e, approved: false }));

    await prisma.worldEventProposal.update({
      where: { id: proposalId },
      data: {
        status: 'rejected',
        events: events as unknown as Prisma.InputJsonValue,
        reviewedAt: new Date(),
      },
    });

    return { success: true };
  }
}

export const brainService = new BrainService();
