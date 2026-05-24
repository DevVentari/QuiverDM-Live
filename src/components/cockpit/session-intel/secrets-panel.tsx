'use client';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface SecretsPanelProps {
  campaignId: string;
  sessionId: string;
}

export function SecretsPanel({ campaignId, sessionId }: SecretsPanelProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const secretsQuery = trpc.prepSecrets.list.useQuery({ campaignId, sessionId });
  const triggerSync = trpc.sessions.triggerRevelationSync.useMutation();

  const logRevelation = trpc.prepSecrets.logRevelation.useMutation({
    onSuccess: (data, variables) => {
      utils.prepSecrets.list.invalidate({ campaignId, sessionId });
      void triggerSync.mutate({
        campaignId,
        sessionId,
        revelationId: data.id,
        prepSecretId: variables.prepSecretId,
      });
    },
    onError: () => {
      toast({ title: 'Failed to mark secret revealed', variant: 'destructive' });
    },
  });

  if (secretsQuery.isLoading) {
    return <div className="p-3 text-xs text-muted-foreground">Loading secrets...</div>;
  }

  const secrets = secretsQuery.data ?? [];

  if (secrets.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No secrets assigned to this session.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {secrets.map((secret) => {
        const isCritical = secret.knowledge.some((k) => k.isCritical);
        const npcNames = secret.knowledge.map((k) => k.worldEntity.name).join(', ');

        return (
          <div
            key={secret.id}
            className={cn(
              'rounded-md border border-border/40 bg-card/40 p-2.5 space-y-1.5',
              isCritical && !secret.isRevealed && 'border-amber-500/50',
              secret.isRevealed && 'opacity-50'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <p className={cn('text-xs font-medium', secret.isRevealed && 'line-through')}>{secret.name}</p>
                {npcNames && (
                  <p className="text-[10px] text-muted-foreground">{npcNames}</p>
                )}
                {secret.isRevealed && secret.revelations.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Revealed {new Date(secret.revelations[0].revealedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {secret.revelations[0].revealedBy ? ` by ${secret.revelations[0].revealedBy}` : ''}
                  </p>
                )}
              </div>
              {!secret.isRevealed && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 shrink-0"
                  disabled={logRevelation.isPending}
                  onClick={() =>
                    logRevelation.mutate({ campaignId, prepSecretId: secret.id, sessionId })
                  }
                >
                  Reveal
                </Button>
              )}
            </div>
            {secret.content && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">{secret.content}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
