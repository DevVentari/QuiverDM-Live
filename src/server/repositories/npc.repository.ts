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

  return prisma.nPC.findMany({
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
