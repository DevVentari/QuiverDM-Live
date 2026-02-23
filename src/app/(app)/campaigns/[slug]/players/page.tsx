'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const STATUS_OPTIONS = ['ACTIVE', 'RETIRED', 'DECEASED', 'REMOVED'] as const;
type CharacterStatusValue = (typeof STATUS_OPTIONS)[number] | 'PENDING';

export default function PlayersPage() {
  const { campaignId, isDM } = useCampaign();
  const { toast } = useToast();
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

  if (chars.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border">
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <h3 className="font-semibold text-base mb-1">No players in this campaign yet</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs">
            Players appear here once they join this campaign with an invite code.
          </p>
          <Button asChild size="sm">
            <Link href="/characters/new">Create Character</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
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
                <Card key={cc.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{char.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">PENDING</Badge>
                    </div>
                    <CardDescription>
                      {[char.race, char.class, char.level && `Level ${char.level}`].filter(Boolean).join(' · ')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {player && <p className="text-xs text-muted-foreground">Player: {player.displayName || player.name}</p>}
                    {isDM && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            approve.mutate({
                              campaignId,
                              campaignCharacterId: cc.id,
                            })
                          }
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
                  </CardContent>
                </Card>
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
              <Card key={cc.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{char.name}</CardTitle>
                    <Badge variant={cc.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                      {cc.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {[char.race, char.class, char.level && `Level ${char.level}`].filter(Boolean).join(' · ')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

