'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Card } from '@/components/primitives/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { MarkdownWithEntities } from './markdown-with-entities';
import type { EntityRef } from './EntityLink';

type Illustration = {
  id: string;
  url: string;
  alt: string | null;
  sectionHeading: string | null;
  isHero: boolean;
  kind: string;
  position: number;
};

type Section = { heading: string | null; level: number; markdown: string };

type ChapterData = {
  chapter: {
    id: string;
    slug: string;
    title: string;
    chapterIndex: number;
    parentSlug: string | null;
    hasBody: boolean;
    bodySyncedAt: Date | null;
  };
  sections: Section[];
  illustrations: Illustration[];
  entityIndex: Array<EntityRef & { aliases: string[] }>;
};

interface Props {
  loading: boolean;
  bookSlug: string;
  campaignId: string;
  data?: ChapterData;
}

function sectionHeadingTag(level: number): 'h2' | 'h3' | 'h4' {
  if (level <= 1) return 'h2';
  if (level === 2) return 'h3';
  return 'h4';
}

export function ChapterView({ loading, data, bookSlug, campaignId }: Props) {
  const { slug: campaignSlug } = useCampaign();
  const resync = trpc.sourcebookReader.resyncBook.useMutation();
  const [zoom, setZoom] = useState<Illustration | null>(null);

  const entityById = useMemo(() => {
    const map = new Map<string, EntityRef>();
    for (const entity of data?.entityIndex ?? []) {
      map.set(entity.id, {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        thumbUrl: entity.thumbUrl,
        oneLineDesc: entity.oneLineDesc,
      });
    }
    return map;
  }, [data?.entityIndex]);

  const hero = data?.illustrations.find((illustration) => illustration.isHero) ?? null;

  const illustrationsBySection = useMemo(() => {
    const map = new Map<string, Illustration[]>();
    for (const illustration of data?.illustrations ?? []) {
      if (illustration.isHero) continue;
      const key = (illustration.sectionHeading ?? '').trim().toLowerCase();
      const list = map.get(key) ?? [];
      list.push(illustration);
      map.set(key, list);
    }
    return map;
  }, [data?.illustrations]);

  if (loading || !data) {
    return (
      <Card variant="grimoire" className="min-h-[60vh] p-6">
        <Skeleton className="mb-6 h-8 w-1/3" />
        <Skeleton className="mb-6 h-56 w-full" />
        <Skeleton className="mb-3 h-4 w-full" />
        <Skeleton className="mb-3 h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
    );
  }

  if (!data.chapter.hasBody || data.sections.length === 0) {
    return (
      <Card variant="grimoire" className="min-h-[60vh] p-8">
        <div className="mx-auto max-w-md text-center">
          <h1 className="font-display text-3xl text-[var(--q-text)]">{data.chapter.title}</h1>
          <p className="mt-4 text-[var(--q-text-dim)]">
            Chapter content hasn&apos;t been stored yet. Re-sync the sourcebook to load the prose.
          </p>
          <button
            type="button"
            disabled={resync.isPending}
            onClick={() => resync.mutate({ campaignId, bookSlug })}
            className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-[var(--q-accent-primary-border)] px-4 py-2 text-sm text-[var(--q-accent-primary)] transition-colors hover:bg-[var(--q-amber-trace)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw className={resync.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {resync.isPending ? 'Queuing re-sync...' : 'Re-sync sourcebook'}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="grimoire" className="min-h-[60vh] p-6">
      <article className="prose-q mx-auto max-w-[72ch]">
        <h1 className="mb-3 font-display text-3xl text-[var(--q-text)]">{data.chapter.title}</h1>

        {hero && (
          <button type="button" onClick={() => setZoom(hero)} className="block w-full">
            <Image
              src={hero.url}
              alt={hero.alt ?? data.chapter.title}
              width={1600}
              height={900}
              className="my-6 w-full rounded-sm"
              unoptimized
            />
          </button>
        )}

        {data.sections.map((section, index) => {
          const key = (section.heading ?? '').trim().toLowerCase();
          const sectionImages = illustrationsBySection.get(key) ?? [];
          const portraitImgs = sectionImages.filter((img) => img.kind === 'portrait');
          const wideImgs = sectionImages.filter((img) => img.kind !== 'portrait');
          const Tag = sectionHeadingTag(section.level);

          return (
            <section key={`${section.heading ?? 'intro'}-${index}`} className="mt-6">
              {section.heading && (
                <Tag className="font-display text-[var(--q-text)]">{section.heading}</Tag>
              )}

              {portraitImgs.map((illustration) => (
                <figure key={illustration.id} className="float-right ml-6 mb-4 w-[220px] clear-right">
                  <button type="button" onClick={() => setZoom(illustration)} className="block w-full">
                    <Image
                      src={illustration.url}
                      alt={illustration.alt ?? ''}
                      width={440}
                      height={600}
                      className="w-full rounded-sm"
                      unoptimized
                    />
                  </button>
                  {illustration.alt && (
                    <figcaption className="mt-1 text-center text-xs italic text-[var(--q-text-dim)]">
                      {illustration.alt}
                    </figcaption>
                  )}
                </figure>
              ))}

              <div className="text-[var(--q-text)]">
                <MarkdownWithEntities
                  markdown={section.markdown}
                  entityById={entityById}
                  campaignSlug={campaignSlug}
                />
              </div>

              {wideImgs.map((illustration) => (
                <figure key={illustration.id} className="mt-6 clear-both">
                  <button type="button" onClick={() => setZoom(illustration)} className="block w-full">
                    <Image
                      src={illustration.url}
                      alt={illustration.alt ?? ''}
                      width={1200}
                      height={800}
                      className={`illustration-full rounded-sm ${illustration.kind === 'map' ? 'my-4' : 'my-6'}`}
                      unoptimized
                    />
                  </button>
                  {illustration.alt && (
                    <figcaption className="mt-1 text-center text-xs italic text-[var(--q-text-dim)]">
                      {illustration.alt}
                    </figcaption>
                  )}
                </figure>
              ))}
            </section>
          );
        })}
        <div className="clear-both" />
      </article>

      <Dialog open={Boolean(zoom)} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="max-w-6xl border-0 bg-transparent p-0 shadow-none">
          {zoom && (
            <Image
              src={zoom.url}
              alt={zoom.alt ?? data.chapter.title}
              width={2000}
              height={1400}
              className="h-auto w-full rounded-sm"
              unoptimized
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
