import { router } from '../trpc';
import { campaignDMProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { NotFoundError } from '../errors';

export const campaignContextRouter = router({
  getRecent: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        limit: z.number().int().min(1).max(10).default(3),
      })
    )
    .query(async ({ input }) => {
      return prisma.campaignContext.findMany({
        where: { campaignId: input.campaignId, type: 'SESSION_EXTRACT' },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        select: {
          id: true,
          sessionId: true,
          content: true,
          keyEvents: true,
          npcsInvolved: true,
          decisions: true,
          lootGained: true,
          createdAt: true,
        },
      });
    }),

  search: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        query: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(20).default(5),
      })
    )
    .query(async ({ input }) => {
      const queryVector = await generateEmbedding(input.query);
      const vectorStr = `[${queryVector.join(',')}]`;

      const results = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          content: string;
          type: string;
          sessionId: string | null;
          similarity: number | string;
        }>
      >(
        `SELECT id, content, type, "sessionId",
                1 - (embedding <=> $1::vector) AS similarity
         FROM "CampaignContext"
         WHERE "campaignId" = $2
           AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        vectorStr,
        input.campaignId,
        input.limit
      );

      return results.map((r) => ({
        ...r,
        similarity:
          typeof r.similarity === 'number'
            ? r.similarity
            : Number.parseFloat(r.similarity as string),
      }));
    }),

  getSourcebooks: campaignDMProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input, ctx }) => {
      return prisma.ddbSourcebook.findMany({
        where: {
          campaignIds: { has: input.campaignId },
          OR: [{ userId: ctx.session.user.id }, { userId: null }],
        },
        select: { id: true, title: true, slug: true },
        orderBy: { title: 'asc' },
      });
    }),

  seedFromSourcebook: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        sourcebookId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const sourcebook = await prisma.ddbSourcebook.findFirst({
        where: {
          id: input.sourcebookId,
          OR: [{ userId: ctx.session.user.id }, { userId: null }],
          campaignIds: { has: input.campaignId },
        },
        include: { chapters: { orderBy: { chapterIndex: 'asc' } } },
      });
      if (!sourcebook) throw new NotFoundError('sourcebook', input.sourcebookId);

      let seeded = 0;

      for (const chapter of sourcebook.chapters) {
        const content = `${sourcebook.title} — ${chapter.title}`.slice(0, 500);

        const record = await prisma.campaignContext.upsert({
          where: {
            campaignId_type_content: {
              campaignId: input.campaignId,
              type: 'SOURCEBOOK_LABEL',
              content,
            },
          },
          create: { campaignId: input.campaignId, type: 'SOURCEBOOK_LABEL', content },
          update: {},
        });

        try {
          const embedding = await generateEmbedding(content);
          const vectorStr = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE "CampaignContext" SET embedding = $1::vector WHERE id = $2`,
            vectorStr,
            record.id
          );
          seeded++;
        } catch (err) {
          console.warn(`[campaignContext.seedFromSourcebook] Embedding failed for "${content}":`, err);
        }
      }

      return { seeded };
    }),
});
