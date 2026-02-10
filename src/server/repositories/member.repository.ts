/**
 * Member Repository
 *
 * Data access layer for campaign member operations.
 * Contains no business logic - only database queries.
 */

import { prisma } from '@/lib/prisma';
import { CampaignRole } from '@prisma/client';
import { nanoid } from 'nanoid';

// =============================================================================
// Repository Functions
// =============================================================================

/**
 * Find all members of a campaign
 */
export async function findByCampaignId(campaignId: string) {
  return prisma.campaignMember.findMany({
    where: { campaignId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          displayName: true,
        },
      },
    },
    orderBy: [
      { role: 'asc' }, // OWNER first, then CO_DM, PLAYER, SPECTATOR
      { joinedAt: 'asc' },
    ],
  });
}

/**
 * Find a user's membership in a campaign
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
 * Find a member by ID
 */
export async function findById(id: string) {
  return prisma.campaignMember.findUnique({
    where: { id },
  });
}

/**
 * Create a new membership
 */
export async function createMembership(data: {
  campaignId: string;
  userId: string;
  role: CampaignRole;
  invitedBy?: string;
}) {
  return prisma.campaignMember.create({
    data,
    include: {
      campaign: {
        select: { id: true, name: true, slug: true },
      },
    },
  });
}

/**
 * Update a member's role and permissions
 */
export async function updateMember(
  id: string,
  data: {
    role?: CampaignRole;
    canViewNPCSecrets?: boolean;
    canEditNPCs?: boolean;
    canManageSessions?: boolean;
    canInviteMembers?: boolean;
  }
) {
  return prisma.campaignMember.update({
    where: { id },
    data,
  });
}

/**
 * Delete a membership by ID
 */
export async function removeMember(id: string) {
  return prisma.campaignMember.delete({
    where: { id },
  });
}

/**
 * Delete a membership by campaign and user
 */
export async function removeMemberByUser(campaignId: string, userId: string) {
  return prisma.campaignMember.delete({
    where: {
      campaignId_userId: {
        campaignId,
        userId,
      },
    },
  });
}

// =============================================================================
// Invite Functions
// =============================================================================

/**
 * Find pending invites for a campaign
 */
export async function findPendingInvites(campaignId: string) {
  return prisma.campaignInvite.findMany({
    where: {
      campaignId,
      usedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Find an invite by code
 */
export async function findInviteByCode(code: string) {
  return prisma.campaignInvite.findFirst({
    where: {
      code,
      usedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      campaign: {
        select: { id: true, name: true },
      },
    },
  });
}

/**
 * Find a campaign by permanent invite code
 */
export async function findCampaignByInviteCode(code: string) {
  return prisma.campaign.findFirst({
    where: { inviteCode: code },
  });
}

/**
 * Create an invite
 */
export async function createInvite(data: {
  campaignId: string;
  role: CampaignRole;
  createdBy: string;
  email?: string;
  message?: string;
  expiresInDays?: number;
}) {
  return prisma.campaignInvite.create({
    data: {
      campaignId: data.campaignId,
      code: nanoid(12),
      email: data.email,
      role: data.role,
      createdBy: data.createdBy,
      message: data.message,
      expiresAt: data.expiresInDays
        ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
        : null,
    },
  });
}

/**
 * Mark an invite as used
 */
export async function markInviteUsed(inviteId: string, userId: string) {
  return prisma.campaignInvite.update({
    where: { id: inviteId },
    data: {
      usedAt: new Date(),
      usedBy: userId,
    },
  });
}

/**
 * Delete an invite
 */
export async function deleteInvite(inviteId: string, campaignId: string) {
  return prisma.campaignInvite.delete({
    where: {
      id: inviteId,
      campaignId,
    },
  });
}

/**
 * Regenerate campaign's permanent invite code
 */
export async function regenerateCampaignInviteCode(campaignId: string) {
  return prisma.campaign.update({
    where: { id: campaignId },
    data: { inviteCode: nanoid(8) },
  });
}

/**
 * Accept invite - creates membership and marks invite used in transaction
 */
export async function acceptInviteTransaction(
  inviteId: string,
  campaignId: string,
  userId: string,
  role: CampaignRole,
  invitedBy: string
) {
  const [member] = await prisma.$transaction([
    prisma.campaignMember.create({
      data: {
        campaignId,
        userId,
        role,
        invitedBy,
      },
    }),
    prisma.campaignInvite.update({
      where: { id: inviteId },
      data: {
        usedAt: new Date(),
        usedBy: userId,
      },
    }),
  ]);

  return member;
}

/**
 * Transfer ownership between members
 */
export async function transferOwnership(
  campaignId: string,
  currentOwnerId: string,
  newOwnerMemberId: string,
  newOwnerUserId: string
) {
  return prisma.$transaction([
    // Update new owner
    prisma.campaignMember.update({
      where: { id: newOwnerMemberId },
      data: {
        role: CampaignRole.OWNER,
        canViewNPCSecrets: true,
        canEditNPCs: true,
        canManageSessions: true,
        canInviteMembers: true,
      },
    }),
    // Demote current owner to CO_DM
    prisma.campaignMember.update({
      where: {
        campaignId_userId: {
          campaignId,
          userId: currentOwnerId,
        },
      },
      data: {
        role: CampaignRole.CO_DM,
      },
    }),
    // Update legacy userId on campaign
    prisma.campaign.update({
      where: { id: campaignId },
      data: { userId: newOwnerUserId },
    }),
  ]);
}

/**
 * Get campaign by ID (for slug lookup)
 */
export async function getCampaign(campaignId: string) {
  return prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, slug: true },
  });
}

// Export all functions as a repository object
export const memberRepository = {
  findByCampaignId,
  findMembership,
  findById,
  createMembership,
  updateMember,
  removeMember,
  removeMemberByUser,
  findPendingInvites,
  findInviteByCode,
  findCampaignByInviteCode,
  createInvite,
  markInviteUsed,
  deleteInvite,
  regenerateCampaignInviteCode,
  acceptInviteTransaction,
  transferOwnership,
  getCampaign,
};
