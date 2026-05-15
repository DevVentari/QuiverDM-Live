import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { addDdbSyncJob } from '@/lib/queue/ddb-sync-queue';
import { tokenizeEntities, type EntityIndexItem } from '@/lib/sourcebook/entity-tokenizer';
import { router, campaignDMProcedure } from '../trpc';

type StoredSection = { heading: string | null; level: number; markdown: string };

async function resolveLinkedBook(campaignId: string, bookSlug: string) {
  const link = await prisma.campaignSourcebook.findFirst({
    where: {
      campaignId,
      sourcebook: { slug: bookSlug },
    },
    include: { sourcebook: true },
  });

  if (!link) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Sourcebook not linked to this campaign' });
  }

  return link.sourcebook;
}

export const sourcebookReaderRouter = router({
  getOverview: campaignDMProcedure
    .input(z.object({ campaignId: z.string().min(1), bookSlug: z.string().min(1) }))
    .query(async ({ input }) => {
      const book = await resolveLinkedBook(input.campaignId, input.bookSlug);
      const chapters: any[] = await prisma.ddbSourcebookChapter.findMany({
        where: { sourcebookId: book.id },
        orderBy: { chapterIndex: 'asc' },
        select: {
          id: true,
          slug: true,
          title: true,
          chapterIndex: true,
          parentSlug: true,
          bodySyncedAt: true,
        } as any,
      } as any);

      return {
        book: {
          id: book.id,
          slug: book.slug,
          title: book.title,
          lastSyncedAt: book.lastSyncedAt,
          syncStatus: book.syncStatus,
        },
        chapters: chapters.map((chapter: any) => ({
          id: chapter.id,
          slug: chapter.slug,
          title: chapter.title,
          chapterIndex: chapter.chapterIndex,
          parentSlug: chapter.parentSlug,
          hasBody: chapter.bodySyncedAt !== null,
        })),
      };
    }),

  getChapter: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        bookSlug: z.string().min(1),
        chapterSlug: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const book = await resolveLinkedBook(input.campaignId, input.bookSlug);
      const chapter: any = await prisma.ddbSourcebookChapter.findUnique({
        where: {
          sourcebookId_slug: { sourcebookId: book.id, slug: input.chapterSlug },
        },
        include: {
          illustrations: { orderBy: { position: 'asc' } },
        },
      } as any);

      if (!chapter) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chapter not found' });
      }

      const entityRows = await prisma.sourcebookEntity.findMany({
        where: { sourcebookId: book.id },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          aliases: true,
          type: true,
          description: true,
          imageUrl: true,
        },
      });

      const entityIndex = entityRows.map((entity) => ({
        id: entity.id,
        name: entity.name,
        aliases: entity.aliases ?? [],
        type: entity.type,
        thumbUrl: entity.imageUrl,
        oneLineDesc: entity.description
          ? entity.description.split(/\r?\n/)[0].slice(0, 160)
          : null,
      }));

      const linkableIndex: EntityIndexItem[] = entityIndex.map((entity) => ({
        id: entity.id,
        name: entity.name,
        aliases: entity.aliases,
        type: entity.type,
      }));

      const rawSections = (chapter.bodySections ?? []) as StoredSection[];
      const sections = rawSections.map((section) => ({
        heading: section.heading,
        level: section.level,
        markdown: tokenizeEntities(section.markdown, linkableIndex),
      }));

      return {
        chapter: {
          id: chapter.id,
          slug: chapter.slug,
          title: chapter.title,
          chapterIndex: chapter.chapterIndex,
          parentSlug: chapter.parentSlug,
          hasBody: chapter.bodySyncedAt !== null,
          bodySyncedAt: chapter.bodySyncedAt,
        },
        sections,
        illustrations: (chapter.illustrations as any[]).map((illustration: any) => ({
          id: illustration.id,
          url: illustration.url,
          alt: illustration.alt,
          sectionHeading: illustration.sectionHeading,
          isHero: illustration.isHero,
          kind: illustration.kind,
          position: illustration.position,
        })),
        entityIndex,
      };
    }),

  resyncBook: campaignDMProcedure
    .input(z.object({ campaignId: z.string().min(1), bookSlug: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const book = await resolveLinkedBook(input.campaignId, input.bookSlug);
      if (book.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the book owner can trigger re-sync' });
      }

      await addDdbSyncJob(book.id, book.userId);
      return { queued: true };
    }),
});

