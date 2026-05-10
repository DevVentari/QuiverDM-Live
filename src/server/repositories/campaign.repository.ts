/**
 * Campaign Repository
 *
 * Data access layer for campaign-related database operations.
 * Contains no business logic - only database queries.
 */

import { prisma } from '@/lib/prisma';
import { CampaignRole, Prisma } from '@prisma/client';
import { enqueueMeiliSyncSafe } from '@/lib/queue/meili-sync-queue';

// =============================================================================
// Types
// =============================================================================

export interface CampaignWithCounts {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  status: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    gameSessions: number;
    npcs: number;
    players: number;
    members: number;
  };
}

export interface CampaignStats {
  sessionCount: number;
  npcCount: number;
  playerCount: number;
  homebrewCount: number;
  lastSessionNumber: number;
  lastSessionDate: Date | null;
}

// =============================================================================
// Repository Functions
// =============================================================================

/**
 * Find a campaign by ID
 */
export async function findById(id: string) {
  return prisma.campaign.findUnique({
    where: { id },
  });
}

/**
 * Find a campaign by slug
 */
export async function findBySlug(slug: string) {
  return prisma.campaign.findFirst({
    where: { slug },
  });
}

/**
 * Find all campaigns where user is a member or owner
 */
export async function findByUser(userId: string) {
  return prisma.campaign.findMany({
    where: {
      OR: [
        { userId }, // Legacy owner check
        { members: { some: { userId } } }, // Member check
      ],
    },
    orderBy: {
      updatedAt: 'desc',
    },
    include: {
      members: {
        where: { userId },
        select: {
          role: true,
          canViewNPCSecrets: true,
          canEditNPCs: true,
          canManageSessions: true,
          canInviteMembers: true,
        },
      },
      _count: {
        select: {
          gameSessions: true,
          npcs: true,
          players: true,
          members: true,
        },
      },
    },
  });
}

/**
 * Find campaign with full details for display
 */
export async function findWithDetails(id: string, includeSecrets: boolean = false) {
  return prisma.campaign.findUnique({
    where: { id },
    include: {
      gameSessions: {
        orderBy: {
          sessionNumber: 'desc',
        },
        take: 5,
      },
      npcs: {
        take: 10,
        select: {
          id: true,
          name: true,
          description: true,
          faction: true,
          role: true,
          imageUrl: true,
          tags: true,
          secrets: includeSecrets,
        },
      },
      players: true,
      characters: {
        where: {
          status: 'ACTIVE',
        },
        include: {
          character: {
            select: {
              id: true,
              name: true,
              race: true,
              class: true,
              level: true,
              portraitUrl: true,
            },
          },
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              displayName: true,
              image: true,
            },
          },
        },
      },
      _count: {
        select: {
          gameSessions: true,
          npcs: true,
          players: true,
          homebrewContent: true,
          members: true,
          characters: true,
        },
      },
    },
  });
}

/**
 * Create a new campaign with owner membership
 */
export async function create(data: {
  name: string;
  slug: string;
  description?: string;
  bannerUrl?: string;
  userId: string;
  settings?: Prisma.InputJsonValue;
  players?: Array<{ name: string; characterName: string }>;
}) {
  return prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        bannerUrl: data.bannerUrl,
        userId: data.userId,
        status: 'active',
        ...(data.settings && { settings: data.settings }),
      },
    });

    // Create OWNER membership for the creator
    await tx.campaignMember.create({
      data: {
        campaignId: campaign.id,
        userId: data.userId,
        role: CampaignRole.OWNER,
        canViewNPCSecrets: true,
        canEditNPCs: true,
        canManageSessions: true,
        canInviteMembers: true,
      },
    });

    if (data.players && data.players.length > 0) {
      const validPlayers = data.players.filter(
        (p) => p.name.trim() !== '' || p.characterName.trim() !== ''
      );
      if (validPlayers.length > 0) {
        await tx.player.createMany({
          data: validPlayers.map((p) => ({
            campaignId: campaign.id,
            name: p.name.trim(),
            characterName: p.characterName.trim(),
          })),
        });
      }
    }

    return campaign;
  }).then((campaign) => {
    enqueueMeiliSyncSafe({ kind: 'campaign', op: 'upsert', id: campaign.id });
    return campaign;
  });
}

/**
 * Update a campaign
 */
export async function update(
  id: string,
  data: {
    name?: string;
    slug?: string;
    description?: string;
    bannerUrl?: string;
    status?: string;
    glossary?: Record<string, string>;
  }
) {
  const campaign = await prisma.campaign.update({
    where: { id },
    data,
  });
  enqueueMeiliSyncSafe({ kind: 'campaign', op: 'upsert', id });
  return campaign;
}

/**
 * Delete a campaign
 */
export async function remove(id: string) {
  const campaign = await prisma.campaign.delete({
    where: { id },
  });
  enqueueMeiliSyncSafe({ kind: 'campaign', op: 'delete', id });
  return campaign;
}

/**
 * Check if a slug exists (optionally excluding a campaign)
 */
