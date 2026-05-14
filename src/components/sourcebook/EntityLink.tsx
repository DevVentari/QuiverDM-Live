'use client';

import Link from 'next/link';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';

export type EntityRef = {
  id: string;
  name: string;
  type: string;
  thumbUrl?: string | null;
  oneLineDesc?: string | null;
};

interface Props {
  entity: EntityRef;
  displayText: string;
  campaignSlug: string;
}

export function EntityLink({ entity, displayText, campaignSlug }: Props) {
  const href = `/campaigns/${campaignSlug}/brain/entities?entity=${entity.id}`;

  return (
    <HoverCard>
      <HoverCardTrigger>
        <Link
          href={href}
          className={cn(
            'inline-flex items-baseline rounded-[2px] px-0.5',
            'text-[var(--q-accent-primary)] underline decoration-dotted underline-offset-4',
            'transition-colors hover:text-[var(--q-text)]',
          )}
        >
          {displayText}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent>
        <div className="flex items-start gap-3">
          {entity.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entity.thumbUrl}
              alt=""
              className="h-12 w-12 rounded-sm object-cover shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-sm bg-[var(--q-surface-utility)] shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[var(--q-accent-primary)]">
              {entity.type}
            </div>
            <div className="font-display text-sm text-[var(--q-text)] truncate">
              {entity.name}
            </div>
            {entity.oneLineDesc && (
              <div className="mt-1 line-clamp-2 text-xs text-[var(--q-text-dim)]">
                {entity.oneLineDesc}
              </div>
            )}
          </div>
        </div>
        <Link
          href={href}
          className="mt-3 block text-center text-xs text-[var(--q-accent-primary)] hover:underline"
        >
          Open
        </Link>
      </HoverCardContent>
    </HoverCard>
  );
}
