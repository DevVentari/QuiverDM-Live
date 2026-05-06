'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserMinus } from 'lucide-react';

const roleLabels: Record<string, string> = {
  OWNER: 'Owner',
  CO_DM: 'Co-DM',
  PLAYER: 'Player',
  SPECTATOR: 'Spectator',
};

interface MemberDetailPanelProps {
  member: any;
  isDM: boolean;
  isOwner: boolean;
  isUpdating: boolean;
  isRemoving: boolean;
  onRoleChange: (role: string) => void;
  onRemove: () => void;
}

export function MemberDetailPanel({
  member,
  isDM,
  isOwner,
  isUpdating,
  isRemoving,
  onRoleChange,
  onRemove,
}: MemberDetailPanelProps) {
  const user = member.user || {};
  const initials = (user.name || user.email || '?')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6">
      <div className="flex flex-col items-center text-center mb-8">
        <Avatar className="h-20 w-20 mb-4">
          <AvatarImage src={user.image || undefined} />
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <h2 className="font-display text-xl font-bold text-amber-50">{user.name || user.email}</h2>
        {user.name && user.email && (
          <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
        )}
        <div className="mt-3">
          {member.role === 'OWNER' ? (
            <Badge>Owner</Badge>
          ) : (
            <Badge variant="secondary">{roleLabels[member.role] || member.role}</Badge>
          )}
        </div>
      </div>

      {isDM && member.role !== 'OWNER' && (
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-100/45 mb-2">Role</p>
            <Select value={member.role} disabled={isUpdating} onValueChange={onRoleChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isOwner && <SelectItem value="CO_DM">Co-DM</SelectItem>}
                <SelectItem value="PLAYER">Player</SelectItem>
                <SelectItem value="SPECTATOR">Spectator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4 border-t border-white/[0.08]">
            <Button
              variant="outline"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={isRemoving}
              onClick={onRemove}
            >
              <UserMinus className="h-4 w-4 mr-2" />
              Remove from Campaign
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
