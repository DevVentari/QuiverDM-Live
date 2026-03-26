import { z } from 'zod';
import { router } from '../trpc';
import { campaignMemberProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { SessionPrepDataSchema } from '@/lib/prep-types';

export const sourcebookScenesRouter = router({
  /**
   * List chapters from a PDF — for the import drawer chapter picker.
   */
  getChapters: campaignMemberProcedure
    .input(z.object({ pdfId: z.string() }))
    .query(async ({ input }) => {
      await assertPdfAccess(input.pdfId, input.campaignId);
      const scenes = await prisma.sourcebookScene.findMany({
        where: { pdfId: input.pdfId },
        select: { chapterId: true, chapterTitle: true, chapterIndex: true },
        distinct: ['chapterId'],
        orderBy: { chapterIndex: 'asc' },
      });
      const counts = await prisma.sourcebookScene.groupBy({
        by: ['chapterId'],
        where: { pdfId: input.pdfId },
        _count: { id: true },
      });
      const countMap = Object.fromEntries(counts.map(c => [c.chapterId, c._count.id]));
      return scenes.map(s => ({
        chapterId: s.chapterId,
        chapterTitle: s.chapterTitle,
        chapterIndex: s.chapterIndex,
        sceneCount: countMap[s.chapterId] ?? 0,
      }));
    }),

  /**
   * Get all scenes for a specific chapter.
   */
  getByChapter: campaignMemberProcedure
    .input(z.object({ pdfId: z.string(), chapterId: z.string() }))
    .query(async ({ input }) => {
      await assertPdfAccess(input.pdfId, input.campaignId);
      return prisma.sourcebookScene.findMany({
        where: { pdfId: input.pdfId, chapterId: input.chapterId },
        orderBy: { sceneIndex: 'asc' },
      });
    }),

  /**
   * Get scenes by their ids — used by cockpit to resolve roll tables for active scene.
   */
  getByIds: campaignMemberProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.ids.length === 0) return [];
      const campaign = await prisma.campaign.findUniqueOrThrow({
        where: { id: input.campaignId },
        select: { userId: true },
      });
      return prisma.sourcebookScene.findMany({
        where: {
          id: { in: input.ids },
          pdf: {
            OR: [
              { campaignId: input.campaignId },
              { userId: campaign.userId, campaignId: null },
            ],
          },
        },
      });
    }),

  /**
   * List PDFs available to this campaign (campaign-specific + owner's personal library).
   */
  getAvailablePdfs: campaignMemberProcedure
    .query(async ({ input }) => {
      const campaign = await prisma.campaign.findUniqueOrThrow({
        where: { id: input.campaignId },
        select: { userId: true },
      });
      return prisma.homebrewPDF.findMany({
        where: {
          OR: [
            { campaignId: input.campaignId },
            { userId: campaign.userId, campaignId: null },
          ],
        },
        select: { id: true, filename: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  /**
   * Auto-suggest the next chapter to import based on previous sessions' sourceIds.
   */
  suggestNextChapter: campaignMemberProcedure
    .input(z.object({ pdfId: z.string() }))
    .query(async ({ input }) => {
      const sessions = await prisma.gameSession.findMany({
        where: { campaignId: input.campaignId },
        select: { prepData: true },
      });

      const sourceIds: string[] = [];
      for (const s of sessions) {
        const parsed = SessionPrepDataSchema.safeParse(s.prepData);
        if (!parsed.success) continue;
        for (const scene of parsed.data.scenes) {
          if (scene.sourceId) sourceIds.push(scene.sourceId);
        }
      }

      if (sourceIds.length === 0) {
        const first = await prisma.sourcebookScene.findFirst({
          where: { pdfId: input.pdfId },
          orderBy: { chapterIndex: 'asc' },
          select: { chapterId: true, chapterIndex: true },
        });
        return first ? { chapterId: first.chapterId, chapterIndex: first.chapterIndex } : null;
      }

      const usedScenes = await prisma.sourcebookScene.findMany({
        where: { id: { in: sourceIds }, pdfId: input.pdfId },
        select: { chapterIndex: true },
      });
      const maxUsed = Math.max(...usedScenes.map(s => s.chapterIndex));

      const next = await prisma.sourcebookScene.findFirst({
        where: { pdfId: input.pdfId, chapterIndex: { gt: maxUsed } },
        orderBy: { chapterIndex: 'asc' },
        select: { chapterId: true, chapterIndex: true },
      });

      if (next) return { chapterId: next.chapterId, chapterIndex: next.chapterIndex };

      const last = await prisma.sourcebookScene.findFirst({
        where: { pdfId: input.pdfId },
        orderBy: { chapterIndex: 'desc' },
        select: { chapterId: true, chapterIndex: true },
      });
      return last ? { chapterId: last.chapterId, chapterIndex: last.chapterIndex } : null;
    }),
});

/** Validate PDF is accessible to campaign (campaign-specific or owner's personal library). */
async function assertPdfAccess(pdfId: string, campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { userId: true },
  });
  await prisma.homebrewPDF.findFirstOrThrow({
    where: {
      id: pdfId,
      OR: [
        { campaignId },
        { userId: campaign.userId, campaignId: null },
      ],
    },
    select: { id: true },
  });
}
