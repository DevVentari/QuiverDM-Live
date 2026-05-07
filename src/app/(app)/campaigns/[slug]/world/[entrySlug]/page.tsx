'use client';

import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { EntityDetail } from '@/components/world/entity-detail';

export default function WorldEntryPage() {
  const { entrySlug } = useParams<{ entrySlug: string }>();
  const { campaignId } = useCampaign();
  const router = useRouter();

  const { data: entry, isLoading, isError } = trpc.world.getEntryBySlug.useQuery(
    { campaignId, slug: entrySlug },
    { staleTime: 60_000 }
  );

  const backAction = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.back()}
      className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
    >
      <ChevronLeft className="h-4 w-4" />
      World Lore
    </Button>
  );

  if (isLoading) {
    return (
      <PageLayout overline="World" title="Loading..." actions={backAction}>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-md bg-white/5 animate-pulse" />
          ))}
        </div>
      </PageLayout>
    );
  }

  if (isError || !entry) {
    return (
      <PageLayout overline="World" title="Not Found" actions={backAction}>
        <p className="text-sm text-muted-foreground/60">
          This entity could not be found. It may have been removed.
        </p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      overline="World"
      title={entry.name}
      actions={backAction}
    >
      <EntityDetail
        entry={{
          ...entry,
          structuredData: entry.structuredData as Record<string, unknown> | null,
        }}
      />
    </PageLayout>
  );
}
