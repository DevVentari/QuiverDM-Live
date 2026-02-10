/**
 * Authorization Service
 *
 * Unified authorization layer that consolidates all access control patterns:
 * - Legacy ownership checks (for backwards compatibility)
 * - Role-based membership access (OWNER, CO_DM, PLAYER, SPECTATOR)
 * - Granular permission checks (canEditNPCs, canManageSessions, etc.)
 *
 * Usage:
 *   const authz = new AuthorizationService();
 *   const access = await authz.campaign(campaignId, userId).verify();
 *   const access = await authz.campaign(campaignId, userId).requireRole('CO_DM');
 *   const access = await authz.campaign(campaignId, userId).requirePermission('canEditNPCs');
 */

import { TRPCError } from '@trpc/server';
import { CampaignRole } from '@prisma/client';
import { prisma } from '../db';

// =============================================================================
// Types
// =============================================================================

export type Permission =
  | 'canViewNPCSecrets'
  | 'canEditNPCs'
  | 'canManageSessions'
  | 'canInviteMembers';

export interface CampaignAccess {
  campaign: {
    id: string;
    name: string;
    slug: string;
    userId: string; // Legacy owner
  };
  member: {
    id: string;
    role: CampaignRole;
    permissions: Record<Permission, boolean>;
  } | null;
  role: CampaignRole;
  isOwner: boolean;
  isDM: boolean; // OWNER or CO_DM
  isPlayer: boolean;
  isSpectator: boolean;
}

export interface ResourceAccess<T> extends CampaignAccess {
  resource: T;
}

const ROLE_HIERARCHY: Record<CampaignRole, number> = {
  [CampaignRole.OWNER]: 4,
  [CampaignRole.CO_DM]: 3,
  [CampaignRole.PLAYER]: 2,
  [CampaignRole.SPECTATOR]: 1,
};

// =============================================================================
// Campaign Authorization Builder
// =============================================================================

class CampaignAuthorizationBuilder {
  constructor(
    private campaignId: string,
    private userId: string
  ) {}

  /**
   * Verify basic campaign access (membership or legacy ownership)
   */
  async verify(): Promise<CampaignAccess> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: this.campaignId },
      include: {
        members: {
          where: { userId: this.userId },
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
    const isLegacyOwner = campaign.userId === this.userId;

    if (!member && !isLegacyOwner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have access to this campaign',
      });
    }

    const role = member?.role || CampaignRole.OWNER;

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        userId: campaign.userId,
      },
      member: member
        ? {
            id: member.id,
            role: member.role,
            permissions: {
              canViewNPCSecrets: member.canViewNPCSecrets,
              canEditNPCs: member.canEditNPCs,
              canManageSessions: member.canManageSessions,
              canInviteMembers: member.canInviteMembers,
            },
          }
        : null,
      role,
      isOwner: role === CampaignRole.OWNER,
      isDM: role === CampaignRole.OWNER || role === CampaignRole.CO_DM,
      isPlayer: role === CampaignRole.PLAYER,
      isSpectator: role === CampaignRole.SPECTATOR,
    };
  }

  /**
   * Require a minimum role level
   * Role hierarchy: OWNER > CO_DM > PLAYER > SPECTATOR
   */
  async requireRole(minRole: CampaignRole): Promise<CampaignAccess> {
    const access = await this.verify();

    if (ROLE_HIERARCHY[access.role] < ROLE_HIERARCHY[minRole]) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `This action requires ${minRole} access or higher`,
      });
    }

    return access;
  }

  /**
   * Require DM-level access (OWNER or CO_DM)
   */
  async requireDM(): Promise<CampaignAccess> {
    return this.requireRole(CampaignRole.CO_DM);
  }

  /**
   * Require owner-level access
   */
  async requireOwner(): Promise<CampaignAccess> {
    return this.requireRole(CampaignRole.OWNER);
  }

  /**
   * Require a specific permission
   * DMs automatically have all permissions
   */
  async requirePermission(permission: Permission): Promise<CampaignAccess> {
    const access = await this.verify();

    // DMs have all permissions
    if (access.isDM) {
      return access;
    }

    // Check specific permission for non-DMs
    if (access.member?.permissions[permission]) {
      return access;
    }

    const permissionLabels: Record<Permission, string> = {
      canViewNPCSecrets: 'view NPC secrets',
      canEditNPCs: 'edit NPCs',
      canManageSessions: 'manage sessions',
      canInviteMembers: 'invite members',
    };

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `You do not have permission to ${permissionLabels[permission]} in this campaign`,
    });
  }
}

