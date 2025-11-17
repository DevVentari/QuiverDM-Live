import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateUniqueSlug } from '@/lib/slugify';
import { verifyCampaignOwnership } from '../lib/ownership';

export const campaignsRouter = router({
  /**
   * Get all campaigns for authenticated user
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        _count: {
          select: {
            gameSessions: true,
            npcs: true,
            players: true,
          },
        },
      },
    });

    return campaigns;
  }),

  /**
   * Get single campaign by ID (with ownership verification)
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      await verifyCampaignOwnership(input.id, userId);

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
          },
          players: true,
          _count: {
            select: {
              gameSessions: true,
              npcs: true,
              players: true,
              homebrewContent: true,
            },
          },
        },
      });

      return campaign;
    }),

  /**
   * Get single campaign by slug (with ownership verification)
   */
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const campaign = await prisma.campaign.findFirst({
        where: {
          slug: input.slug,
          userId, // Only return if owned by user
        },
        include: {
          gameSessions: {
            orderBy: {
              sessionNumber: 'desc',
            },
            take: 5,
          },
          npcs: {
            take: 10,
          },
          players: true,
          _count: {
            select: {
              gameSessions: true,
              npcs: true,
              players: true,
              homebrewContent: true,
            },
          },
        },
      });

      return campaign;
    }),

  /**
   * Create new campaign for authenticated user
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

      const campaign = await prisma.campaign.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          bannerUrl: input.bannerUrl,
          userId,
          status: 'active',
        },
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
