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
    <div className="absolute left-16 top-4 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/80 px-2 py-1 backdrop-blur-sm">
      {path.map((segment, i) => (
        <div key={segment.mapId} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-1 py-0.5 text-xs"
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
