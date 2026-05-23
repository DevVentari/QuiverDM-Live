'use client';

import { Suspense, useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { useCampaignPageSlot } from '@/hooks/use-campaign-page-slot';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Plus, Link2, RefreshCw, X, Loader2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CharacterAddSheet } from '@/components/character/CharacterAddSheet';
import { usePinnedItems } from '@/store/pinned-items-store';
import { Card, Surface } from '@/components/primitives';
import { EntityPlaceholder } from '@/components/primitives/entity-placeholder';

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
  onView,
  cardStyle,
}: {
  cc: any;
  isDM: boolean;
  campaignId: string;
  onApprove: () => void;
  onReject: () => void;
  onStatusChange: (status: CharacterStatusValue) => void;
  onRemove: () => void;
  onView: () => void;
  cardStyle?: React.CSSProperties;
}) {
  const char = cc.character || cc;
  const player = cc.character?.user;

  return (
    <Surface variant="utility" className="overflow-hidden min-h-[120px]" style={cardStyle}>
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
            <EntityPlaceholder type="pc" size={28} />
          )}
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--q-surface-utility)] to-transparent pointer-events-none" />
        </div>

        <div className="flex-1 min-w-0 px-4 py-3 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <span className="font-[var(--q-font-display)] text-sm tracking-wide text-[var(--q-text)] leading-snug">{char.name}</span>
            <button
              onClick={onView}
              className="shrink-0 text-[var(--q-text-faint)] hover:text-[var(--q-amber)] transition-colors mt-0.5"
              title="View character sheet"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-xs text-[var(--q-text-dim)] leading-snug">
            {[char.race, char.class, char.level && `Level ${char.level}`]
              .filter(Boolean)
              .join(' · ') || 'No details'}
          </p>

          {player && (
            <p className="text-xs text-[var(--q-text-faint)]">
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
    </Surface>
  );
}

