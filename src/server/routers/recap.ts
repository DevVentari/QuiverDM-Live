import { z } from 'zod';
import { RecapStatus, RecapStyle } from '@prisma/client';
import { router, campaignDMProcedure, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { recapGenerationQueue } from '@/lib/queue/recap-generation-queue';
import { NotFoundError } from '../errors';
import Anthropic from '@anthropic-ai/sdk';
import { buildSectionRegenPrompt } from '@/lib/recap/recap-section-prompts';
import type { RecapStyleKey } from '@/lib/recap/recap-prompts';
import { postRecapToChannel } from '@/lib/discord/bot';

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

  linkDiscordChannel: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        guildId: z.string().min(1),
        channelId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: {
          discordGuildId: input.guildId,
          discordRecapChannelId: input.channelId,
        },
      });
      return { ok: true };
    }),

  shareToDiscord: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        recapId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const [recap, campaign] = await Promise.all([
        prisma.sessionRecap.findFirst({
          where: { id: input.recapId, campaignId: input.campaignId },
          include: { session: { select: { title: true, sessionNumber: true } } },
        }),
        prisma.campaign.findUnique({
          where: { id: input.campaignId },
          select: { discordRecapChannelId: true, discordGuildId: true },
        }),
      ]);

      if (!recap) throw new NotFoundError('recap', input.recapId);
      if (!campaign?.discordRecapChannelId) {
        throw new Error('NO_CHANNEL_LINKED');
      }

      const sessionTitle =
        recap.session.title ?? `Session ${recap.session.sessionNumber}`;
      const sections = (recap.sections as Array<{ key: string; title: string; content: string }>)
        .filter((s) => s.title && s.content);

      await postRecapToChannel({
        channelId: campaign.discordRecapChannelId,
        sessionTitle,
        sections,
      });

      return { ok: true };
    }),

  getDashboard: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const memberships = await prisma.campaignMember.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'CO_DM'] },
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    const campaignIds = memberships.map((m) => m.campaignId);
    if (campaignIds.length === 0) return [];

    const recapGroups = await prisma.sessionRecap.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: campaignIds } },
      _count: { id: true },
    });

    const latestRecaps = await prisma.sessionRecap.findMany({
      where: { campaignId: { in: campaignIds } },
      orderBy: { createdAt: 'desc' },
      distinct: ['campaignId'],
      select: {
        campaignId: true,
        createdAt: true,
        session: { select: { title: true, sessionNumber: true } },
      },
    });

    return memberships.map((m) => {
      const groups = recapGroups.filter((g) => g.campaignId === m.campaignId);
      const totalRecaps = groups.reduce((sum, g) => sum + g._count.id, 0);
      const pendingReview = groups
        .filter((g) => g.status === 'AUTO_GENERATED')
        .reduce((sum, g) => sum + g._count.id, 0);
      const latest = latestRecaps.find((r) => r.campaignId === m.campaignId);
      const lastSessionTitle = latest
        ? (latest.session.title ?? `Session ${latest.session.sessionNumber}`)
        : null;
      return {
        campaignId: m.campaignId,
        campaignName: m.campaign.name,
        slug: m.campaign.slug,
        totalRecaps,
        pendingReview,
        lastRecapDate: latest?.createdAt ?? null,
        lastSessionTitle,
      };
    });
  }),

  getRecentAcrossCampaigns: protectedProcedure
    .input(
      z.object({
        campaignIds: z.array(z.string()).optional(),
        status: z.nativeEnum(RecapStatus).optional(),
        cursor: z.number().default(0),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const memberships = await prisma.campaignMember.findMany({
        where: {
          userId,
          role: { in: ['OWNER', 'CO_DM'] },
          ...(input.campaignIds?.length
            ? { campaignId: { in: input.campaignIds } }
            : {}),
        },
        select: { campaignId: true },
      });
      const allowedCampaignIds = memberships.map((m) => m.campaignId);
      if (allowedCampaignIds.length === 0) return { items: [], nextCursor: null };

      const recaps = await prisma.sessionRecap.findMany({
        where: {
          campaignId: { in: allowedCampaignIds },
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: [{ session: { date: 'desc' } }, { createdAt: 'desc' }],
        skip: input.cursor,
        take: input.limit + 1,
        include: {
          session: {
            select: {
              title: true,
              sessionNumber: true,
              date: true,
            },
          },
          campaign: {
            select: { name: true, slug: true },
          },
        },
      });

      const hasMore = recaps.length > input.limit;
      const items = hasMore ? recaps.slice(0, -1) : recaps;
      const nextCursor = hasMore ? input.cursor + input.limit : null;

      return {
        items: items.map((r) => ({
          recapId: r.id,
          sessionId: r.sessionId,
          sessionTitle: r.session.title ?? `Session ${r.session.sessionNumber}`,
          sessionDate: r.session.date,
          campaignId: r.campaignId,
          campaignName: r.campaign.name,
          slug: r.campaign.slug,
          status: r.status,
          style: r.style,
        })),
        nextCursor,
      };
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
