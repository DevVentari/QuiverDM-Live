import { z } from 'zod';
import { RecapStatus, RecapStyle } from '@prisma/client';
import { router, campaignDMProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { recapGenerationQueue } from '@/lib/queue/recap-generation-queue';
import { NotFoundError } from '../errors';

const RecapStyleEnum = z.nativeEnum(RecapStyle);

export const recapRouter = router({
  generate: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        sessionId: z.string(),
        transcriptId: z.string(),
        style: RecapStyleEnum,
      })
    )
    .mutation(async ({ input }) => {
      const session = await prisma.gameSession.findFirst({
        where: { id: input.sessionId, campaignId: input.campaignId },
        select: { id: true },
      });
      if (!session) throw new NotFoundError('session', input.sessionId);

      const recap = await prisma.sessionRecap.create({
        data: {
          sessionId: input.sessionId,
          campaignId: input.campaignId,
          style: input.style,
          status: RecapStatus.GENERATING,
          sections: [],
          rawContent: '',
          clarificationSkipped: true,
        },
      });
      await recapGenerationQueue.add('generate', {
        recapId: recap.id,
        transcriptId: input.transcriptId,
        campaignId: input.campaignId,
        sessionId: input.sessionId,
        style: input.style,
      });
      return { recapId: recap.id };
    }),

  getBySession: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        sessionId: z.string(),
      })
    )
    .query(async ({ input }) => {
      return prisma.sessionRecap.findMany({
        where: { campaignId: input.campaignId, sessionId: input.sessionId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  getById: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        recapId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const recap = await prisma.sessionRecap.findFirst({
        where: { id: input.recapId, campaignId: input.campaignId },
      });
      if (!recap) throw new NotFoundError('recap', input.recapId);
      return recap;
    }),

  regenerate: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        recapId: z.string(),
        style: RecapStyleEnum,
      })
    )
    .mutation(async ({ input }) => {
      const source = await prisma.sessionRecap.findFirst({
        where: { id: input.recapId, campaignId: input.campaignId },
      });
      if (!source) throw new NotFoundError('recap', input.recapId);

      const session = await prisma.gameSession.findFirst({
        where: { id: source.sessionId, campaignId: input.campaignId },
        select: { id: true },
      });
      if (!session) throw new NotFoundError('session', source.sessionId);

      const transcript = await prisma.transcript.findFirst({
        where: { sessionId: source.sessionId },
        orderBy: { createdAt: 'desc' },
      });
      if (!transcript) throw new NotFoundError('transcript', source.sessionId);

      const newRecap = await prisma.sessionRecap.create({
        data: {
          sessionId: source.sessionId,
          campaignId: input.campaignId,
          style: input.style,
          status: RecapStatus.GENERATING,
          sections: [],
          rawContent: '',
          clarificationSkipped: true,
        },
      });
      await recapGenerationQueue.add('generate', {
        recapId: newRecap.id,
        transcriptId: transcript.id,
        campaignId: input.campaignId,
        sessionId: source.sessionId,
        style: input.style,
      });
      return { recapId: newRecap.id };
    }),

  exportMarkdown: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        recapId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const recap = await prisma.sessionRecap.findFirst({
        where: { id: input.recapId, campaignId: input.campaignId },
        include: {
          session: { select: { title: true, sessionNumber: true } },
        },
      });
      if (!recap) throw new NotFoundError('recap', input.recapId);

      const title = recap.session.title ?? `Session ${recap.session.sessionNumber}`;
      const sections = recap.sections as Array<{ key: string; title: string; content: string }>;
      const markdown = [`# ${title}`]
        .concat(sections.map((s) => `## ${s.title}\n\n${s.content}`))
        .join('\n\n');
      return { markdown };
    }),
});
