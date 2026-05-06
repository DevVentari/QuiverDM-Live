'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserMinus } from 'lucide-react';

interface MemberDetailPanelProps {
  member: {
    id: string;
    role: string;
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  };
  isOwner: boolean;
  isDM: boolean;
  onRoleChange: (memberId: string, role: string) => void;
  onRemove: (memberId: string) => void;
  isPending: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER:     'Owner',
  CO_DM:     'Co-DM',
  PLAYER:    'Player',
  SPECTATOR: 'Spectator',
};

export function MemberDetailPanel({ member, isOwner, isDM, onRoleChange, onRemove, isPending }: MemberDetailPanelProps) {
  const user     = member.user;
  const initials = (user.name || user.email || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarImage src={user.image || undefined} />
            <AvatarFallback className="text-base font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-foreground truncate">
              {user.name || user.email}
            </p>
            {user.name && user.email && (
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            )}
            <Badge variant="secondary" className="mt-1.5 text-xs">
              {ROLE_LABELS[member.role] || member.role}
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 flex-1">
        {isDM && member.role !== 'OWNER' && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 mb-2">Role</p>
            <Select
              value={member.role}
              disabled={isPending}
              onValueChange={(role) => onRoleChange(member.id, role)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isOwner && <SelectItem value="CO_DM">Co-DM</SelectItem>}
                <SelectItem value="PLAYER">Player</SelectItem>
                <SelectItem value="SPECTATOR">Spectator</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isDM && member.role !== 'OWNER' && (
          <div className="pt-4 border-t border-border/40">
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive gap-2"
              disabled={isPending}
              onClick={() => onRemove(member.id)}
            >
              <UserMinus className="h-4 w-4" />
              Remove from campaign
            </Button>
          </div>
        )}

        {member.role === 'OWNER' && (
          <p className="text-xs text-muted-foreground/50 italic">Campaign owner — role cannot be changed.</p>
        )}
      </div>
    </div>
  );
}
