'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { PlatformRole } from '@prisma/client';
import { PLATFORM_ROLE_LABELS, PLAN_LABELS } from '@/lib/platform';
import { RoleBadge } from '@/components/ui/role-badge';
import { PlanBadge } from '@/components/ui/plan-badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { MoreHorizontal, Search, UserCog, Ban, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [roleDialogUser, setRoleDialogUser] = useState<{ id: string; name: string | null; role: PlatformRole } | null>(null);
  const [selectedRole, setSelectedRole] = useState<PlatformRole>(PlatformRole.ADVENTURER);

  const users = trpc.adminUsers.list.useQuery({
    search: search || undefined,
    role: roleFilter !== 'all' ? (roleFilter as PlatformRole) : undefined,
    tier: tierFilter !== 'all' ? tierFilter : undefined,
  }, { refetchInterval: 30_000 });

  const changeRole = trpc.adminUsers.changeRole.useMutation({
    onSuccess: () => {
      toast({ title: 'Role updated' });
      users.refetch();
      setRoleDialogUser(null);
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const suspend = trpc.adminUsers.suspend.useMutation({
    onSuccess: (_, vars) => {
      toast({ title: vars.suspended ? 'User suspended' : 'User unsuspended' });
      users.refetch();
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const forcePasswordReset = trpc.adminUsers.forcePasswordReset.useMutation({
    onSuccess: () => {
      toast({ title: 'Password reset email sent' });
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Manage platform users, roles, and access</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {Object.entries(PLATFORM_ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {Object.entries(PLAN_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border/50 bg-card/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Campaigns</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data?.users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {(user.displayName ?? user.name ?? '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium">{user.displayName ?? user.name ?? 'Unnamed'}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><RoleBadge role={user.platformRole} /></TableCell>
                <TableCell><PlanBadge tier={user.tier} /></TableCell>
                <TableCell className="text-muted-foreground">
                  {user._count.campaigns} owned / {user._count.campaignMemberships} member
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setRoleDialogUser({ id: user.id, name: user.displayName ?? user.name, role: user.platformRole });
                        setSelectedRole(user.platformRole);
                      }}>
                        <UserCog className="h-4 w-4 mr-2" />
                        Change Role
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => forcePasswordReset.mutate({ userId: user.id })}>
                        <KeyRound className="h-4 w-4 mr-2" />
                        Force Password Reset
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => suspend.mutate({ userId: user.id, suspended: !user.suspended })}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        {user.suspended ? 'Unsuspend' : 'Suspend'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!roleDialogUser} onOpenChange={(open) => !open && setRoleDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role — {roleDialogUser?.name ?? 'User'}</DialogTitle>
            <DialogDescription>
              Current role: {roleDialogUser ? PLATFORM_ROLE_LABELS[roleDialogUser.role] : ''}
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as PlatformRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PLATFORM_ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogUser(null)}>Cancel</Button>
            <Button
              onClick={() => roleDialogUser && changeRole.mutate({ userId: roleDialogUser.id, newRole: selectedRole })}
              disabled={changeRole.isPending}
            >
              {changeRole.isPending ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
