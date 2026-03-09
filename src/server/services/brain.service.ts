import { WorldEntityType, WorldEntityStatus } from '@prisma/client';
import { brainRepository } from '../repositories/brain.repository';
import { authz } from './authorization.service';
import { ForbiddenError, NotFoundError } from '../errors';

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
}

export const brainService = new BrainService();