export async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const where: Prisma.CampaignWhereInput = { slug };
  if (excludeId) {
    where.NOT = { id: excludeId };
  }

  const existing = await prisma.campaign.findFirst({ where });
  return !!existing;
}

/**
 * Get campaign statistics
 */
export async function getStats(campaignId: string): Promise<CampaignStats> {
  const [sessionCount, npcCount, playerCount, homebrewCount, lastSession] =
    await Promise.all([
      prisma.gameSession.count({
        where: { campaignId },
      }),
      prisma.nPC.count({
        where: { campaignId },
      }),
      prisma.player.count({
        where: { campaignId },
      }),
      prisma.homebrewContent.count({
        where: { campaigns: { some: { campaignId } } },
      }),
      prisma.gameSession.findFirst({
        where: { campaignId },
        orderBy: { sessionNumber: 'desc' },
      }),
    ]);

  return {
    sessionCount,
    npcCount,
    playerCount,
    homebrewCount,
    lastSessionNumber: lastSession?.sessionNumber ?? 0,
    lastSessionDate: lastSession?.createdAt ?? null,
  };
}

/**
 * Get user's campaign memberships with dashboard-optimized data
 */
export async function getUserMemberships(userId: string) {
  const memberships = await prisma.campaignMember.findMany({
    where: { userId },
    include: {
      campaign: {
        include: {
          _count: {
            select: {
              gameSessions: true,
              members: true,
              npcs: true,
            },
          },
          gameSessions: {
            where: {
              date: { gte: new Date() },
              status: { notIn: ['completed', 'cancelled'] },
            },
            orderBy: { date: 'asc' },
            take: 1,
            select: {
              id: true,
              date: true,
              title: true,
              sessionNumber: true,
            },
          },
        },
      },
    },
    orderBy: {
      campaign: { updatedAt: 'desc' },
    },
  });

  return memberships;
}

/**
 * Get user's active characters in specified campaigns
 */
export async function getUserCharactersInCampaigns(userId: string, campaignIds: string[]) {
  return prisma.campaignCharacter.findMany({
    where: {
      character: { userId },
      campaignId: { in: campaignIds },
      status: 'ACTIVE',
    },
    include: {
      character: {
        select: {
          id: true,
          name: true,
          class: true,
          level: true,
          portraitUrl: true,
        },
      },
    },
  });
}

/**
 * Get the most recent session date for each campaign
 */
export async function getLastSessionDates(campaignIds: string[]) {
  return prisma.gameSession.findMany({
    where: {
      campaignId: { in: campaignIds },
    },
    orderBy: { date: 'desc' },
    distinct: ['campaignId'],
    select: {
      campaignId: true,
      date: true,
    },
  });
}

/**
 * Get pending invites for a user by email
 */
export async function getPendingInvites(email: string) {
  return prisma.campaignInvite.findMany({
    where: {
      email,
      usedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          slug: true,
          bannerUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Find a valid invite by ID and email
 */
export async function findValidInvite(inviteId: string, email: string) {
  return prisma.campaignInvite.findFirst({
    where: {
      id: inviteId,
      email,
      usedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });
}

/**
 * Find invite by ID (for decline)
 */
export async function findInvite(inviteId: string, email: string) {
  return prisma.campaignInvite.findFirst({
    where: {
      id: inviteId,
      email,
      usedAt: null,
    },
  });
}

/**
 * Check if user is already a member of a campaign
 */
export async function findMembership(campaignId: string, userId: string) {
  return prisma.campaignMember.findUnique({
    where: {
      campaignId_userId: {
        campaignId,
        userId,
      },
    },
  });
}

/**
 * Accept an invite - create membership and mark invite as used
 */
export async function acceptInvite(
  inviteId: string,
  campaignId: string,
  userId: string,
  role: CampaignRole
) {
  const result = await prisma.$transaction([
    prisma.campaignMember.create({
      data: {
        campaignId,
        userId,
        role,
      },
    }),
    prisma.campaignInvite.update({
      where: { id: inviteId },
      data: { usedAt: new Date(), usedBy: userId },
    }),
  ]);
  enqueueMeiliSyncSafe({ kind: 'campaign', op: 'upsert', id: campaignId });
  return result;
}

/**
 * Mark invite as used (when user is already a member)
 */
export async function markInviteUsed(inviteId: string, userId: string) {
  return prisma.campaignInvite.update({
    where: { id: inviteId },
    data: { usedAt: new Date(), usedBy: userId },
  });
}

/**
 * Delete an invite
 */
export async function deleteInvite(inviteId: string) {
  return prisma.campaignInvite.delete({
    where: { id: inviteId },
  });
}

// Export all functions as a repository object
export const campaignRepository = {
  findById,
  findBySlug,
  findByUser,
  findWithDetails,
  create,
  update,
  remove,
  slugExists,
  getStats,
  getUserMemberships,
  getUserCharactersInCampaigns,
  getLastSessionDates,
  getPendingInvites,
  findValidInvite,
  findInvite,
  findMembership,
  acceptInvite,
  markInviteUsed,
  deleteInvite,
};
