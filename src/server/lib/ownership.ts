import { TRPCError } from '@trpc/server';
import { CampaignRole } from '@prisma/client';
import { prisma } from '../db';

/**
 * Result of a campaign membership check
 */
export interface CampaignMembershipResult {
  campaign: {
    id: string;
    name: string;
    userId: string; // Legacy owner
  };
  member: {
    id: string;
    role: CampaignRole;
    canViewNPCSecrets: boolean;
    canEditNPCs: boolean;
    canManageSessions: boolean;
    canInviteMembers: boolean;
  } | null; // null if accessing via legacy ownership
  isOwner: boolean;
  isCoOwner: boolean;
  isPlayer: boolean;
  isSpectator: boolean;
}

/**
 * Verify that a campaign belongs to the specified user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyCampaignOwnership(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
  });

  if (!campaign) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this campaign',
    });
  }

  return campaign;
}

/**
 * Verify that a session belongs to a campaign owned by the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifySessionOwnership(sessionId: string, userId: string) {
  const session = await prisma.gameSession.findFirst({
    where: {
      id: sessionId,
      campaign: { userId },
    },
    include: { campaign: true },
  });

  if (!session) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this session',
    });
  }

  return session;
}

/**
 * Verify that an NPC belongs to a campaign owned by the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyNPCOwnership(npcId: string, userId: string) {
  const npc = await prisma.nPC.findFirst({
    where: {
      id: npcId,
      campaign: { userId },
    },
    include: { campaign: true },
  });

  if (!npc) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this NPC',
    });
  }

  return npc;
}

/**
 * Verify that a player belongs to a campaign owned by the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyPlayerOwnership(playerId: string, userId: string) {
  const player = await prisma.player.findFirst({
    where: {
      id: playerId,
      campaign: { userId },
    },
    include: { campaign: true },
  });

  if (!player) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this player',
    });
  }

  return player;
}

/**
 * Verify that a recording belongs to a session in a campaign owned by the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyRecordingOwnership(recordingId: string, userId: string) {
  const recording = await prisma.sessionRecording.findFirst({
    where: {
      id: recordingId,
      session: {
        campaign: { userId },
      },
    },
    include: {
      session: { include: { campaign: true } },
    },
  });

  if (!recording) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this recording',
    });
  }

  return recording;
}

/**
 * Verify that homebrew content belongs to the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyHomebrewOwnership(homebrewId: string, userId: string) {
  const homebrew = await prisma.homebrewContent.findFirst({
    where: {
      id: homebrewId,
      userId,
    },
  });

  if (!homebrew) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this homebrew content',
    });
  }

  return homebrew;
}

/**
 * Verify that a PDF belongs to the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyPDFOwnership(pdfId: string, userId: string) {
  const pdf = await prisma.homebrewPDF.findFirst({
    where: {
      id: pdfId,
      userId,
    },
  });

  if (!pdf) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this PDF',
    });
  }

  return pdf;
}

/**
 * Verify that a transcript belongs to a session in a campaign owned by the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyTranscriptOwnership(transcriptId: string, userId: string) {
  const transcript = await prisma.transcript.findFirst({
    where: {
      id: transcriptId,
      session: {
        campaign: { userId },
      },
    },
    include: {
      session: { include: { campaign: true } },
    },
  });

  if (!transcript) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this transcript',
    });
  }

  return transcript;
}

// =============================================================================
// CAMPAIGN MEMBERSHIP VERIFICATION (Multi-user support)
// =============================================================================

/**
 * Get a user's membership in a campaign
 * Returns null if not a member (but may still have legacy ownership)
 */
export async function getCampaignMembership(campaignId: string, userId: string) {
  return prisma.campaignMember.findUnique({
    where: {
      campaignId_userId: { campaignId, userId },
    },
  });
}

/**
 * Verify that a user has access to a campaign (member or legacy owner)
 * This is the primary function for checking campaign access in the new multi-user system.
 *
 * @throws TRPCError with code FORBIDDEN if user has no access
 */
