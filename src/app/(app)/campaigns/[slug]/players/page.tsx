'use client';

import { Suspense } from 'react';
import Image from 'next/image';
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

function CharacterCard({
  cc,
  isDM,
  campaignId,
  onApprove,
  onReject,
  onStatusChange,
  onRemove,
}: {
  cc: any;
  isDM: boolean;
  campaignId: string;
  onApprove: () => void;
  onReject: () => void;
  onStatusChange: (status: CharacterStatusValue) => void;
  onRemove: () => void;
}) {
  const char = cc.character || cc;
  const player = cc.character?.user;

  return (
    <div className="stone-card overflow-hidden min-h-[120px]">
      <div className="flex h-full min-h-[120px]">
        <div className="relative w-[28%] shrink-0 self-stretch">
          {char.portraitUrl ? (
            <Image
              src={char.portraitUrl}
              alt={char.name}
              fill
              className="object-cover object-top"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-[hsl(240,10%,8%)] via-[hsl(240,8%,6%)] to-[hsl(35,15%,5%)] flex items-center justify-center">
              <Users className="h-7 w-7 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[hsl(240,10%,11%)] to-transparent pointer-events-none" />
        </div>

        <div className="flex-1 min-w-0 px-4 py-3 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <span className="stone-card-title leading-snug">{char.name}</span>
            <Badge
              variant={cc.status === 'ACTIVE' ? 'default' : 'secondary'}
              className="text-xs shrink-0"
            >
              {cc.status}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground leading-snug">
            {[char.race, char.class, char.level && `Level ${char.level}`]
              .filter(Boolean)
              .join(' · ') || 'No details'}
          </p>

          {player && (
            <p className="text-xs text-muted-foreground/60">
              {player.displayName || player.name}
            </p>
          )}

          {isDM && (
            <div className="flex items-center gap-2 mt-auto pt-2">
              {cc.status === 'PENDING' ? (
                <>
                  <Button size="sm" onClick={onApprove}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={onReject}>
                    Reject
                  </Button>
                </>
              ) : (
                <>
                  <Select
                    value={cc.status}
                    onValueChange={(v: CharacterStatusValue) => onStatusChange(v)}
                  >
                    <SelectTrigger className="h-7 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onRemove}>
                    Remove
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayersPageInner() {
  const { campaignId, isDM } = useCampaign();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAddOpen = searchParams.get('add') === 'true';

  const characters = trpc.characters.getCampaignCharacters.useQuery(
    { campaignId },
    { staleTime: 120_000 }
  );
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
          <Skeleton key={i} className="h-[120px] rounded-lg" />
        ))}
      </div>
    );
  }

  const chars = (characters.data || []) as any[];
  const pending = chars.filter((cc) => cc.status === 'PENDING');
  const active = chars.filter((cc) => cc.status !== 'PENDING');

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
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg sm:text-xl font-semibold">Pending Approval</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((cc) => (
                  <CharacterCard
                    key={cc.id}
                    cc={cc}
                    isDM={isDM}
                    campaignId={campaignId}
                    onApprove={() => approve.mutate({ campaignId, campaignCharacterId: cc.id })}
                    onReject={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                    onStatusChange={(status) =>
                      updateStatus.mutate({ campaignId, campaignCharacterId: cc.id, status: status as any })
                    }
                    onRemove={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold">Party</h2>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active characters yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((cc) => (
                  <CharacterCard
                    key={cc.id}
                    cc={cc}
                    isDM={isDM}
                    campaignId={campaignId}
                    onApprove={() => approve.mutate({ campaignId, campaignCharacterId: cc.id })}
                    onReject={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                    onStatusChange={(status) =>
                      updateStatus.mutate({ campaignId, campaignCharacterId: cc.id, status: status as any })
                    }
                    onRemove={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                  />
                ))}
              </div>
            )}
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
