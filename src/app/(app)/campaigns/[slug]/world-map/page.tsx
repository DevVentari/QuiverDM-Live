import { Suspense } from 'react';
import { WorldMapCanvas } from '@/components/world/world-map-canvas';
import { Skeleton } from '@/components/ui/skeleton';

interface WorldMapPageProps {
  params: Promise<{ slug: string }>;
}

export default async function WorldMapPage({ params }: WorldMapPageProps) {
  const { slug } = await params;
  return (
    <div className="h-full">
      <Suspense fallback={<Skeleton className="h-full w-full rounded-lg" />}>
        <WorldMapCanvas slug={slug} />
      </Suspense>
    </div>
  );
}
