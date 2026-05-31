'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, ExternalLink } from 'lucide-react';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Card } from '@/components/primitives/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BentoCanvas } from '@/components/layout/bento-canvas';
import { trpc } from '@/lib/trpc';
import { ChapterTree } from './ChapterTree';
import { ChapterView } from './ChapterView';

export function SourcebookReader() {
  const { campaignId, isDM } = useCampaign();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const sourcebooksQuery = trpc.ddbSync.listSourcebooksForCampaign.useQuery(
    { campaignId },
    { staleTime: 30_000 }
  );

  const linkedBook = useMemo(
    () => sourcebooksQuery.data?.find((sourcebook) => sourcebook.linked) ?? null,
    [sourcebooksQuery.data],
  );

  const overviewQuery = trpc.sourcebookReader.getOverview.useQuery(
    { campaignId, bookSlug: linkedBook?.slug ?? '' },
    { enabled: Boolean(linkedBook) }
  );

  const overview = overviewQuery.data ?? null;
  const overviewChapters = overview?.chapters ?? [];
  const requestedChapterSlug = searchParams.get('chapter') ?? '';
  const activeChapterSlug = useMemo(() => {
    if (overviewChapters.length === 0) return requestedChapterSlug;
    if (requestedChapterSlug && overviewChapters.some((chapter) => chapter.slug === requestedChapterSlug)) {
      return requestedChapterSlug;
    }
    return overviewChapters[0]?.slug ?? requestedChapterSlug;
  }, [overviewChapters, requestedChapterSlug]);

  useEffect(() => {
    if (!overviewChapters.length || !activeChapterSlug) return;
    if (requestedChapterSlug === activeChapterSlug) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set('chapter', activeChapterSlug);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeChapterSlug, overviewChapters.length, pathname, requestedChapterSlug, router, searchParams]);

  const chapterQuery = trpc.sourcebookReader.getChapter.useQuery(
    {
      campaignId,
      bookSlug: linkedBook?.slug ?? '',
      chapterSlug: activeChapterSlug,
    },
    { enabled: Boolean(linkedBook && activeChapterSlug && overview) }
  );

  const resyncBook = trpc.sourcebookReader.resyncBook.useMutation({
    onSuccess: async () => {
      await Promise.all([overviewQuery.refetch(), chapterQuery.refetch()]);
    },
  });

  if (!isDM) {
    return (
      <Card variant="grimoire" className="p-8 text-center">
        <BookOpen className="mx-auto h-12 w-12 text-[var(--q-text-dim)]/60" />
        <p className="mt-4 text-[var(--q-text-dim)]">Sourcebook Reader is only available to Dungeon Masters.</p>
      </Card>
    );
  }

  if (sourcebooksQuery.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Skeleton className="h-[60vh] w-full" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  if (!linkedBook) {
    return (
      <BentoCanvas overline="Campaign" title="Sourcebook">
        <Card variant="detail" className="flex flex-col items-center justify-center gap-5 py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] flex items-center justify-center">
            <BookOpen className="h-7 w-7 text-[var(--q-text-faint)]" />
          </div>
          <div className="space-y-2 max-w-xs">
            <h3 className="font-[var(--q-font-display)] text-xl text-[var(--q-text)]">No Sourcebook Linked</h3>
            <p className="text-sm text-[var(--q-text-dim)]">
              No linked sourcebook is available for this campaign yet. Import or link one in D&D Beyond settings.
            </p>
          </div>
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/settings">
              Connect D&D Beyond
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </Card>
      </BentoCanvas>
    );
  }

  if (overviewQuery.isLoading || !overview) {
    return (
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Skeleton className="h-[60vh] w-full" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <ChapterTree
        book={overview.book}
        chapters={overview.chapters}
        activeSlug={activeChapterSlug}
        resyncPending={resyncBook.isPending}
        onResync={() => resyncBook.mutate({ campaignId, bookSlug: linkedBook.slug })}
        onSelect={(chapterSlug) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set('chapter', chapterSlug);
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }}
      />

      <ChapterView
        loading={chapterQuery.isLoading}
        bookSlug={linkedBook.slug}
        campaignId={campaignId}
        data={chapterQuery.data ?? undefined}
      />
    </div>
  );
}
