import {
  router,
  protectedProcedure,
  campaignMemberProcedure,
  campaignDMProcedure,
  campaignOwnerProcedure,
} from '../trpc';
import { z } from 'zod';
import { CampaignRole } from '@prisma/client';
import { memberService } from '../services/member.service';

/**
 * Campaign Members Router
 * Handles member management, invites, and role assignments
 */
export const membersRouter = router({
  // ===========================================================================
  // MEMBER QUERIES
  // ===========================================================================

  /**
   * Get all members of a campaign
   */
  getAll: campaignMemberProcedure.query(({ input }) =>
    memberService.getAll(input.campaignId)
  ),

  /**
   * Get current user's membership in a campaign
   */
  getMyMembership: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ input, ctx }) =>
      memberService.getMyMembership(input.campaignId, ctx.session.user.id)
    ),

  // ===========================================================================
  // INVITE MANAGEMENT
  // ===========================================================================

  /**
   * Get all pending invites for a campaign (DM only)
   */
  getInvites: campaignDMProcedure.query(({ input }) =>
    memberService.getInvites(input.campaignId)
  ),

  /**
   * Create an invite code for the campaign
   */
  createInvite: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        role: z.nativeEnum(CampaignRole).default(CampaignRole.PLAYER),
        email: z.string().email().optional(),
        message: z.string().optional(),
        expiresInDays: z.number().min(1).max(30).optional(),
      })
    )
    .mutation(({ input, ctx }) => {
      const { campaignId, ...rest } = input;
      return memberService.createInvite(campaignId, ctx.session.user.id, rest);
    }),

  /**
   * Regenerate campaign's permanent invite code (owner only)
   */
  regenerateInviteCode: campaignOwnerProcedure.mutation(({ input }) =>
    memberService.regenerateInviteCode(input.campaignId)
  ),

  /**
   * Revoke an invite
   */
  revokeInvite: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        inviteId: z.string(),
      })
    )
    .mutation(({ input }) =>
      memberService.revokeInvite(input.campaignId, input.inviteId)
    ),

  /**
   * Accept an invite and join a campaign
   */
  acceptInvite: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(({ input, ctx }) =>
      memberService.acceptInvite(input.code, ctx.session.user.id, ctx.session.user.email)
    ),

  // ===========================================================================
  // MEMBER MANAGEMENT
  // ===========================================================================

  /**
   * Update a member's role
   */
  updateRole: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        memberId: z.string(),
        role: z.nativeEnum(CampaignRole),
      })
    )
    .mutation(({ input, ctx }) =>
      memberService.updateRole(
        input.campaignId,
        input.memberId,
        input.role,
        ctx.membership.isOwner
      )
    ),

  /**
   * Update a member's granular permissions
   */
  updatePermissions: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        memberId: z.string(),
        canViewNPCSecrets: z.boolean().optional(),
        canEditNPCs: z.boolean().optional(),
        canManageSessions: z.boolean().optional(),
        canInviteMembers: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      const { campaignId, memberId, ...permissions } = input;
      return memberService.updatePermissions(campaignId, memberId, permissions);
    }),

  /**
   * Remove a member from the campaign
   */
  remove: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        memberId: z.string(),
      })
    )
    .mutation(({ input, ctx }) =>
      memberService.remove(input.campaignId, input.memberId, ctx.membership.isOwner)
    ),

  /**
   * Leave a campaign (self-removal)
   */
  leave: campaignMemberProcedure.mutation(({ input, ctx }) =>
    memberService.leave(input.campaignId, ctx.session.user.id, ctx.membership.isOwner)
  ),

  /**
   * Transfer campaign ownership (owner only)
   */
  transferOwnership: campaignOwnerProcedure
    .input(
      z.object({
        campaignId: z.string(),
        newOwnerId: z.string(),
      })
    )
    .mutation(({ input, ctx }) =>
      memberService.transferOwnership(
        input.campaignId,
        ctx.session.user.id,
        input.newOwnerId
      )
    ),
});
