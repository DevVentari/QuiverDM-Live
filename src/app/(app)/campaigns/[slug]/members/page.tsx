'use client';

import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { InviteDialog } from '@/components/campaign/invite-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserMinus } from 'lucide-react';

const roleLabels: Record<string, string> = {
  OWNER: 'Owner',
  CO_DM: 'Co-DM',
  PLAYER: 'Player',
  SPECTATOR: 'Spectator',
};

export default function MembersPage() {
  const { campaignId, isOwner, isDM } = useCampaign();
  const members = trpc.members.getAll.useQuery({ campaignId });
  const utils = trpc.useUtils();

  const updateRole = trpc.members.updateRole.useMutation({
    onSuccess: () => utils.members.getAll.invalidate({ campaignId }),
  });

  const removeMember = trpc.members.remove.useMutation({
    onSuccess: () => utils.members.getAll.invalidate({ campaignId }),
  });

  if (members.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-semibold">Members</h2>
        {isDM && <InviteDialog />}
      </div>

      <div className="space-y-2">
        {(members.data || []).map((member: any) => {
          const user = member.user || {};
          const initials = (user.name || user.email || '?')
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <Card key={member.id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-3">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.name || user.email}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {member.role === 'OWNER' ? (
                    <Badge>Owner</Badge>
                  ) : isDM ? (
                    <Select
                      value={member.role}
                      onValueChange={(role) =>
                        updateRole.mutate({
                          campaignId,
                          memberId: member.id,
                          role: role as any,
                        })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {isOwner && <SelectItem value="CO_DM">Co-DM</SelectItem>}
                        <SelectItem value="PLAYER">Player</SelectItem>
                        <SelectItem value="SPECTATOR">Spectator</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="secondary">
                      {roleLabels[member.role] || member.role}
                    </Badge>
                  )}
                  {isDM && member.role !== 'OWNER' && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        removeMember.mutate({ campaignId, memberId: member.id })
                      }
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
