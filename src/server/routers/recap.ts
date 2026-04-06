import { z } from 'zod';
import { RecapStatus, RecapStyle } from '@prisma/client';
import { router, campaignDMProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { recapGenerationQueue } from '@/lib/queue/recap-generation-queue';
import { NotFoundError } from '../errors';
import Anthropic from '@anthropic-ai/sdk';
import { buildSectionRegenPrompt } from '@/lib/recap/recap-section-prompts';
import type { RecapStyleKey } from '@/lib/recap/recap-prompts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  regenSection: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        recapId: z.string(),
        sectionKey: z.string(),
        dmNote: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const recap = await prisma.sessionRecap.findFirst({
        where: { id: input.recapId, campaignId: input.campaignId },
        include: {
          session: {
            include: { transcripts: { orderBy: { createdAt: 'desc' }, take: 1 } },
          },
        },
      });
      if (!recap) throw new NotFoundError('recap', input.recapId);

      const transcript = recap.session.transcripts[0];
      if (!transcript?.correctedText) throw new Error('No transcript available for this session');

      const sections = recap.sections as Array<{ key: string; title: string; content: string }>;
      const target = sections.find((s) => s.key === input.sectionKey);
      if (!target) throw new Error(`Section "${input.sectionKey}" not found in recap`);

      const { system, user } = buildSectionRegenPrompt({
        correctedText: transcript.correctedText.slice(0, 12000),
        sectionKey: input.sectionKey,
        sectionTitle: target.title,
        style: recap.style as RecapStyleKey,
        dmNote: input.dmNote,
      });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system,
        messages: [{ role: 'user', content: user }],
      });

      const content =
        response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
      if (!content) throw new Error('Anthropic returned empty content');
      return { content };
    }),

  updateSections: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        recapId: z.string(),
        sections: z.array(
          z.object({
            key: z.string(),
            title: z.string(),
            content: z.string(),
          })
        ),
        status: z.enum(['REVIEWED', 'QUICK_FIRE']),
      })
    )
    .mutation(async ({ input }) => {
      const recap = await prisma.sessionRecap.findFirst({
        where: { id: input.recapId, campaignId: input.campaignId },
        select: { id: true },
      });
      if (!recap) throw new NotFoundError('recap', input.recapId);

      const rawContent = input.sections.map((s) => s.content).join('\n\n');
      return prisma.sessionRecap.update({
        where: { id: input.recapId },
        data: {
          sections: input.sections,
          rawContent,
          status: RecapStatus[input.status],
        },
      });
    }),
});
