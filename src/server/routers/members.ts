import { router, protectedProcedure, campaignMemberProcedure, campaignDMProcedure, campaignOwnerProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { CampaignRole } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { nanoid } from 'nanoid';
import { verifyCampaignMembership, verifyCanInviteMembers } from '../lib/ownership';

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
   * Accessible to all campaign members
   */
  getAll: campaignMemberProcedure
    .query(async ({ input }) => {
      const members = await prisma.campaignMember.findMany({
        where: { campaignId: input.campaignId },
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

      return members;
    }),

  /**
   * Get current user's membership in a campaign
   */
  getMyMembership: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await prisma.campaignMember.findUnique({
        where: {
          campaignId_userId: {
            campaignId: input.campaignId,
            userId: ctx.session.user.id,
          },
        },
      });

      return membership;
    }),

  // ===========================================================================
  // INVITE MANAGEMENT
  // ===========================================================================

  /**
   * Get all pending invites for a campaign
   * Only accessible to DMs
   */
  getInvites: campaignDMProcedure
    .query(async ({ input }) => {
      const invites = await prisma.campaignInvite.findMany({
        where: {
          campaignId: input.campaignId,
          usedAt: null, // Only pending invites
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      return invites;
    }),

  /**
   * Create an invite code for the campaign
   * Accessible to DMs and members with invite permission
   */
  createInvite: protectedProcedure
    .input(z.object({
      campaignId: z.string(),
      role: z.nativeEnum(CampaignRole).default(CampaignRole.PLAYER),
      email: z.string().email().optional(),
      message: z.string().optional(),
      expiresInDays: z.number().min(1).max(30).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify user can invite members
      await verifyCanInviteMembers(input.campaignId, ctx.session.user.id);

      // Only OWNER can invite CO_DMs
      if (input.role === CampaignRole.CO_DM) {
        const membership = await verifyCampaignMembership(input.campaignId, ctx.session.user.id);
        if (!membership.isOwner) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only the campaign owner can invite co-DMs',
          });
        }
      }

      // Cannot invite as OWNER
      if (input.role === CampaignRole.OWNER) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot invite someone as campaign owner. Use transfer ownership instead.',
        });
      }

      const invite = await prisma.campaignInvite.create({
        data: {
          campaignId: input.campaignId,
          code: nanoid(12), // Short, URL-friendly code
          email: input.email,
          role: input.role,
          createdBy: ctx.session.user.id,
          message: input.message,
          expiresAt: input.expiresInDays
            ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
            : null,
        },
      });

      return invite;
    }),

  /**
   * Generate or regenerate the campaign's permanent invite code
   * Only accessible to owners
   */
  regenerateInviteCode: campaignOwnerProcedure
    .mutation(async ({ input }) => {
      const newCode = nanoid(8); // Short code for easy sharing

      const campaign = await prisma.campaign.update({
        where: { id: input.campaignId },
        data: { inviteCode: newCode },
      });

      return { inviteCode: campaign.inviteCode };
    }),

  /**
   * Revoke an invite
   */
  revokeInvite: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      inviteId: z.string(),
    }))
    .mutation(async ({ input }) => {
      await prisma.campaignInvite.delete({
        where: {
          id: input.inviteId,
          campaignId: input.campaignId,
        },
      });

      return { success: true };
    }),

  /**
   * Accept an invite and join a campaign
   */
  acceptInvite: protectedProcedure
    .input(z.object({
      code: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // First try to find by invite code
      let invite = await prisma.campaignInvite.findFirst({
        where: {
          code: input.code,
          usedAt: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        include: {
          campaign: {
            select: { id: true, name: true },
          },
        },
      });

      // If not found, try campaign's permanent invite code
      if (!invite) {
        const campaign = await prisma.campaign.findFirst({
          where: { inviteCode: input.code },
        });

        if (campaign) {
          // Check if already a member
          const existingMember = await prisma.campaignMember.findUnique({
            where: {
              campaignId_userId: {
                campaignId: campaign.id,
                userId,
              },
            },
          });

          if (existingMember) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'You are already a member of this campaign',
            });
          }

          // Join with default PLAYER role
          const member = await prisma.campaignMember.create({
            data: {
              campaignId: campaign.id,
              userId,
              role: CampaignRole.PLAYER,
            },
            include: {
              campaign: {
                select: { id: true, name: true, slug: true },
              },
            },
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
      if (invite.email && invite.email !== ctx.session.user.email) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This invite is for a different email address',
        });
      }

      // Check if already a member
      const existingMember = await prisma.campaignMember.findUnique({
        where: {
          campaignId_userId: {
            campaignId: invite.campaignId,
            userId,
          },
        },
      });

      if (existingMember) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You are already a member of this campaign',
        });
      }

      // Create membership and mark invite as used
      const [member] = await prisma.$transaction([
        prisma.campaignMember.create({
          data: {
            campaignId: invite.campaignId,
            userId,
            role: invite.role,
            invitedBy: invite.createdBy,
          },
        }),
        prisma.campaignInvite.update({
          where: { id: invite.id },
          data: {
            usedAt: new Date(),
            usedBy: userId,
          },
        }),
      ]);

      const campaign = await prisma.campaign.findUnique({
        where: { id: invite.campaignId },
        select: { id: true, name: true, slug: true },
      });

      return {
        campaignId: invite.campaignId,
        campaignName: campaign?.name,
        campaignSlug: campaign?.slug,
        role: invite.role,
      };
    }),

  // ===========================================================================
  // MEMBER MANAGEMENT
  // ===========================================================================

  /**
   * Update a member's role
   * Only owner can promote/demote CO_DMs
   * DMs can manage PLAYER and SPECTATOR roles
   */
  updateRole: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      memberId: z.string(),
      role: z.nativeEnum(CampaignRole),
    }))
    .mutation(async ({ input, ctx }) => {
      const targetMember = await prisma.campaignMember.findUnique({
        where: { id: input.memberId },
      });

      if (!targetMember || targetMember.campaignId !== input.campaignId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found',
        });
      }

      // Cannot change owner role
      if (targetMember.role === CampaignRole.OWNER) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot change the owner\'s role. Use transfer ownership instead.',
        });
      }

      // Cannot promote to OWNER
      if (input.role === CampaignRole.OWNER) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot promote to owner. Use transfer ownership instead.',
        });
      }

      // Only owner can promote to or demote from CO_DM
      if (input.role === CampaignRole.CO_DM || targetMember.role === CampaignRole.CO_DM) {
        if (!ctx.membership.isOwner) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only the campaign owner can manage co-DM roles',
          });
        }
      }

      const updated = await prisma.campaignMember.update({
        where: { id: input.memberId },
        data: {
          role: input.role,
          // Reset granular permissions when role changes
          canViewNPCSecrets: input.role === CampaignRole.CO_DM,
          canEditNPCs: input.role === CampaignRole.CO_DM,
          canManageSessions: input.role === CampaignRole.CO_DM,
          canInviteMembers: input.role === CampaignRole.CO_DM,
        },
      });

      return updated;
    }),

  /**
   * Update a member's granular permissions
   */
  updatePermissions: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      memberId: z.string(),
      canViewNPCSecrets: z.boolean().optional(),
      canEditNPCs: z.boolean().optional(),
      canManageSessions: z.boolean().optional(),
      canInviteMembers: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { campaignId, memberId, ...permissions } = input;

      const targetMember = await prisma.campaignMember.findUnique({
        where: { id: memberId },
      });

      if (!targetMember || targetMember.campaignId !== campaignId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Member not found',
        });
      }

      // Cannot modify OWNER or CO_DM permissions this way
      if (targetMember.role === CampaignRole.OWNER || targetMember.role === CampaignRole.CO_DM) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot modify permissions for owners or co-DMs',
        });
      }

      const updated = await prisma.campaignMember.update({
        where: { id: memberId },
        data: permissions,
      });

      return updated;
    }),

  /**
   * Remove a member from the campaign
   */
  remove: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      memberId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const targetMember = await prisma.campaignMember.findUnique({
        where: { id: input.memberId },
      });

      if (!targetMember || targetMember.campaignId !== input.campaignId) {
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
      if (targetMember.role === CampaignRole.CO_DM && !ctx.membership.isOwner) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the campaign owner can remove co-DMs',
        });
      }

      await prisma.campaignMember.delete({
        where: { id: input.memberId },
      });

      return { success: true };
    }),

  /**
   * Leave a campaign (self-removal)
   */
  leave: campaignMemberProcedure
    .mutation(async ({ input, ctx }) => {
      // Cannot leave if you're the owner
      if (ctx.membership.isOwner) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Campaign owner cannot leave. Transfer ownership first or delete the campaign.',
        });
      }

      await prisma.campaignMember.delete({
        where: {
          campaignId_userId: {
            campaignId: input.campaignId,
            userId: ctx.session.user.id,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Transfer campaign ownership to another member
   * Only the current owner can do this
   */
  transferOwnership: campaignOwnerProcedure
    .input(z.object({
      campaignId: z.string(),
      newOwnerId: z.string(), // User ID of the new owner
    }))
    .mutation(async ({ input, ctx }) => {
      const newOwnerMember = await prisma.campaignMember.findUnique({
        where: {
          campaignId_userId: {
            campaignId: input.campaignId,
            userId: input.newOwnerId,
          },
        },
      });

      if (!newOwnerMember) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'New owner must be a current member of the campaign',
        });
      }

      // Transfer ownership in a transaction
      await prisma.$transaction([
        // Update new owner
        prisma.campaignMember.update({
          where: { id: newOwnerMember.id },
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
              campaignId: input.campaignId,
              userId: ctx.session.user.id,
            },
          },
          data: {
            role: CampaignRole.CO_DM,
          },
        }),
        // Update legacy userId on campaign
        prisma.campaign.update({
          where: { id: input.campaignId },
          data: { userId: input.newOwnerId },
        }),
      ]);

      return { success: true };
    }),
});
