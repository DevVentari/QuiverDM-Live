import { prisma } from '../db';

export async function findById(id: string) {
  return prisma.nPC.findUnique({
    where: { id },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function findByCampaignId(
  campaignId: string,
  includeSecrets: boolean = false,
  search?: string,
  faction?: string
) {
  const where: any = { campaignId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { faction: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (faction) {
    where.faction = faction;
  }

  const npcs = await prisma.nPC.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      campaignId: true,
      name: true,
      description: true,
      faction: true,
      role: true,
      imageUrl: true,
      stats: true,
      tags: true,
      secrets: includeSecrets,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Union with WorldEntity NPC rows (DDB-imported NPCs live there). If the
  // brain entity has been linked back to an editable NPC row (sourceType=NPC),
  // skip it — the NPC row above already represents it.
  const entityWhere: any = {
    campaignId,
    type: 'NPC',
    OR: [{ sourceType: { not: 'NPC' } }, { sourceType: null }],
  };
  if (search) {
    entityWhere.AND = [
      {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      },
    ];
  }
  const entities = await prisma.worldEntity.findMany({
    where: entityWhere,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      campaignId: true,
      name: true,
      description: true,
      properties: true,
      createdAt: true,
      updatedAt: true,
      ddbChapterId: true,
      firstSeenSessionId: true,
    },
  });

  const entityNpcs = entities.map((e) => {
    const props = (e.properties ?? {}) as Record<string, unknown>;
    return {
      id: e.id,
      campaignId: e.campaignId,
      name: e.name,
      description: e.description,
      faction: typeof props.faction === 'string' ? (props.faction as string) : null,
      role: typeof props.role === 'string' ? (props.role as string) : null,
      imageUrl: null,
      stats: null,
      tags: [] as string[],
      // entity-source NPCs have no editable secrets
      ...(includeSecrets ? { secrets: null } : {}),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      _source: 'entity' as const,
      _readonly: true,
      _fromSourcebook: e.ddbChapterId !== null,
      _seen: e.firstSeenSessionId !== null,
    };
  });

  // Annotate NPC table rows so the UI can differentiate
  const annotatedNpcs = npcs.map((n) => ({
    ...n,
    _source: 'npc' as const,
    _readonly: false,
    _fromSourcebook: false,
    _seen: false,
  }));

  return [...annotatedNpcs, ...entityNpcs].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export async function findFactions(campaignId: string) {
  return prisma.nPC.findMany({
    where: {
      campaignId,
      faction: {
        not: null,
      },
    },
    select: {
      faction: true,
    },
    distinct: ['faction'],
  });
}

export async function findByIds(ids: string[], includeSecrets = false) {
  return prisma.nPC.findMany({
    where: { id: { in: ids } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      campaignId: true,
      name: true,
      description: true,
      faction: true,
      role: true,
      imageUrl: true,
      stats: true,
      tags: true,
      secrets: includeSecrets,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function create(data: {
  campaignId: string;
  name: string;
  description?: string;
  secrets?: string;
  faction?: string;
  role?: string;
  imageUrl?: string;
  tags?: string[];
  stats?: any;
}) {
  return prisma.nPC.create({ data });
}

export async function update(
  id: string,
  data: {
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
  return prisma.nPC.update({ where: { id }, data });
}

export async function remove(id: string) {
  return prisma.nPC.delete({ where: { id } });
}

export const npcRepository = {
  findById,
  findByCampaignId,
  findByIds,
  findFactions,
  create,
  update,
  remove,
};
