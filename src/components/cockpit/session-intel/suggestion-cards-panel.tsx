'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';

interface SuggestionCardsPanelProps {
  campaignId: string;
  sessionId: string;
  inPlayIds: Set<string>;
}

export function SuggestionCardsPanel({ campaignId, sessionId, inPlayIds }: SuggestionCardsPanelProps) {
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const profilesQuery = trpc.npcBehaviorProfiles.listBySession.useQuery({ campaignId, sessionId });
  const secretsQuery = trpc.prepSecrets.list.useQuery({ campaignId, sessionId });

  const triggerSync = trpc.sessions.triggerRevelationSync.useMutation({
    onError: (err) => console.error('[SuggestionCardsPanel] revelation sync failed', err.message),
  });

  const logRevelation = trpc.prepSecrets.logRevelation.useMutation({
    onSuccess: async (data) => {
      setRevealingId(null);
      await utils.prepSecrets.list.invalidate({ campaignId, sessionId });
      void triggerSync.mutate({
        campaignId,
        sessionId,
        revelationId: data.id,
        prepSecretId: data.prepSecretId,
      });
    },
    onError: () => setRevealingId(null),
  });

  if (!inPlayIds.size) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Mark NPCs in play to see suggestions.
      </div>
    );
  }

  if (profilesQuery.isLoading || secretsQuery.isLoading) {
    return <div className="p-3 text-xs text-muted-foreground">Loading...</div>;
  }

  const profiles = (profilesQuery.data ?? []).filter(p => inPlayIds.has(p.worldEntityId));
  const secrets = secretsQuery.data ?? [];

  if (!profiles.length) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No behavior profiles for the active NPCs.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {profiles.map(profile => {
        const linkedSecrets = secrets.filter(
          s => !s.isRevealed && s.knowledge.some(k => k.worldEntityId === profile.worldEntityId)
        );

        return (
          <div key={profile.id} className="space-y-1.5 border border-border rounded-sm p-2">
            <p className="text-xs font-semibold truncate">
              {profile.worldEntity?.name ?? profile.worldEntityId}
            </p>
            {profile.defaultBehavior && (
              <p className="text-[11px] text-muted-foreground italic">{profile.defaultBehavior}</p>
            )}
            {linkedSecrets.length > 0 && (
              <div className="space-y-1">
                {linkedSecrets.map(secret => (
                  <div key={secret.id} className="flex items-start justify-between gap-1">
                    <p className="text-[11px] text-amber-400/80 flex-1 min-w-0 truncate">
                      {secret.name}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-5 text-[10px] px-1.5 shrink-0"
                      disabled={revealingId === secret.id}
                      onClick={() => {
                        setRevealingId(secret.id);
                        logRevelation.mutate({
                          campaignId,
                          prepSecretId: secret.id,
                          sessionId,
                        });
                      }}
                    >
                      Reveal
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
