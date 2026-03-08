import { TRPCError } from '@trpc/server';
import { WorldEntityType, WorldEntityStatus } from '@prisma/client';
import { brainRepository } from '../repositories/brain.repository';
import { authz } from './authorization.service';

export class BrainService {
  private async requireDM(campaignId: string, userId: string) {
    const access = await authz.campaign(campaignId, userId).verify();
    if (!access.isDM) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'DM access required' });
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
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Entity not found' });
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
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Entity not found' });
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
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Entity not found' });
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

  async getTimeline(campaignId: string, userId: string, limit?: number) {
    await this.requireDM(campaignId, userId);
    return brainRepository.getTimeline(campaignId, limit);
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
