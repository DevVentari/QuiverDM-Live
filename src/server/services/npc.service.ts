import { TRPCError } from '@trpc/server';
import { npcRepository } from '../repositories/npc.repository';
import { authz } from './authorization.service';
import { indexNpc, deleteNpc, searchNpcs } from '@/lib/search';
import { addEmbeddingJob } from '@/lib/queue/embeddings-queue';
import { deleteEntityEmbeddings } from '../repositories/embedding.repository';
import { NotFoundError, ValidationError } from '../errors';

function validateNpcName(name: string | undefined, required: boolean) {
  if (required && (!name || !name.trim())) {
    throw ValidationError.forField('name', 'NPC name is required');
  }

  if (name !== undefined && name.length > 255) {
    throw ValidationError.forField('name', 'NPC name must be 255 characters or fewer');
  }
}

export class NPCService {
  async getById(npcId: string, userId: string) {
    const access = await authz.npc(npcId, userId).verify();
    const npc = await npcRepository.findById(npcId);

    if (!npc) {
      throw new NotFoundError('npc', npcId);
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
        // MeiliSearch unavailable; fall back to Postgres
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
    validateNpcName(input.name, true);

    await authz.campaign(campaignId, userId).requirePermission('canEditNPCs');
    const npc = await npcRepository.create({ campaignId, ...input, name: input.name.trim() });

    void indexNpc({
      id: npc.id,
      campaignId: npc.campaignId,
      name: npc.name,
      description: npc.description ?? null,
      faction: npc.faction ?? null,
      tags: npc.tags ?? [],
    }).catch((error) => {
      console.error('[search] Failed to index NPC:', error);
    });

    void addEmbeddingJob({
      entityId: npc.id,
      entityType: 'npc',
      text: [npc.name, npc.description, npc.secrets].filter(Boolean).join('\n\n'),
      metadata: {
        name: npc.name,
        faction: npc.faction,
        role: npc.role,
      },
      campaignId: npc.campaignId,
    }).catch((error) => {
      console.error('[embeddings] Failed to enqueue NPC:', error);
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
    validateNpcName(input.name, false);

    await authz.npc(npcId, userId).requireEdit();
    const nextInput = {
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    };

    const npc = await npcRepository.update(npcId, nextInput);

    void indexNpc({
      id: npc.id,
      campaignId: npc.campaignId,
      name: npc.name,
      description: npc.description ?? null,
      faction: npc.faction ?? null,
      tags: npc.tags ?? [],
    }).catch((error) => {
      console.error('[search] Failed to index NPC:', error);
    });

    void addEmbeddingJob({
      entityId: npc.id,
      entityType: 'npc',
      text: [npc.name, npc.description, npc.secrets].filter(Boolean).join('\n\n'),
      metadata: {
        name: npc.name,
        faction: npc.faction,
        role: npc.role,
      },
      campaignId: npc.campaignId,
    }).catch((error) => {
      console.error('[embeddings] Failed to enqueue NPC:', error);
    });

    return npc;
  }

  async delete(npcId: string, userId: string) {
    await authz.npc(npcId, userId).requireEdit();
    await npcRepository.remove(npcId);
    void deleteEntityEmbeddings(npcId, 'npc').catch((error) => {
      console.error('[embeddings] Failed to delete NPC embeddings:', error);
    });
    void deleteNpc(npcId).catch((error) => {
      console.error('[search] Failed to delete NPC index:', error);
    });
    return { success: true };
  }
}

export const npcService = new NPCService();

