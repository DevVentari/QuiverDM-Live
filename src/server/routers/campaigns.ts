import { router, protectedProcedure, campaignMemberProcedure, campaignDMProcedure, campaignOwnerProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { CampaignRole } from '@prisma/client';
import { generateUniqueSlug } from '@/lib/slugify';
import { verifyCampaignOwnership, verifyCampaignMembership } from '../lib/ownership';

export const campaignsRouter = router({
  /**
   * Get all campaigns where user is a member (any role)
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const campaigns = await prisma.campaign.findMany({
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

    // Flatten membership info for easier access
    return campaigns.map(campaign => ({
      ...campaign,
      myRole: campaign.members[0]?.role || (campaign.userId === userId ? CampaignRole.OWNER : null),
      myPermissions: campaign.members[0] || null,
    }));
  }),

  /**
   * Get single campaign by ID (with membership verification)
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify membership (replaces ownership check)
      const membership = await verifyCampaignMembership(input.id, userId);

      const campaign = await prisma.campaign.findUnique({
        where: { id: input.id },
        include: {
          gameSessions: {
            orderBy: {
              sessionNumber: 'desc',
            },
            take: 5,
          },
          npcs: {
            take: 10,
            // Hide secrets from non-DMs
            select: {
              id: true,
              name: true,
              description: true,
              faction: true,
              role: true,
              imageUrl: true,
              tags: true,
              // Only include secrets if DM
              secrets: membership.isOwner || membership.isCoOwner || membership.member?.canViewNPCSecrets,
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

      return {
        ...campaign,
        myRole: membership.member?.role || (membership.isOwner ? CampaignRole.OWNER : null),
        myPermissions: membership.member,
      };
    }),

  /**
   * Get single campaign by slug (with membership verification)
   */
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // First find the campaign by slug
      const campaignBasic = await prisma.campaign.findFirst({
        where: { slug: input.slug },
        select: { id: true },
      });

      if (!campaignBasic) {
        return null;
      }

      // Verify membership
      const membership = await verifyCampaignMembership(campaignBasic.id, userId);

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignBasic.id },
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
              secrets: membership.isOwner || membership.isCoOwner || membership.member?.canViewNPCSecrets,
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

      return {
        ...campaign,
        myRole: membership.member?.role || (membership.isOwner ? CampaignRole.OWNER : null),
        myPermissions: membership.member,
      };
    }),

  /**
   * Create new campaign for authenticated user
   * Also creates the OWNER membership for the user
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Campaign name is required'),
        description: z.string().optional(),
        bannerUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Generate unique slug
      const slug = await generateUniqueSlug(input.name, async (slug) => {
        const existing = await prisma.campaign.findUnique({ where: { slug } });
        return !!existing;
      });

      // Create campaign and owner membership in a transaction
      const campaign = await prisma.$transaction(async (tx) => {
        const newCampaign = await tx.campaign.create({
          data: {
            name: input.name,
            slug,
            description: input.description,
            bannerUrl: input.bannerUrl,
            userId,
            status: 'active',
          },
        });

        // Create OWNER membership for the creator
        await tx.campaignMember.create({
          data: {
            campaignId: newCampaign.id,
            userId,
            role: CampaignRole.OWNER,
            canViewNPCSecrets: true,
            canEditNPCs: true,
            canManageSessions: true,
            canInviteMembers: true,
          },
        });

        return newCampaign;
      });

      return campaign;
    }),

  /**
   * Update campaign (with ownership verification)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, 'Campaign name is required').optional(),
        description: z.string().optional(),
        bannerUrl: z.string().optional(),
        status: z.enum(['planning', 'active', 'completed', 'archived']).optional(),
        glossary: z.record(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const { id, name, ...data } = input;

      // Verify ownership before updating
      await verifyCampaignOwnership(id, userId);

      // If name is being updated, regenerate slug
      let updateData: any = { ...data };
      if (name) {
        updateData.name = name;
        updateData.slug = await generateUniqueSlug(name, async (slug) => {
          const existing = await prisma.campaign.findFirst({
            where: { slug, NOT: { id } },
          });
          return !!existing;
        });
      }

      const campaign = await prisma.campaign.update({
        where: { id },
        data: updateData,
      });

      return campaign;
    }),

  /**
   * Delete campaign (with ownership verification)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify ownership before deleting
      await verifyCampaignOwnership(input.id, userId);

      await prisma.campaign.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Get campaign stats (with ownership verification)
   */
  getStats: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      await verifyCampaignOwnership(input.campaignId, userId);

      const [sessionCount, npcCount, playerCount, homebrewCount, lastSession] =
        await Promise.all([
          prisma.gameSession.count({
            where: { campaignId: input.campaignId },
          }),
          prisma.nPC.count({
            where: { campaignId: input.campaignId },
          }),
          prisma.player.count({
            where: { campaignId: input.campaignId },
          }),
          prisma.homebrewContent.count({
            where: { campaigns: { some: { campaignId: input.campaignId } } },
          }),
          prisma.gameSession.findFirst({
            where: { campaignId: input.campaignId },
            orderBy: { sessionNumber: 'desc' },
          }),
        ]);

      return {
        sessionCount,
        npcCount,
        playerCount,
        homebrewCount,
        lastSessionNumber: lastSession?.sessionNumber ?? 0,
        lastSessionDate: lastSession?.createdAt,
      };
    }),
});