export async function verifyCampaignMembership(
  campaignId: string,
  userId: string
): Promise<CampaignMembershipResult> {
  // Get campaign with membership info
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      members: {
        where: { userId },
      },
    },
  });

  if (!campaign) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Campaign not found',
    });
  }

  const member = campaign.members[0] || null;
  const isLegacyOwner = campaign.userId === userId;

  // Check if user has access (either through membership or legacy ownership)
  if (!member && !isLegacyOwner) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this campaign',
    });
  }

  const role = member?.role || (isLegacyOwner ? CampaignRole.OWNER : null);

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      userId: campaign.userId,
    },
    member: member ? {
      id: member.id,
      role: member.role,
      canViewNPCSecrets: member.canViewNPCSecrets,
      canEditNPCs: member.canEditNPCs,
      canManageSessions: member.canManageSessions,
      canInviteMembers: member.canInviteMembers,
    } : null,
    isOwner: role === CampaignRole.OWNER,
    isCoOwner: role === CampaignRole.CO_DM,
    isPlayer: role === CampaignRole.PLAYER,
    isSpectator: role === CampaignRole.SPECTATOR,
  };
}

/**
 * Verify that a user has a specific role or higher in a campaign
 * Role hierarchy: OWNER > CO_DM > PLAYER > SPECTATOR
 *
 * @throws TRPCError with code FORBIDDEN if user doesn't have required role
 */
export async function verifyCampaignRole(
  campaignId: string,
  userId: string,
  requiredRole: CampaignRole
): Promise<CampaignMembershipResult> {
  const membership = await verifyCampaignMembership(campaignId, userId);

  const roleHierarchy: Record<CampaignRole, number> = {
    [CampaignRole.OWNER]: 4,
    [CampaignRole.CO_DM]: 3,
    [CampaignRole.PLAYER]: 2,
    [CampaignRole.SPECTATOR]: 1,
  };

  const userRole = membership.member?.role || (membership.isOwner ? CampaignRole.OWNER : null);
  if (!userRole) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have the required permissions',
    });
  }

  const userLevel = roleHierarchy[userRole];
  const requiredLevel = roleHierarchy[requiredRole];

  if (userLevel < requiredLevel) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `This action requires ${requiredRole} access or higher`,
    });
  }

  return membership;
}

/**
 * Verify that a user can edit NPCs in a campaign
 * Allowed: OWNER, CO_DM, or PLAYER with canEditNPCs permission
 */
export async function verifyCanEditNPCs(
  campaignId: string,
  userId: string
): Promise<CampaignMembershipResult> {
  const membership = await verifyCampaignMembership(campaignId, userId);

  if (membership.isOwner || membership.isCoOwner) {
    return membership;
  }

  if (membership.member?.canEditNPCs) {
    return membership;
  }

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'You do not have permission to edit NPCs in this campaign',
  });
}

/**
 * Verify that a user can view NPC secrets in a campaign
 * Allowed: OWNER, CO_DM, or members with canViewNPCSecrets permission
 */
export async function verifyCanViewNPCSecrets(
  campaignId: string,
  userId: string
): Promise<CampaignMembershipResult> {
  const membership = await verifyCampaignMembership(campaignId, userId);

  if (membership.isOwner || membership.isCoOwner) {
    return membership;
  }

  if (membership.member?.canViewNPCSecrets) {
    return membership;
  }

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'You do not have permission to view NPC secrets in this campaign',
  });
}

/**
 * Verify that a user can manage sessions in a campaign
 * Allowed: OWNER, CO_DM, or members with canManageSessions permission
 */
export async function verifyCanManageSessions(
  campaignId: string,
  userId: string
): Promise<CampaignMembershipResult> {
  const membership = await verifyCampaignMembership(campaignId, userId);

  if (membership.isOwner || membership.isCoOwner) {
    return membership;
  }

  if (membership.member?.canManageSessions) {
    return membership;
  }

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'You do not have permission to manage sessions in this campaign',
  });
}

/**
 * Verify that a user can invite members to a campaign
 * Allowed: OWNER, CO_DM, or members with canInviteMembers permission
 */
export async function verifyCanInviteMembers(
  campaignId: string,
  userId: string
): Promise<CampaignMembershipResult> {
  const membership = await verifyCampaignMembership(campaignId, userId);

  if (membership.isOwner || membership.isCoOwner) {
    return membership;
  }

  if (membership.member?.canInviteMembers) {
    return membership;
  }

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'You do not have permission to invite members to this campaign',
  });
}

/**
 * Check if a user has DM-level access (OWNER or CO_DM)
 * This is a common check for DM-only features
 */
export function isDMLevel(membership: CampaignMembershipResult): boolean {
  return membership.isOwner || membership.isCoOwner;
}
