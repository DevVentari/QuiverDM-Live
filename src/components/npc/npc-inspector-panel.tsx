'use client';

import Image from 'next/image';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface NpcInspectorPanelProps {
  npcId: string;
  slug: string;
  isDM: boolean;
}

export function NpcInspectorPanel({ npcId, slug, isDM }: NpcInspectorPanelProps) {
  const npc = trpc.npcs.getById.useQuery({ id: npcId }, { staleTime: 120_000 });

  if (npc.isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Skeleton className="h-48 w-full rounded-none" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 flex-1 rounded" />)}
          </div>
          <Skeleton className="h-32 w-full rounded mt-4" />
        </div>
      </div>
    );
  }

  if (npc.isError || !npc.data) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Failed to load NPC.
      </div>
    );
  }

  const data = npc.data as any;
  const stats = data.stats as any;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Portrait */}
      <div className="relative h-52 w-full shrink-0 bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900">
        {data.imageUrl && (
          <Image src={data.imageUrl} alt={data.name} fill className="object-cover object-top opacity-90" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="font-display text-xl font-bold" style={{ color: 'hsl(35 30% 90%)' }}>
            {data.name}
          </h3>
          {data.faction && (
            <Badge variant="outline" className="mt-1 text-xs border-amber-500/30 text-amber-400/80">
              {data.faction}
            </Badge>
          )}
        </div>
      </div>

      {/* Stat pills — handles both the legacy npc.stats shape (armorClass / hitPoints)
          and the DDB monster stat block shape (ac / hp) that's linked via statBlockId. */}
      {stats && (
        <div className="flex divide-x" style={{ borderBottom: '1px solid hsl(35 35% 18%)', borderColor: 'hsl(35 35% 18%)' }}>
          {[
            { label: 'CR', value: stats.cr ?? '—' },
            { label: 'HP', value: stats.hp ?? (typeof stats.hitPoints === 'object' ? stats.hitPoints?.max : stats.hitPoints) ?? '—' },
            { label: 'AC', value: stats.ac ?? stats.armorClass ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="stone-card-body flex-1 text-center py-3" style={{ borderColor: 'hsl(35 35% 18%)' }}>
              <div className="stat-value text-base">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Action block — surfaced when the linked DDB stat block carries one. */}
      {stats && Array.isArray(stats.actions) && stats.actions.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <p className="label-overline mb-2">Actions</p>
          <div className="section-rule mb-3" />
          <ul className="space-y-2 text-sm text-muted-foreground">
            {(stats.actions as Array<{ name: string; description?: string }>).slice(0, 8).map((a) => (
              <li key={a.name}>
                <span className="text-foreground font-medium">{a.name}.</span>{' '}
                <span>{a.description ?? ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 p-4 space-y-4">
        {data.description && (
          <div>
            <p className="label-overline mb-1">Description</p>
            <div className="section-rule mb-2" />
            <p className="text-sm text-muted-foreground leading-relaxed">{data.description}</p>
          </div>
        )}

        {isDM && data.secrets && (
          <div>
            <p className="label-overline mb-1" style={{ color: 'hsl(35 80% 55% / 0.7)' }}>DM Secrets</p>
            <div className="section-rule mb-2" />
            <div className="stone-card p-3">
              <p className="text-sm leading-relaxed">{data.secrets}</p>
            </div>
          </div>
        )}

        {(stats?.size || stats?.creatureType || stats?.alignment) ? (
          <div>
            <p className="label-overline mb-1">Type</p>
            <div className="section-rule mb-2" />
            <p className="text-sm text-muted-foreground">
              {[stats.size, stats.creatureType, stats.alignment].filter(Boolean).join(' · ')}
            </p>
          </div>
        ) : null}

        <div className="pt-2">
          <Button asChild variant="outline" size="sm" className="w-full gap-2">
            <Link href={`/campaigns/${slug}/npcs/${data.id}`}>
              Full Details <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
