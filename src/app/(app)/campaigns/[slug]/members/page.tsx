'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { useCampaignPageSlot } from '@/hooks/use-campaign-page-slot';
import { PageLayout } from '@/components/layout/page-layout';
import { MemberDetailPanel } from '@/components/members/member-detail-panel';
import { InviteDialog } from '@/components/campaign/invite-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const roleLabels: Record<string, string> = {
  OWNER: 'Owner',
  CO_DM: 'Co-DM',
  PLAYER: 'Player',
  SPECTATOR: 'Spectator',
};

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-220px)] animate-pulse bg-white/5" />}>
      <MembersPageInner />
    </Suspense>
  );
}

function MembersPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { campaignId, isOwner, isDM } = useCampaign();
  const { toast } = useToast();

  const members = trpc.members.getAll.useQuery({ campaignId }, { staleTime: 120_000 });
  const utils = trpc.useUtils();

  const memberList = (members.data || []) as any[];
  const memberCount = memberList.length;
  const dmCount     = memberList.filter((m) => m.role === 'OWNER' || m.role === 'CO_DM').length;
  const playerCount = memberList.filter((m) => m.role === 'PLAYER').length;

  useCampaignPageSlot('Members', [
    { label: memberCount === 1 ? 'member' : 'members', value: memberCount },
  ]);

  const selectedId = searchParams.get('member');

  function setSelectedMember(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('member', id);
    else params.delete('member');
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  const selectedMember = memberList.find((m) => m.id === selectedId) ?? null;

  const updateRole = trpc.members.updateRole.useMutation({
    onSuccess: () => {
      utils.members.getAll.invalidate({ campaignId });
      toast({ title: 'Role updated' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeMember = trpc.members.remove.useMutation({
    onSuccess: () => {
      utils.members.getAll.invalidate({ campaignId });
      setSelectedMember(null);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  if (members.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    );
  }

  if (members.isError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">Failed to load data</p>
          <p className="text-sm text-muted-foreground">{members.error?.message || 'An unexpected error occurred'}</p>
          <Button variant="outline" onClick={() => members.refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  const heroStats = [
    { label: memberCount === 1 ? 'member' : 'members', value: memberCount },
  ];
  const rolesSubtitle = memberCount > 0
    ? `${dmCount} DM${dmCount !== 1 ? 's' : ''} · ${playerCount} player${playerCount !== 1 ? 's' : ''}`
    : undefined;

  return (
    <PageLayout
      overline="Campaign"
      title="Party"
      subtitle={rolesSubtitle}
      stats={heroStats}
      actions={isDM ? <InviteDialog /> : undefined}
    >
      {/* Mobile list */}
      <div className="md:hidden space-y-2">
        {memberList.map((member: any) => {
          const user = member.user || {};
          const initials = (user.name || user.email || '?')
            .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
          return (
            <div className="stone-card" key={member.id}>
              <div className="stone-card-body flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-3">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-muted-foreground">
                  {roleLabels[member.role] || member.role}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop master-detail */}
      <div className="hidden md:grid h-[calc(100vh-220px)] overflow-hidden border-t border-[hsl(35,35%,18%)] -mx-8 grid-cols-[280px_1fr]">
        {/* Left: list */}
        <div className="flex flex-col overflow-hidden border-r border-[hsl(35,35%,18%)]">
          <div className="px-3 py-2.5 shrink-0 border-b border-[hsl(35,35%,18%)] flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.18em] text-amber-100/45">
              Party ({memberCount})
            </span>
            {isDM && <InviteDialog />}
          </div>

          <div className="flex-1 overflow-y-auto">
            {memberList.map((member: any) => {
              const user = member.user || {};
              const initials = (user.name || user.email || '?')
                .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
              const isSelected = selectedId === member.id;

              return (
                <button
                  key={member.id}
                  onClick={() => setSelectedMember(isSelected ? null : member.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-[hsl(35,35%,18%)] transition-colors hover:bg-white/[0.03] flex items-center gap-3 ${
                    isSelected ? 'bg-amber-500/[0.06] border-l-2 border-l-amber-500/50' : ''
                  }`}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium">{user.name || user.email}</p>
                    <p className="text-[10px] text-muted-foreground">{roleLabels[member.role] || member.role}</p>
                  </div>
                  {(member.role === 'OWNER' || member.role === 'CO_DM') && (
                    <span className="shrink-0 text-[10px] text-amber-400/60 font-medium">DM</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        <div className="overflow-hidden">
          {selectedMember ? (
            <MemberDetailPanel
              member={selectedMember}
              isDM={isDM}
              isOwner={isOwner}
              isUpdating={updateRole.isPending}
              isRemoving={removeMember.isPending}
              onRoleChange={(role) => updateRole.mutate({ campaignId, memberId: selectedMember.id, role: role as any })}
              onRemove={() => removeMember.mutate({ campaignId, memberId: selectedMember.id })}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4 bg-[hsl(240,10%,11%)]">
                <Users className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Select a member to view</p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                {memberCount > 0
                  ? `${memberCount} member${memberCount !== 1 ? 's' : ''} in this campaign`
                  : 'No members yet'}
              </p>
              {isDM && (
                <div className="mt-4">
                  <InviteDialog />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
