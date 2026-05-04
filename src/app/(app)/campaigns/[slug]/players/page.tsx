'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CharacterAddSheet } from '@/components/character/CharacterAddSheet';

const STATUS_OPTIONS = ['ACTIVE', 'RETIRED', 'DECEASED', 'REMOVED'] as const;
type CharacterStatusValue = (typeof STATUS_OPTIONS)[number] | 'PENDING';

function PlayersPageInner() {
  const { campaignId, isDM } = useCampaign();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAddOpen = searchParams.get('add') === 'true';

  const characters = trpc.characters.getCampaignCharacters.useQuery({ campaignId }, { staleTime: 120_000 });
  const utils = trpc.useUtils();

  const approve = trpc.characters.approveCharacter.useMutation({
    onSuccess: () => utils.characters.getCampaignCharacters.invalidate({ campaignId }),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateStatus = trpc.characters.updateCampaignStatus.useMutation({
    onSuccess: () => {
      utils.characters.getCampaignCharacters.invalidate({ campaignId });
      toast({ title: 'Status updated' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeCharacter = trpc.characters.removeFromCampaign.useMutation({
    onSuccess: () => utils.characters.getCampaignCharacters.invalidate({ campaignId }),
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  if (characters.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  const chars = (characters.data || []) as any[];
  const pending = chars.filter((cc) => cc.status === 'PENDING');
  const activeOrOther = chars.filter((cc) => cc.status !== 'PENDING');

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      {isDM && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => router.push('?add=true')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Character
          </Button>
        </div>
      )}

      {chars.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border">
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <h3 className="font-semibold text-base mb-1">No players in this campaign yet</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              Players appear here once they join this campaign with an invite code.
            </p>
            {isDM && (
              <Button size="sm" onClick={() => router.push('?add=true')}>
                Add Character
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold">Pending Characters</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending character requests.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((cc) => {
                  const char = cc.character || cc;
                  const player = cc.character?.user;
                  return (
                    <div className="stone-card" key={cc.id}>
                      <div className="stone-card-header pb-2">
                        <div className="flex items-center justify-between">
                          <span className="stone-card-title">{char.name}</span>
                          <Badge variant="secondary" className="text-xs">PENDING</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {[char.race, char.class, char.level && `Level ${char.level}`].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="stone-card-body space-y-2">
                        {player && <p className="text-xs text-muted-foreground">Player: {player.displayName || player.name}</p>}
                        {isDM && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => approve.mutate({ campaignId, campaignCharacterId: cc.id })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold">Party</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeOrOther.map((cc) => {
                const char = cc.character || cc;
                const player = cc.character?.user;
                return (
                  <div className="stone-card" key={cc.id}>
                    <div className="stone-card-header pb-2">
                      <div className="flex items-center justify-between">
                        <span className="stone-card-title">{char.name}</span>
                        <Badge variant={cc.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                          {cc.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[char.race, char.class, char.level && `Level ${char.level}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="stone-card-body space-y-2">
                      {player && <p className="text-xs text-muted-foreground">Player: {player.displayName || player.name}</p>}
                      {isDM && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={cc.status}
                            onValueChange={(status: CharacterStatusValue) =>
                              updateStatus.mutate({
                                campaignId,
                                campaignCharacterId: cc.id,
                                status: status as any,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {isDM && (
        <CharacterAddSheet
          campaignId={campaignId}
          open={isAddOpen}
          onOpenChange={(open) => {
            if (!open) router.replace('?');
          }}
        />
      )}
    </div>
  );
}

export default function PlayersPage() {
  return (
    <Suspense>
      <PlayersPageInner />
    </Suspense>
  );
}
