'use client';

import { trpc } from '@/lib/trpc';
import { PartyMemberCard } from './party-member-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';

interface PartyOverviewPanelProps {
  campaignId: string;
}

export function PartyOverviewPanel({ campaignId }: PartyOverviewPanelProps) {
  const query = trpc.characters.getCampaignCharacters.useQuery(
    { campaignId },
    { refetchInterval: 30_000 }
  );

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-3">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Party
        </span>
      </div>

      {query.isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
      )}

      {query.isError && (
        <p className="text-xs text-destructive">{query.error.message}</p>
      )}

      {query.data && query.data.length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center py-4">
          No characters in this campaign
        </p>
      )}

      {query.data?.map((cc: any) => {
        const char = cc.character ?? cc;
        const hp = char.hitPoints as { current: number; max: number; temp?: number } | null | undefined;
        const conditions = Array.isArray(cc.conditions)
          ? (cc.conditions as string[])
          : [];

        return (
          <PartyMemberCard
            key={cc.id ?? char.id}
            name={char.name}
            characterClass={char.class}
            race={char.race}
            level={char.level}
            portraitUrl={char.portraitUrl}
            hitPoints={hp}
            armorClass={char.armorClass}
            conditions={conditions}
          />
        );
      })}
    </div>
  );
}
