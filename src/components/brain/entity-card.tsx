'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Entity = {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string | null;
  aliases: string[];
};

const statusDot: Record<string, string> = {
  active: 'bg-emerald-500',
  dormant: 'bg-yellow-500',
  destroyed: 'bg-destructive',
  resolved: 'bg-muted-foreground',
};

const typeColors: Record<string, string> = {
  NPC: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  PC: 'text-sky-400 border-sky-400/30 bg-sky-400/10',
  FACTION: 'text-violet-400 border-violet-400/30 bg-violet-400/10',
  LOCATION: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  THREAT: 'text-red-400 border-red-400/30 bg-red-400/10',
  ITEM: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  ARC: 'text-pink-400 border-pink-400/30 bg-pink-400/10',
  EVENT: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  SECRET: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
  CUSTOM: 'text-muted-foreground border-border bg-muted/20',
};

export function EntityCard({ entity, href }: { entity: Entity; href: string }) {
  return (
    <Link href={href}>
      <div className="glass-panel group flex flex-col gap-1.5 rounded-lg border border-border/50 bg-card/40 p-3 transition-colors hover:border-foreground/30 cursor-pointer">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              statusDot[entity.status] ?? 'bg-muted-foreground'
            )}
            title={entity.status}
          />
          <span className="truncate text-sm font-medium leading-tight">
            {entity.name}
          </span>
          <Badge
            variant="outline"
            className={cn('ml-auto shrink-0 text-[10px] uppercase tracking-wider', typeColors[entity.type] ?? typeColors.CUSTOM)}
          >
            {entity.type}
          </Badge>
        </div>
        {entity.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground leading-snug">
            {entity.description}
          </p>
        )}
        {entity.aliases.length > 0 && (
          <p className="text-[10px] text-muted-foreground/60 truncate">
            aka {entity.aliases.join(', ')}
          </p>
        )}
      </div>
    </Link>
  );
}
