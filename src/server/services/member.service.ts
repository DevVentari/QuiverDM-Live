/**
 * Member Service
 *
 * Business logic for campaign member management.
 * Uses authorization service and member repository.
 */

import { TRPCError } from '@trpc/server';
import { CampaignRole } from '@prisma/client';
import { memberRepository } from '../repositories/member.repository';
import { authz } from './authorization.service';

export class MemberService {
  // ===========================================================================
  // MEMBER QUERIES
  // ===========================================================================

  /**
   * Get all members of a campaign
   */
  async getAll(campaignId: string) {
    return memberRepository.findByCampaignId(campaignId);
  }

  /**
   * Get current user's membership in a campaign
   */
  async getMyMembership(campaignId: string, userId: string) {
    return memberRepository.findMembership(campaignId, userId);
  }

  // ===========================================================================
  // INVITE MANAGEMENT
  // ===========================================================================

  /**
   * Get all pending invites for a campaign
   */
  async getInvites(campaignId: string) {
    return memberRepository.findPendingInvites(campaignId);
  }

  /**
   * Create an invite code for the campaign
   */
  async createInvite(
    campaignId: string,
    userId: string,
    input: {
      role?: CampaignRole;
      email?: string;
      message?: string;
      expiresInDays?: number;
    }
  ) {
    const role = input.role ?? CampaignRole.PLAYER;

    // Verify user can invite members
    const access = await authz
      .campaign(campaignId, userId)
      .requirePermission('canInviteMembers');

    // Only OWNER can invite CO_DMs
    if (role === CampaignRole.CO_DM && !access.isOwner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the campaign owner can invite co-DMs',
      });
    }

    // Cannot invite as OWNER
    if (role === CampaignRole.OWNER) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot invite someone as campaign owner. Use transfer ownership instead.',
      });
    }

    return memberRepository.createInvite({
      campaignId,
      role,
      createdBy: userId,
      email: input.email,
      message: input.message,
      expiresInDays: input.expiresInDays,
    });
  }

  /**
   * Regenerate campaign's permanent invite code
   */
  async regenerateInviteCode(campaignId: string) {
    const result = await memberRepository.regenerateCampaignInviteCode(campaignId);
    return { inviteCode: result.inviteCode };
  }

  /**
   * Revoke an invite
   */
  async revokeInvite(campaignId: string, inviteId: string) {
    await memberRepository.deleteInvite(inviteId, campaignId);
    return { success: true };
  }

  /**
   * Accept an invite and join a campaign
   */
  async acceptInvite(code: string, userId: string, userEmail: string | null | undefined) {
    // First try to find by invite code
    const invite = await memberRepository.findInviteByCode(code);

    // If not found, try campaign's permanent invite code
    if (!invite) {
      const campaign = await memberRepository.findCampaignByInviteCode(code);

      if (campaign) {
        // Check if already a member
        const existingMember = await memberRepository.findMembership(campaign.id, userId);

        if (existingMember) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You are already a member of this campaign',
          });
        }

        // Join with default PLAYER role
        await memberRepository.createMembership({
          campaignId: campaign.id,
          userId,
          role: CampaignRole.PLAYER,
        });

        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          campaignSlug: campaign.slug,
          role: CampaignRole.PLAYER,
        };
      }

      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invalid or expired invite code',
      });
    }

    // Check if email-specific invite matches
    if (invite.email && invite.email !== userEmail) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This invite is for a different email address',
      });
    }

    // Check if already a member
    const existingMember = await memberRepository.findMembership(invite.campaignId, userId);

    if (existingMember) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'You are already a member of this campaign',
      });
    }

    // Create membership and mark invite as used
    await memberRepository.acceptInviteTransaction(
      invite.id,
      invite.campaignId,
      userId,
      invite.role,
      invite.createdBy
    );

    const campaign = await memberRepository.getCampaign(invite.campaignId);

    return {
      campaignId: invite.campaignId,
      campaignName: campaign?.name,
      campaignSlug: campaign?.slug,
      role: invite.role,
    };
  }

  // ===========================================================================
  // MEMBER MANAGEMENT
  // ===========================================================================

  /**
   * Update a member's role
   */
  async updateRole(
    campaignId: string,
    memberId: string,
    role: CampaignRole,
    isOwner: boolean
  ) {
    const targetMember = await memberRepository.findById(memberId);

    if (!targetMember || targetMember.campaignId !== campaignId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Member not found',
      });
    }

    // Cannot change owner role
    if (targetMember.role === CampaignRole.OWNER) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: "Cannot change the owner's role. Use transfer ownership instead.",
      });
    }

    // Cannot promote to OWNER
    if (role === CampaignRole.OWNER) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Cannot promote to owner. Use transfer ownership instead.',
      });
    }

    // Only owner can promote to or demote from CO_DM
    if (role === CampaignRole.CO_DM || targetMember.role === CampaignRole.CO_DM) {
      if (!isOwner) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the campaign owner can manage co-DM roles',
        });
      }
    }

    return memberRepository.updateMember(memberId, {
      role,
      // Reset granular permissions when role changes
      canViewNPCSecrets: role === CampaignRole.CO_DM,
      canEditNPCs: role === CampaignRole.CO_DM,
      canManageSessions: role === CampaignRole.CO_DM,
      canInviteMembers: role === CampaignRole.CO_DM,
    });
  }

  /**
   * Update a member's granular permissions
   */
  async updatePermissions(
    campaignId: string,
    memberId: string,
    permissions: {
      canViewNPCSecrets?: boolean;
      canEditNPCs?: boolean;
      canManageSessions?: boolean;
      canInviteMembers?: boolean;
    }
  ) {
    const targetMember = await memberRepository.findById(memberId);

    if (!targetMember || targetMember.campaignId !== campaignId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Member not found',
      });
    }

    // Cannot modify OWNER or CO_DM permissions this way
    if (
      targetMember.role === CampaignRole.OWNER ||
      targetMember.role === CampaignRole.CO_DM
    ) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Cannot modify permissions for owners or co-DMs',
      });
    }

    return memberRepository.updateMember(memberId, permissions);
  }

  /**
   * Remove a member from the campaign
   */
  async remove(campaignId: string, memberId: string, isOwner: boolean) {
    const targetMember = await memberRepository.findById(memberId);

    if (!targetMember || targetMember.campaignId !== campaignId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Member not found',
      });
    }

    // Cannot remove the owner
    if (targetMember.role === CampaignRole.OWNER) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Cannot remove the campaign owner',
      });
    }

    // Only owner can remove CO_DMs
    if (targetMember.role === CampaignRole.CO_DM && !isOwner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the campaign owner can remove co-DMs',
      });
    }

    await memberRepository.removeMember(memberId);
    return { success: true };
  }

  /**
   * Leave a campaign (self-removal)
   */
  async leave(campaignId: string, userId: string, isOwner: boolean) {
    // Cannot leave if you're the owner
    if (isOwner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message:
          'Campaign owner cannot leave. Transfer ownership first or delete the campaign.',
      });
    }

    await memberRepository.removeMemberByUser(campaignId, userId);
    return { success: true };
  }

  /**
   * Transfer campaign ownership to another member
   */
  async transferOwnership(campaignId: string, currentOwnerId: string, newOwnerId: string) {
    const newOwnerMember = await memberRepository.findMembership(campaignId, newOwnerId);

    if (!newOwnerMember) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'New owner must be a current member of the campaign',
      });
    }

    await memberRepository.transferOwnership(
      campaignId,
      currentOwnerId,
      newOwnerMember.id,
      newOwnerId
    );

    return { success: true };
  }
}

export const memberService = new MemberService();
