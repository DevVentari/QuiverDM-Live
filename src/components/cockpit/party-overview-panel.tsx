'use client';

import { trpc } from '@/lib/trpc';
import { PartyMemberCard } from './party-member-card';
import { InitiativeTracker } from './initiative-tracker';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface PartyOverviewPanelProps {
  campaignId: string;
  sessionId: string;
}

export function PartyOverviewPanel({ campaignId, sessionId }: PartyOverviewPanelProps) {
  const query = trpc.characters.getCampaignCharacters.useQuery(
    { campaignId },
    { refetchInterval: 30_000 }
  );

  const { data: sessionStates = [] } = trpc.sessions.getCharacterSessionStates.useQuery(
    { campaignId, sessionId },
    { refetchInterval: 15_000, enabled: !!sessionId }
  );

  const { data: allEvents = [] } = trpc.sessions.getSessionEvents.useQuery(
    { campaignId, sessionId },
    { refetchInterval: 15_000, enabled: !!sessionId }
  );

  const pendingCount = allEvents.filter((e) => e.status === 'pending').length;

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-1.5 mb-3">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Party
        </span>
        {pendingCount > 0 && (
          <Badge className="ml-auto h-4 px-1.5 text-xs bg-amber-500 text-black">
            {pendingCount}
          </Badge>
        )}
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
        const sessionState = sessionStates.find((s) => s.characterId === char.id);
        const hp = char.hitPoints as { current: number; max: number; temp?: number } | null | undefined;
        const displayHp = sessionState
          ? { current: sessionState.currentHp, max: (hp as any)?.maximum ?? (hp as any)?.max ?? sessionState.currentHp }
          : hp;
        const conditions = (sessionState?.conditionsActive as string[]) ??
          (Array.isArray(cc.conditions) ? (cc.conditions as string[]) : []);

        return (
          <PartyMemberCard
            key={cc.id ?? char.id}
            name={char.name}
            characterClass={char.class}
            race={char.race}
            level={char.level}
            portraitUrl={char.portraitUrl}
            hitPoints={displayHp}
            armorClass={char.armorClass}
            conditions={conditions}
          />
        );
      })}

      <InitiativeTracker
        characterNames={(query.data ?? []).map((cc: any) => (cc.character ?? cc).name)}
      />
    </div>
  );
}
