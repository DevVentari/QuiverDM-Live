import { TRPCError } from '@trpc/server';
import { npcRepository } from '../repositories/npc.repository';
import { authz } from './authorization.service';
import { indexNpc, deleteNpc, searchNpcs } from '@/lib/search';
import { addEmbeddingJob } from '@/lib/queue/embeddings-queue';
import { deleteEntityEmbeddings } from '../repositories/embedding.repository';
import { NotFoundError, ValidationError } from '../errors';
import { prisma } from '@/lib/prisma';

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
    // First try the NPC table (DM-managed records)
    const npc = await npcRepository.findById(npcId);
    if (npc) {
      const access = await authz.npc(npcId, userId).verify();
      const canViewSecrets =
        access.isDM || access.member?.permissions.canViewNPCSecrets;
      return canViewSecrets ? npc : { ...npc, secrets: null };
    }

    // Fall back to WorldEntity (sourcebook-imported NPCs live here)
    const entity = await prisma.worldEntity.findUnique({
      where: { id: npcId },
      select: {
        id: true,
        campaignId: true,
        type: true,
        name: true,
        description: true,
        properties: true,
        ddbChapterId: true,
        firstSeenSessionId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!entity || entity.type !== 'NPC') {
      throw new NotFoundError('npc', npcId);
    }
    await authz.campaign(entity.campaignId, userId).verify();
    const props = (entity.properties ?? {}) as Record<string, unknown>;
    return {
      id: entity.id,
      campaignId: entity.campaignId,
      name: entity.name,
      description: entity.description,
      faction: typeof props.faction === 'string' ? (props.faction as string) : null,
      role: typeof props.role === 'string' ? (props.role as string) : null,
      imageUrl: null,
      stats: null,
      tags: [] as string[],
      secrets: null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      _source: 'entity' as const,
      _readonly: true,
      _fromSourcebook: entity.ddbChapterId !== null,
      _seen: entity.firstSeenSessionId !== null,
    };
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

