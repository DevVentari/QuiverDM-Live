'use client';

import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface BreadcrumbSegment {
  mapId: string;
  name: string;
  entityId: string | null;
}

interface MapBreadcrumbProps {
  path: BreadcrumbSegment[];
  slug: string;
}

export function MapBreadcrumb({ path, slug }: MapBreadcrumbProps) {
  const router = useRouter();
  return (
    <div className="absolute left-20 top-5 z-20 flex items-center gap-1 rounded-full border border-[var(--q-accent-primary-border)] bg-black/35 px-2 py-1.5 backdrop-blur-md">
      {path.map((segment, i) => (
        <div key={segment.mapId} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-[var(--q-accent-primary-dim)]" />}
          <Button
            variant="ghost"
            size="sm"
            className="h-auto rounded-full px-2 py-0.5 text-xs text-[var(--q-text-dim)] hover:bg-[var(--q-accent-primary-trace)] hover:text-[var(--q-text)]"
            disabled={i === path.length - 1}
            onClick={() => {
              if (i === 0) {
                router.push(`/campaigns/${slug}/world-map`);
              } else {
                router.push(`/campaigns/${slug}/world-map?map=${segment.mapId}`);
              }
            }}
          >
            {segment.name}
          </Button>
        </div>
      ))}
    </div>
  );
}
