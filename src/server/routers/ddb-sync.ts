import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { exchangeCobaltForJwt, fetchUserEntitlements, DdbAuthError } from '@/lib/ddb-sourcebook';
import { ddbSyncRepository } from '../repositories/ddb-sync.repository';
import { addDdbSyncJob } from '@/lib/queue/ddb-sync-queue';

export const ddbSyncRouter = router({
  listEntitlements: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const settings = await prisma.userSettings.findUnique({ where: { userId }, select: { dndBeyondCobaltCookie: true } });
    if (!settings?.dndBeyondCobaltCookie) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No CobaltSession stored. Add it in Settings.' });
    }
    const cobaltSession = decrypt(settings.dndBeyondCobaltCookie);
    try {
      await exchangeCobaltForJwt(cobaltSession);
    } catch (e) {
      if (e instanceof DdbAuthError) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'CobaltSession expired. Paste a fresh one in Settings.' });
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to connect to D&D Beyond.' });
    }
    const entitlements = await fetchUserEntitlements(cobaltSession);
    await ddbSyncRepository.upsertEntitlements(userId, entitlements);
    return ddbSyncRepository.listEntitlements(userId);
  }),

  getEntitlements: protectedProcedure.query(async ({ ctx }) => {
    return ddbSyncRepository.listEntitlements(ctx.session.user.id);
  }),

  importSourcebook: protectedProcedure
    .input(z.object({ entitlementId: z.string(), campaignIds: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const entitlement = await prisma.ddbEntitlement.findUnique({ where: { id: input.entitlementId } });
      if (!entitlement || entitlement.userId !== userId) throw new TRPCError({ code: 'NOT_FOUND' });

      const campaigns = await prisma.campaign.findMany({
        where: { id: { in: input.campaignIds }, members: { some: { userId, role: 'OWNER' } } },
      });
      if (campaigns.length !== input.campaignIds.length) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own all selected campaigns.' });
      }

      const sourcebook = await ddbSyncRepository.createSourcebook(
        userId, entitlement.id, entitlement.slug, entitlement.title, input.campaignIds
      );
      await addDdbSyncJob(sourcebook.id, userId);
      return sourcebook;
    }),

  syncNow: protectedProcedure
    .input(z.object({ sourcebookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sourcebook = await prisma.ddbSourcebook.findUnique({ where: { id: input.sourcebookId } });
      if (!sourcebook || sourcebook.userId !== ctx.session.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
      await addDdbSyncJob(sourcebook.id, sourcebook.userId);
      return { queued: true };
    }),

  getSourcebook: protectedProcedure
    .input(z.object({ sourcebookId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sourcebook = await prisma.ddbSourcebook.findUnique({
        where: { id: input.sourcebookId },
        include: { chapters: { orderBy: { chapterIndex: 'asc' } } },
      });
      if (!sourcebook || sourcebook.userId !== ctx.session.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
      return sourcebook;
    }),

  resolveChange: protectedProcedure
    .input(z.object({
      chapterId: z.string(),
      entityId: z.string(),
      entityType: z.string(),
      field: z.string(),
      action: z.enum(['accept', 'keep']),
      newValue: z.unknown().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const chapter = await prisma.ddbSourcebookChapter.findUnique({
        where: { id: input.chapterId },
        include: { sourcebook: true },
      });
      if (!chapter || chapter.sourcebook.userId !== ctx.session.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
      await ddbSyncRepository.resolveChange(
        input.chapterId, input.entityId, input.field, input.action, input.entityType, input.newValue
      );
      return { resolved: true };
    }),

  listSourcebooksForCampaign: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const member = await prisma.campaignMember.findFirst({
        where: { campaignId: input.campaignId, userId: ctx.session.user.id },
        select: { role: true },
      });
      if (!member) throw new TRPCError({ code: 'FORBIDDEN' });

      const owned = await prisma.ddbSourcebook.findMany({
        where: { userId: ctx.session.user.id },
        orderBy: { title: 'asc' },
        select: { id: true, slug: true, title: true, syncStatus: true, lastSyncedAt: true, lastSyncError: true },
      });
      const linked = await prisma.campaignSourcebook.findMany({
        where: { campaignId: input.campaignId },
        select: { sourcebookId: true },
      });
      const linkedSet = new Set(linked.map((l) => l.sourcebookId));
      return owned.map((s) => ({ ...s, linked: linkedSet.has(s.id) }));
    }),

  linkSourcebookToCampaign: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), sourcebookId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const member = await prisma.campaignMember.findFirst({
        where: { campaignId: input.campaignId, userId: ctx.session.user.id },
        select: { role: true },
      });
      const isDM = member?.role === 'OWNER' || member?.role === 'CO_DM';
      if (!isDM) throw new TRPCError({ code: 'FORBIDDEN' });

      const sourcebook = await prisma.ddbSourcebook.findUnique({
        where: { id: input.sourcebookId },
        select: { userId: true },
      });
      if (!sourcebook || sourcebook.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      await ddbSyncRepository.linkSourcebookToCampaigns(input.sourcebookId, [input.campaignId]);
      const seedResult = await ddbSyncRepository.seedCampaignFromSourcebook(
        input.campaignId,
        input.sourcebookId,
        ctx.session.user.id,
      );

      const extractedImageCount = await prisma.sourcebookChapterImage.count({
        where: { sourcebookId: input.sourcebookId },
      });
      if (extractedImageCount === 0) {
        await addDdbSyncJob(input.sourcebookId, ctx.session.user.id);
      }

      return { ok: true, ...seedResult };
    }),

  unlinkSourcebookFromCampaign: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1), sourcebookId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const member = await prisma.campaignMember.findFirst({
        where: { campaignId: input.campaignId, userId: ctx.session.user.id },
        select: { role: true },
      });
      const isDM = member?.role === 'OWNER' || member?.role === 'CO_DM';
      if (!isDM) throw new TRPCError({ code: 'FORBIDDEN' });

      await ddbSyncRepository.unlinkSourcebookFromCampaign(input.sourcebookId, input.campaignId);
      return { ok: true };
    }),
});

export type DdbSyncRouter = typeof ddbSyncRouter;