// =============================================================================
// Resource Authorization Builders
// =============================================================================

class SessionAuthorizationBuilder {
  constructor(
    private sessionId: string,
    private userId: string
  ) {}

  /**
   * Verify access to a session (through campaign membership)
   */
  async verify(): Promise<ResourceAccess<{ id: string; campaignId: string }>> {
    const session = await prisma.gameSession.findUnique({
      where: { id: this.sessionId },
      include: {
        campaign: {
          include: {
            members: {
              where: { userId: this.userId },
            },
          },
        },
      },
    });

    if (!session) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Session not found',
      });
    }

    const { campaign } = session;
    const member = campaign.members[0] || null;
    const isLegacyOwner = campaign.userId === this.userId;

    if (!member && !isLegacyOwner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have access to this session',
      });
    }

    const role = member?.role || CampaignRole.OWNER;

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        userId: campaign.userId,
      },
      member: member
        ? {
            id: member.id,
            role: member.role,
            permissions: {
              canViewNPCSecrets: member.canViewNPCSecrets,
              canEditNPCs: member.canEditNPCs,
              canManageSessions: member.canManageSessions,
              canInviteMembers: member.canInviteMembers,
            },
          }
        : null,
      role,
      isOwner: role === CampaignRole.OWNER,
      isDM: role === CampaignRole.OWNER || role === CampaignRole.CO_DM,
      isPlayer: role === CampaignRole.PLAYER,
      isSpectator: role === CampaignRole.SPECTATOR,
      resource: {
        id: session.id,
        campaignId: session.campaignId,
      },
    };
  }

  /**
   * Require permission to manage sessions
   */
  async requireManage(): Promise<ResourceAccess<{ id: string; campaignId: string }>> {
    const access = await this.verify();

    if (access.isDM || access.member?.permissions.canManageSessions) {
      return access;
    }

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to manage this session',
    });
  }
}

class NPCAuthorizationBuilder {
  constructor(
    private npcId: string,
    private userId: string
  ) {}

  /**
   * Verify access to an NPC (through campaign membership)
   */
  async verify(): Promise<ResourceAccess<{ id: string; campaignId: string }>> {
    const npc = await prisma.nPC.findUnique({
      where: { id: this.npcId },
      include: {
        campaign: {
          include: {
            members: {
              where: { userId: this.userId },
            },
          },
        },
      },
    });

    if (!npc) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'NPC not found',
      });
    }

    const { campaign } = npc;
    const member = campaign.members[0] || null;
    const isLegacyOwner = campaign.userId === this.userId;

    if (!member && !isLegacyOwner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have access to this NPC',
      });
    }

    const role = member?.role || CampaignRole.OWNER;

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        slug: campaign.slug,
        userId: campaign.userId,
      },
      member: member
        ? {
            id: member.id,
            role: member.role,
            permissions: {
              canViewNPCSecrets: member.canViewNPCSecrets,
              canEditNPCs: member.canEditNPCs,
              canManageSessions: member.canManageSessions,
              canInviteMembers: member.canInviteMembers,
            },
          }
        : null,
      role,
      isOwner: role === CampaignRole.OWNER,
      isDM: role === CampaignRole.OWNER || role === CampaignRole.CO_DM,
      isPlayer: role === CampaignRole.PLAYER,
      isSpectator: role === CampaignRole.SPECTATOR,
      resource: {
        id: npc.id,
        campaignId: npc.campaignId,
      },
    };
  }

  /**
   * Require permission to edit NPCs
   */
  async requireEdit(): Promise<ResourceAccess<{ id: string; campaignId: string }>> {
    const access = await this.verify();

    if (access.isDM || access.member?.permissions.canEditNPCs) {
      return access;
    }

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to edit this NPC',
    });
  }

  /**
   * Require permission to view NPC secrets
   */
  async requireViewSecrets(): Promise<ResourceAccess<{ id: string; campaignId: string }>> {
    const access = await this.verify();

    if (access.isDM || access.member?.permissions.canViewNPCSecrets) {
      return access;
    }

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to view NPC secrets',
    });
  }
}

