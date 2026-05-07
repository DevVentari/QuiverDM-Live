import { Suspense } from 'react';
import { WorldMapCanvas } from '@/components/world/world-map-canvas';
import { BentoCanvas } from '@/components/layout/bento-canvas';
import { Skeleton } from '@/components/ui/skeleton';

interface WorldMapPageProps {
  params: Promise<{ slug: string }>;
}

export default async function WorldMapPage({ params }: WorldMapPageProps) {
  const { slug } = await params;
  return (
    <BentoCanvas overline="Campaign" title="World Map">
      <Suspense fallback={<Skeleton className="h-full w-full rounded-lg" />}>
        <WorldMapCanvas slug={slug} />
      </Suspense>
    </BentoCanvas>
  );
}
