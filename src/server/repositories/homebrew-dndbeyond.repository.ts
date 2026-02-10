/**
 * Homebrew D&D Beyond Repository
 *
 * Data access layer for D&D Beyond import/export operations.
 * Contains no business logic - only database queries.
 */

import { prisma } from '@/lib/prisma';

// =============================================================================
// Repository Functions
// =============================================================================

/**
 * Create homebrew content from D&D Beyond import
 */
export async function createFromImport(data: {
  userId: string;
  type: string;
  name: string;
  data: any;
  images?: string[];
  tags?: string[];
  searchText: string;
  dndBeyondId: string;
  dndBeyondUrl: string;
}) {
  return prisma.homebrewContent.create({
    data: {
      userId: data.userId,
      type: data.type,
      name: data.name,
      data: data.data,
      images: data.images || [],
      tags: data.tags || [],
      searchText: data.searchText,
      dndBeyondId: data.dndBeyondId,
      dndBeyondUrl: data.dndBeyondUrl,
      sourceType: 'dndbeyond_import',
    },
  });
}

/**
 * Add homebrew content to a campaign
 */
export async function addToCampaign(homebrewId: string, campaignId: string) {
  return prisma.campaignHomebrewContent.create({
    data: {
      campaignId,
      homebrewId,
    },
  });
}

/**
 * Find homebrew content by ID
 */
export async function findById(id: string) {
  return prisma.homebrewContent.findUnique({
    where: { id },
  });
}

/**
 * Find multiple homebrew items by IDs
 */
export async function findByIds(ids: string[]) {
  return prisma.homebrewContent.findMany({
    where: {
      id: { in: ids },
    },
    orderBy: { type: 'asc' },
  });
}

/**
 * Find existing content by D&D Beyond ID
 */
export async function findByDnDBeyondId(userId: string, dndBeyondId: string) {
  return prisma.homebrewContent.findFirst({
    where: {
      userId,
      dndBeyondId,
    },
  });
}

// Export all functions as a repository object
export const homebrewDndbeyondRepository = {
  createFromImport,
  addToCampaign,
  findById,
  findByIds,
  findByDnDBeyondId,
};
