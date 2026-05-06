'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { useCampaignPageSlot } from '@/hooks/use-campaign-page-slot';
import { PageLayout } from '@/components/layout/page-layout';
import { InviteDialog } from '@/components/campaign/invite-dialog';
import { MemberDetailPanel } from '@/components/members/member-detail-panel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, UserMinus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  OWNER:     'Owner',
  CO_DM:     'Co-DM',
  PLAYER:    'Player',
  SPECTATOR: 'Spectator',
};

export default function MembersPage() {
  const { campaignId, isOwner, isDM } = useCampaign();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const members = trpc.members.getAll.useQuery({ campaignId }, { staleTime: 120_000 });
  const utils   = trpc.useUtils();

  const updateRole = trpc.members.updateRole.useMutation({
    onSuccess: () => { utils.members.getAll.invalidate({ campaignId }); toast({ title: 'Role updated' }); },
    onError:   (e) => { toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });

  const removeMember = trpc.members.remove.useMutation({
    onSuccess: () => { utils.members.getAll.invalidate({ campaignId }); setSelectedId(null); },
    onError:   (e) => { toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberList = (members.data || []) as any[];
  const memberCount = memberList.length;
  const dmCount     = memberList.filter((m) => m.role === 'OWNER' || m.role === 'CO_DM').length;
  const playerCount = memberList.filter((m) => m.role === 'PLAYER' || m.role === 'SPECTATOR').length;

  useCampaignPageSlot('Members', [
    { label: memberCount === 1 ? 'member' : 'members', value: memberCount },
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedMember = memberList.find((m: any) => m.id === selectedId) ?? null;

  function selectMember(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  const inviteAction = isDM ? <InviteDialog /> : undefined;

  if (members.isLoading) {
    return (
      <PageLayout overline="Members" title="Members" actions={inviteAction}>
        <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      overline="Members"
      title="Members"
      stats={[
        { label: 'Total',   value: memberCount },
        ...(dmCount   > 0 ? [{ label: 'DMs',     value: dmCount   }] : []),
        ...(playerCount > 0 ? [{ label: 'Players', value: playerCount }] : []),
      ]}
      actions={inviteAction}
    >
      {/* ── Mobile layout ── */}
      <div className="md:hidden space-y-2">
        {memberList.map((member) => {
          const user     = member.user || {};
          const initials = (user.name || user.email || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
          return (
            <div className="stone-card" key={member.id}>
              <div className="stone-card-body flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {member.role === 'OWNER' ? (
                    <Badge>Owner</Badge>
                  ) : isDM ? (
                    <Select value={member.role} disabled={updateRole.isPending}
                      onValueChange={(role) => updateRole.mutate({ campaignId, memberId: member.id, role: role as any })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {isOwner && <SelectItem value="CO_DM">Co-DM</SelectItem>}
                        <SelectItem value="PLAYER">Player</SelectItem>
                        <SelectItem value="SPECTATOR">Spectator</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">{ROLE_LABELS[member.role] || member.role}</Badge>
                  )}
                  {isDM && member.role !== 'OWNER' && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMember.mutate({ campaignId, memberId: member.id })}>
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop master-detail ── */}
      <div className="hidden md:grid h-[calc(100vh-220px)] overflow-hidden border-t border-[hsl(35,35%,18%)] -mx-8 grid-cols-[280px_1fr]">
        {/* Left: member list */}
        <div className="flex flex-col overflow-hidden border-r border-[hsl(35,35%,18%)]">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(35,35%,18%)] shrink-0">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
              Party ({memberCount})
            </span>
            {isDM && <InviteDialog />}
          </div>

          <div className="flex-1 overflow-y-auto">
            {memberList.map((member) => {
              const user     = member.user || {};
              const initials = (user.name || user.email || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
              const isSelected = selectedId === member.id;
              return (
                <button
                  key={member.id}
                  onClick={() => selectMember(member.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'bg-amber-500/[0.08] border-l-2 border-amber-500/50'
                      : 'border-l-2 border-transparent hover:bg-white/[0.04] hover:border-white/10'
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium truncate', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                      {user.name || user.email}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 truncate">{ROLE_LABELS[member.role] || member.role}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail panel or empty state */}
        <div className="overflow-hidden">
          {selectedMember ? (
            <MemberDetailPanel
              member={selectedMember}
              isOwner={isOwner}
              isDM={isDM}
              onRoleChange={(memberId, role) => updateRole.mutate({ campaignId, memberId, role: role as any })}
              onRemove={(memberId) => removeMember.mutate({ campaignId, memberId })}
              isPending={updateRole.isPending || removeMember.isPending}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4 bg-[hsl(240,10%,11%)]">
                <Users className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Select a member to manage</p>
              <p className="text-xs text-muted-foreground/50 mt-1">{memberCount} member{memberCount !== 1 ? 's' : ''} in this campaign</p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
