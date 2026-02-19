import { prisma } from '../db';

export async function createContent(data: {
  userId: string;
  type: string;
  name: string;
  data: any;
  images?: string[];
  tags?: string[];
  searchText: string;
  sourceType: string;
  dndBeyondId?: string;
  dndBeyondUrl?: string;
}) {
  return prisma.homebrewContent.create({ data });
}

export async function addContentToCampaign(data: {
  campaignId: string;
  homebrewId: string;
}) {
  return prisma.campaignHomebrewContent.create({ data });
}

export async function findContent(params: {
  userId: string;
  type?: string;
  search?: string;
  tags?: string[];
  campaignId?: string;
  limit: number;
  cursor?: string;
}) {
  const where: any = { userId: params.userId };

  if (params.type) {
    where.type = params.type;
  }

  if (params.search) {
    where.searchText = {
      contains: params.search,
      mode: 'insensitive',
    };
  }

  if (params.tags && params.tags.length > 0) {
    where.tags = {
      hasSome: params.tags,
    };
  }

  if (params.campaignId) {
    where.campaigns = {
      some: {
        campaignId: params.campaignId,
      },
    };
  }

  return prisma.homebrewContent.findMany({
    where,
    take: params.limit + 1,
    cursor: params.cursor ? { id: params.cursor } : undefined,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      campaigns: {
        select: {
          campaignId: true,
        },
      },
    },
  });
}

export async function findById(id: string) {
  return prisma.homebrewContent.findUnique({
    where: { id },
    include: {
      campaigns: {
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
}

export async function updateContent(
  id: string,
  data: {
    name?: string;
    data?: any;
    images?: string[];
    tags?: string[];
    searchText?: string;
  }
) {
  return prisma.homebrewContent.update({
    where: { id },
    data,
  });
}

export async function deleteContent(id: string) {
  return prisma.homebrewContent.delete({ where: { id } });
}

export async function findByType(params: {
  userId: string;
  type: string;
  campaignId?: string;
}) {
  const where: any = {
    userId: params.userId,
    type: params.type,
  };

  if (params.campaignId) {
    where.campaigns = {
      some: {
        campaignId: params.campaignId,
      },
    };
  }

  return prisma.homebrewContent.findMany({
    where,
    orderBy: {
      name: 'asc',
    },
    include: {
      campaigns: {
        select: {
          campaignId: true,
        },
      },
    },
  });
}

export async function getStats(params: { userId: string; campaignId?: string }) {
  const where: any = { userId: params.userId };

  if (params.campaignId) {
    where.campaigns = {
      some: {
        campaignId: params.campaignId,
      },
    };
  }

  const [stats, total] = await Promise.all([
    prisma.homebrewContent.groupBy({
      by: ['type'],
      where,
      _count: { id: true },
    }),
    prisma.homebrewContent.count({ where }),
  ]);

  return { stats, total };
}

export async function addToCampaign(params: {
  campaignId: string;
  homebrewId: string;
}) {
  return prisma.campaignHomebrewContent.upsert({
    where: {
      campaignId_homebrewId: {
        campaignId: params.campaignId,
        homebrewId: params.homebrewId,
      },
    },
    create: {
      campaignId: params.campaignId,
      homebrewId: params.homebrewId,
    },
    update: {},
  });
}

export async function removeFromCampaign(params: {
  campaignId: string;
  homebrewId: string;
}) {
  return prisma.campaignHomebrewContent.delete({
    where: {
      campaignId_homebrewId: {
        campaignId: params.campaignId,
        homebrewId: params.homebrewId,
      },
    },
  });
}

export const homebrewRepository = {
  createContent,
  addContentToCampaign,
  findContent,
  findById,
  updateContent,
  deleteContent,
  findByType,
  getStats,
  addToCampaign,
  removeFromCampaign,
};