function PlayersPageInner() {
  const { campaignId, isDM } = useCampaign();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAddOpen = searchParams.get('add') === 'true';
  const isDdbImporting = searchParams.get('ddb-importing') === 'true';
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const { openSheet: openCharacterSheet } = usePinnedItems();

  const characters = trpc.characters.getCampaignCharacters.useQuery(
    { campaignId },
    {
      staleTime: isDdbImporting ? 0 : 120_000,
      refetchInterval: isDdbImporting ? 3_000 : false,
    }
  );
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!isDdbImporting) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('ddb-importing');
      const qs = params.toString();
      router.replace(qs ? '?' + qs : '?');
    }, 180_000);
    return () => clearTimeout(timer);
  }, [isDdbImporting]);

  useEffect(() => {
    if (!isDdbImporting || !characters.data?.length) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('ddb-importing');
    const qs = params.toString();
    router.replace(qs ? '?' + qs : '?');
  }, [isDdbImporting, characters.data?.length]);

  const ddbUrl = trpc.campaigns.getDdbCampaignUrl.useQuery(
    { campaignId },
    { enabled: isDM }
  );

  const setDdbUrl = trpc.campaigns.setDdbCampaignUrl.useMutation({
    onSuccess: () => {
      utils.campaigns.getDdbCampaignUrl.invalidate({ campaignId });
      setLinkDialogOpen(false);
      setLinkUrl('');
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const syncDdb = trpc.charactersDndBeyond.importFromCampaign.useMutation({
    onSuccess: (data) => {
      utils.characters.getCampaignCharacters.invalidate({ campaignId });
      toast({
        title: 'Synced',
        description: `${data.imported} imported, ${data.failed} already up to date`,
      });
    },
    onError: (error) => {
      const msg = error.message.includes('Cobalt')
        ? 'D&D Beyond session not configured — add your CobaltSession in Settings → API Keys.'
        : error.message;
      toast({ title: 'Sync failed', description: msg, variant: 'destructive' });
    },
  });

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

  const chars = (characters.data || []) as any[];
  const pending = chars.filter((cc) => cc.status === 'PENDING');
  const active = chars.filter((cc) => cc.status === 'ACTIVE');
  const retired = chars.filter((cc) => cc.status === 'RETIRED');
  const deceased = chars.filter((cc) => cc.status === 'DECEASED');

  useCampaignPageSlot('Characters', [
    { label: active.length === 1 ? 'character' : 'characters', value: active.length },
    ...(pending.length > 0 ? [{ label: 'pending', value: pending.length, alert: true }] : []),
  ]);

  if (characters.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[120px] rounded-sm" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="label-overline mb-1">Campaign</p>
        <div className="section-rule" />
        <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
          Players
        </h1>
      </div>

      {isDdbImporting && (
        <div className="flex items-center gap-3 rounded-sm border border-[var(--q-amber-border)] bg-[var(--q-amber-trace)] px-4 py-3 text-sm text-[var(--q-amber)]">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Syncing characters from D&amp;D Beyond — this may take a moment</span>
        </div>
      )}

      {isDM && (
        <div className="flex justify-end items-center gap-2">
          {ddbUrl.data?.url ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-[var(--q-amber-border)] text-[var(--q-amber)] hover:bg-[var(--q-amber-trace)]"
                onClick={() => syncDdb.mutate({ campaignUrl: ddbUrl.data.url!, campaignId })}
                disabled={syncDdb.isPending || isDdbImporting}
              >
                {syncDdb.isPending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                )}
                Sync DDB
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-[var(--q-text-dim)] hover:text-[var(--q-text)]"
                onClick={() => setDdbUrl.mutate({ campaignId, url: null })}
                title="Unlink D&D Beyond"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="border-[var(--q-border-subtle)] text-[var(--q-text-dim)] hover:text-[var(--q-text)]"
              onClick={() => setLinkDialogOpen(true)}
            >
              <Link2 className="mr-2 h-3.5 w-3.5 text-[var(--q-amber)]" />
              Link D&amp;D Beyond
            </Button>
          )}
          <Button size="sm" onClick={() => router.push('?add=true')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Character
          </Button>
        </div>
      )}

      {chars.length === 0 ? (
        <Card variant="detail" className="flex flex-col items-center justify-center py-16 text-center border-dashed">
          <div className="w-14 h-14 rounded-full bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-[var(--q-text-faint)]" />
          </div>
          <h3 className="font-[var(--q-font-display)] text-base text-[var(--q-text)] mb-1">No players in this campaign yet</h3>
          <p className="text-sm text-[var(--q-text-dim)] mb-5 max-w-xs">
            Players appear here once they join this campaign with an invite code.
          </p>
          {isDM && (
            <Button size="sm" onClick={() => router.push('?add=true')}>
              Add Character
            </Button>
          )}
        </Card>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-[var(--q-font-display)] tracking-wide text-[var(--q-text)]">Pending Approval</h2>
                <span className="rounded-full bg-[var(--q-amber-trace)] border border-[var(--q-amber-border)] text-[var(--q-amber)] text-xs px-2 py-0.5 font-semibold">
                  {pending.length}
                </span>
              </div>
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
                    onView={() => openCharacterSheet({
                      id: cc.character?.id ?? cc.id,
                      entityType: 'npc',
                      name: (cc.character?.name ?? cc.name) || 'Character',
                      iconUrl: cc.character?.portraitUrl ?? cc.portraitUrl ?? undefined,
                      order: 0,
                    })}
                    cardStyle={{ borderStyle: 'dashed', borderColor: 'var(--q-amber-border)' }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-[var(--q-font-display)] tracking-wide text-[var(--q-text)]">Party</h2>
            {active.length === 0 ? (
              <p className="text-sm text-[var(--q-text-dim)]">No active characters yet.</p>
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
                    onView={() => openCharacterSheet({
                      id: cc.character?.id ?? cc.id,
                      entityType: 'npc',
                      name: (cc.character?.name ?? cc.name) || 'Character',
                      iconUrl: cc.character?.portraitUrl ?? cc.portraitUrl ?? undefined,
                      order: 0,
                    })}
                  />
                ))}
              </div>
            )}
          </div>

          {retired.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg sm:text-xl font-[var(--q-font-display)] tracking-wide text-[var(--q-text-dim)]">Retired</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-[0.65]">
                {retired.map((cc) => (
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
                    onView={() => openCharacterSheet({
                      id: cc.character?.id ?? cc.id,
                      entityType: 'npc',
                      name: (cc.character?.name ?? cc.name) || 'Character',
                      iconUrl: cc.character?.portraitUrl ?? cc.portraitUrl ?? undefined,
                      order: 0,
                    })}
                  />
                ))}
              </div>
            </div>
          )}

          {deceased.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg sm:text-xl font-[var(--q-font-display)] tracking-wide text-[var(--q-text-dim)]">Deceased</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-[0.65]">
                {deceased.map((cc) => (
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
                    onView={() => openCharacterSheet({
                      id: cc.character?.id ?? cc.id,
                      entityType: 'npc',
                      name: (cc.character?.name ?? cc.name) || 'Character',
                      iconUrl: cc.character?.portraitUrl ?? cc.portraitUrl ?? undefined,
                      order: 0,
                    })}
                    cardStyle={{
                      background: 'linear-gradient(180deg, oklch(0.18 0.04 25 / 0.4), oklch(0.14 0.03 25 / 0.6))',
                      borderColor: 'oklch(0.35 0.06 25 / 0.4)',
                    }}
                  />
                ))}
              </div>
            </div>
          )}
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

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link D&amp;D Beyond Campaign</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://www.dndbeyond.com/campaigns/…"
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setDdbUrl.mutate({ campaignId, url: linkUrl || null })}
              disabled={!linkUrl || setDdbUrl.isPending}
            >
              {setDdbUrl.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
