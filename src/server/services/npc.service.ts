import { TRPCError } from '@trpc/server';
import { npcRepository } from '../repositories/npc.repository';
import { authz } from './authorization.service';
import { indexNpc, deleteNpc, searchNpcs } from '@/lib/search';

export class NPCService {
  async getById(npcId: string, userId: string) {
    const access = await authz.npc(npcId, userId).verify();
    const npc = await npcRepository.findById(npcId);

    if (!npc) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'NPC not found' });
    }

    const canViewSecrets =
      access.isDM || access.member?.permissions.canViewNPCSecrets;
    if (!canViewSecrets) {
      return {
        ...npc,
        secrets: null,
      };
    }

    return npc;
  }

  async getByCampaignId(
    campaignId: string,
    userId: string,
    options?: { search?: string; faction?: string }
  ) {
    const access = await authz.campaign(campaignId, userId).verify();
    const canViewSecrets =
      access.isDM || access.member?.permissions.canViewNPCSecrets;

    if (options?.search) {
      try {
        const ids = await searchNpcs(options.search, {
          campaignId,
          faction: options.faction,
        });
        if (ids.length > 0) {
          return npcRepository.findByIds(ids, canViewSecrets);
        }
        return [];
      } catch {
        // MeiliSearch unavailable — fall back to Postgres
      }
    }

    return npcRepository.findByCampaignId(
      campaignId,
      canViewSecrets,
      options?.search,
      options?.faction
    );
  }

  async getFactions(campaignId: string, userId: string) {
    await authz.campaign(campaignId, userId).verify();
    const factions = await npcRepository.findFactions(campaignId);
    return factions
      .map((npc) => npc.faction)
      .filter((faction): faction is string => faction !== null)
      .sort();
  }

  async create(
    campaignId: string,
    userId: string,
    input: {
      name: string;
      description?: string;
      secrets?: string;
      faction?: string;
      role?: string;
      imageUrl?: string;
      tags?: string[];
      stats?: any;
    }
  ) {
    await authz.campaign(campaignId, userId).requirePermission('canEditNPCs');
    const npc = await npcRepository.create({ campaignId, ...input });

    void indexNpc({
      id: npc.id,
      campaignId: npc.campaignId,
      name: npc.name,
      description: npc.description ?? null,
      faction: npc.faction ?? null,
      tags: npc.tags ?? [],
    });

    return npc;
  }

  async update(
    npcId: string,
    userId: string,
    input: {
      name?: string;
      description?: string;
      secrets?: string;
      faction?: string;
      role?: string;
      imageUrl?: string;
      tags?: string[];
      stats?: any;
    }
  ) {
    await authz.npc(npcId, userId).requireEdit();
    const npc = await npcRepository.update(npcId, input);

    void indexNpc({
      id: npc.id,
      campaignId: npc.campaignId,
      name: npc.name,
      description: npc.description ?? null,
      faction: npc.faction ?? null,
      tags: npc.tags ?? [],
    });

    return npc;
  }

  async delete(npcId: string, userId: string) {
    await authz.npc(npcId, userId).requireEdit();
    await npcRepository.remove(npcId);
    void deleteNpc(npcId);
    return { success: true };
  }
}

export const npcService = new NPCService();
