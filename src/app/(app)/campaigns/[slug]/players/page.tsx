'use client';

import { Suspense, useState, useEffect } from 'react';
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
import { Users, Plus, Link2, RefreshCw, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CharacterAddSheet } from '@/components/character/CharacterAddSheet';
import { usePinnedItems } from '@/store/pinned-items-store';
import { Card } from '@/components/primitives';
import { PartyMemberCard, type PartyMemberStatus } from '@/components/character/party-member-card';

// ── Page header ───────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="mb-6">
      <p className="label-overline mb-1">Campaign</p>
      <div className="section-rule" />
      <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">Party</h1>
    </div>
  );
}

// ── Section sub-heading ───────────────────────────────────────────────────────

function SectionHeading({
  children,
  count,
  alert,
}: {
  children: React.ReactNode;
  count?: number;
  alert?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-lg sm:text-xl font-[var(--q-font-display)] tracking-wide text-[var(--q-text)]">
        {children}
      </h2>
      {count !== undefined && (
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
            alert
              ? 'bg-[var(--q-amber-trace)] border-[var(--q-amber-border)] text-[var(--q-amber)]'
              : 'bg-[var(--q-surface-utility)] border-[var(--q-border-subtle)] text-[var(--q-text-faint)]'
          }`}
        >
          {count}
        </span>
      )}
    </div>
  );
}

// ── Inner page ────────────────────────────────────────────────────────────────

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
    },
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

  const ddbUrl = trpc.campaigns.getDdbCampaignUrl.useQuery({ campaignId }, { enabled: isDM });

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

  useCampaignPageSlot('Party', [
    { label: active.length === 1 ? 'character' : 'characters', value: active.length },
    ...(pending.length > 0 ? [{ label: 'pending', value: pending.length, alert: true }] : []),
  ]);

  function handleView(cc: any) {
    openCharacterSheet({
      id: cc.character?.id ?? cc.id,
      entityType: 'npc',
      name: (cc.character?.name ?? cc.name) || 'Character',
      iconUrl: cc.character?.portraitUrl ?? cc.portraitUrl ?? undefined,
      order: 0,
    });
  }

  if (characters.isLoading) {
    return (
      <div className="space-y-6 px-4 sm:px-6 lg:px-8">
        <PageHeader />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-sm" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      <PageHeader />

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
        <Card
          variant="detail"
          className="flex flex-col items-center justify-center py-16 text-center border-dashed"
        >
          <div className="w-14 h-14 rounded-full bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-[var(--q-text-faint)]" />
          </div>
          <h3 className="font-[var(--q-font-display)] text-base text-[var(--q-text)] mb-1">
            No characters in this campaign yet
          </h3>
          <p className="text-sm text-[var(--q-text-dim)] mb-5 max-w-xs">
            Characters appear here once they&apos;re added or imported from D&amp;D Beyond.
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
              <SectionHeading count={pending.length} alert>
                Pending Approval
              </SectionHeading>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((cc) => (
                  <PartyMemberCard
                    key={cc.id}
                    cc={cc}
                    isDM={isDM}
                    onApprove={() => approve.mutate({ campaignId, campaignCharacterId: cc.id })}
                    onReject={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                    onStatusChange={(status) =>
                      updateStatus.mutate({
                        campaignId,
                        campaignCharacterId: cc.id,
                        status: status as any,
                      })
                    }
                    onRemove={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                    onView={() => handleView(cc)}
                    style={{ borderStyle: 'dashed', borderColor: 'var(--q-amber-border)' }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <SectionHeading count={active.length}>Party</SectionHeading>
            {active.length === 0 ? (
              <p className="text-sm text-[var(--q-text-dim)]">No active characters yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((cc) => (
                  <PartyMemberCard
                    key={cc.id}
                    cc={cc}
                    isDM={isDM}
                    onApprove={() => approve.mutate({ campaignId, campaignCharacterId: cc.id })}
                    onReject={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                    onStatusChange={(status) =>
                      updateStatus.mutate({
                        campaignId,
                        campaignCharacterId: cc.id,
                        status: status as any,
                      })
                    }
                    onRemove={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                    onView={() => handleView(cc)}
                  />
                ))}
              </div>
            )}
          </div>

          {retired.length > 0 && (
            <div className="space-y-3">
              <SectionHeading count={retired.length}>Retired</SectionHeading>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
                {retired.map((cc) => (
                  <PartyMemberCard
                    key={cc.id}
                    cc={cc}
                    isDM={isDM}
                    onApprove={() => approve.mutate({ campaignId, campaignCharacterId: cc.id })}
                    onReject={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                    onStatusChange={(status) =>
                      updateStatus.mutate({
                        campaignId,
                        campaignCharacterId: cc.id,
                        status: status as any,
                      })
                    }
                    onRemove={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                    onView={() => handleView(cc)}
                  />
                ))}
              </div>
            </div>
          )}

          {deceased.length > 0 && (
            <div className="space-y-3">
              <SectionHeading count={deceased.length}>Deceased</SectionHeading>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
                {deceased.map((cc) => (
                  <PartyMemberCard
                    key={cc.id}
                    cc={cc}
                    isDM={isDM}
                    onApprove={() => approve.mutate({ campaignId, campaignCharacterId: cc.id })}
                    onReject={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                    onStatusChange={(status) =>
                      updateStatus.mutate({
                        campaignId,
                        campaignCharacterId: cc.id,
                        status: status as any,
                      })
                    }
                    onRemove={() => removeCharacter.mutate({ campaignCharacterId: cc.id })}
                    onView={() => handleView(cc)}
                    style={{ borderColor: 'var(--q-accent-danger-border)' }}
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
