import { TRPCError } from '@trpc/server';
import { npcRepository } from '../repositories/npc.repository';
import { authz } from './authorization.service';

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
    return npcRepository.create({ campaignId, ...input });
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
    return npcRepository.update(npcId, input);
  }

  async delete(npcId: string, userId: string) {
    await authz.npc(npcId, userId).requireEdit();
    await npcRepository.remove(npcId);
    return { success: true };
  }
}

export const npcService = new NPCService();