// =============================================================================
// User-Owned Resource Authorization
// =============================================================================

class UserResourceAuthorizationBuilder<T> {
  constructor(
    private resourceName: string,
    private findFn: () => Promise<T | null>
  ) {}

  async verify(): Promise<T> {
    const resource = await this.findFn();

    if (!resource) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You do not have permission to access this ${this.resourceName}`,
      });
    }

    return resource;
  }
}

// =============================================================================
// Main Authorization Service
// =============================================================================

export class AuthorizationService {
  /**
   * Authorize access to a campaign
   */
  campaign(campaignId: string, userId: string): CampaignAuthorizationBuilder {
    return new CampaignAuthorizationBuilder(campaignId, userId);
  }

  /**
   * Authorize access to a session
   */
  session(sessionId: string, userId: string): SessionAuthorizationBuilder {
    return new SessionAuthorizationBuilder(sessionId, userId);
  }

  /**
   * Authorize access to an NPC
   */
  npc(npcId: string, userId: string): NPCAuthorizationBuilder {
    return new NPCAuthorizationBuilder(npcId, userId);
  }

  /**
   * Authorize access to user-owned homebrew content
   */
  homebrew(homebrewId: string, userId: string) {
    return new UserResourceAuthorizationBuilder('homebrew content', () =>
      prisma.homebrewContent.findFirst({
        where: { id: homebrewId, userId },
      })
    );
  }

  /**
   * Authorize access to user-owned PDF
   */
  pdf(pdfId: string, userId: string) {
    return new UserResourceAuthorizationBuilder('PDF', () =>
      prisma.homebrewPDF.findFirst({
        where: { id: pdfId, userId },
      })
    );
  }

  /**
   * Authorize access to a recording (through session's campaign)
   */
  async recording(recordingId: string, userId: string) {
    const recording = await prisma.sessionRecording.findFirst({
      where: {
        id: recordingId,
        session: {
          campaign: {
            OR: [{ userId }, { members: { some: { userId } } }],
          },
        },
      },
      include: {
        session: {
          include: {
            campaign: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
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
   * Authorize access to a transcript (through session's campaign)
   */
  async transcript(transcriptId: string, userId: string) {
    const transcript = await prisma.transcript.findFirst({
      where: {
        id: transcriptId,
        session: {
          campaign: {
            OR: [{ userId }, { members: { some: { userId } } }],
          },
        },
      },
      include: {
        session: {
          include: {
            campaign: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
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

  /**
   * Authorize access to a player (through campaign)
   */
  async player(playerId: string, userId: string) {
    const player = await prisma.player.findFirst({
      where: {
        id: playerId,
        campaign: {
          OR: [{ userId }, { members: { some: { userId } } }],
        },
      },
      include: {
        campaign: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!player) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this player',
      });
    }

    return player;
  }
}

// Singleton instance for convenience
export const authz = new AuthorizationService();

// =============================================================================
// Legacy Compatibility Exports
// =============================================================================

// Re-export legacy functions for backwards compatibility during migration
export {
  verifyCampaignOwnership,
  verifySessionOwnership,
  verifyNPCOwnership,
  verifyPlayerOwnership,
  verifyRecordingOwnership,
  verifyHomebrewOwnership,
  verifyPDFOwnership,
  verifyTranscriptOwnership,
  verifyCampaignMembership,
  verifyCampaignRole,
  verifyCanEditNPCs,
  verifyCanViewNPCSecrets,
  verifyCanManageSessions,
  verifyCanInviteMembers,
  getCampaignMembership,
  isDMLevel,
} from '../lib/ownership';

export type { CampaignMembershipResult } from '../lib/ownership';
