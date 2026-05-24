'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PlatformRole } from '@prisma/client';
import { Ban, Eye, KeyRound, MoreHorizontal, Search, UserCog } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { PLAN_LABELS, PLATFORM_ROLE_LABELS } from '@/lib/platform';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { PlanBadge } from '@/components/ui/plan-badge';
import { RoleBadge } from '@/components/ui/role-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PLAN_VALUES = ['free', 'pro', 'team', 'alpha'] as const;
type PlanValue = (typeof PLAN_VALUES)[number];

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [roleDialogUser, setRoleDialogUser] = useState<{
    id: string;
    name: string | null;
    role: PlatformRole;
  } | null>(null);
  const [tierDialogUser, setTierDialogUser] = useState<{
    id: string;
    name: string | null;
    tier: PlanValue;
  } | null>(null);
  const [selectedRole, setSelectedRole] = useState<PlatformRole>(PlatformRole.ADVENTURER);
  const [selectedTier, setSelectedTier] = useState<PlanValue>('alpha');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const usersQuery = trpc.adminUsers.list.useInfiniteQuery(
    {
      search: search || undefined,
      role: roleFilter !== 'all' ? (roleFilter as PlatformRole) : undefined,
      tier: tierFilter !== 'all' ? tierFilter : undefined,
      limit: 50,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchInterval: 30_000,
    },
  );

  const allUsers = usersQuery.data?.pages.flatMap((p) => p.users) ?? [];

  const changeRole = trpc.adminUsers.changeRole.useMutation({
    onSuccess: () => {
      toast({ title: 'Role updated' });
      void usersQuery.refetch();
      setRoleDialogUser(null);
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const changeTier = trpc.adminUsers.changeTier.useMutation({
    onSuccess: () => {
      toast({ title: 'Plan updated' });
      void usersQuery.refetch();
      setTierDialogUser(null);
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const suspend = trpc.adminUsers.suspend.useMutation({
    onSuccess: (_, vars) => {
      toast({ title: vars.suspended ? 'User suspended' : 'User unsuspended' });
      void usersQuery.refetch();
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const forcePasswordReset = trpc.adminUsers.forcePasswordReset.useMutation({
    onSuccess: () => {
      toast({ title: 'Password reset email sent' });
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const bulkChangeRole = trpc.adminUsers.bulkChangeRole.useMutation({
    onSuccess: (result) => {
      toast({ title: `Role updated for ${result.updated} user(s)` });
      void usersQuery.refetch();
      setSelectedIds(new Set());
      setRoleDialogUser(null);
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const bulkChangeTier = trpc.adminUsers.bulkChangeTier.useMutation({
    onSuccess: (result) => {
      toast({ title: `Plan updated for ${result.updated} user(s)` });
      void usersQuery.refetch();
      setSelectedIds(new Set());
      setTierDialogUser(null);
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const bulkSuspend = trpc.adminUsers.bulkSuspend.useMutation({
    onSuccess: (result) => {
      toast({ title: `${result.updated} user(s) updated` });
      void usersQuery.refetch();
      setSelectedIds(new Set());
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="stone-card">
        <div className="stone-card-header">
          <div>
            <span className="stone-card-title">Account Control</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Users</h1>
            <p className="mt-2 text-sm text-[var(--q-text-dim)]">
              Full admin access to platform accounts: inspect profiles, change roles, adjust plans, suspend access,
              and force password resets.
            </p>
          </div>
        </div>
      </div>

      {usersQuery.isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-[var(--q-text-danger)]">
          Failed to load users.{' '}
          <button onClick={() => void usersQuery.refetch()} className="underline">
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--q-text-dim)]" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedIds(new Set()); }}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setSelectedIds(new Set()); }}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {Object.entries(PLATFORM_ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setSelectedIds(new Set()); }}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="All plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {Object.entries(PLAN_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} selected
          </span>
          <button
            className="text-sm text-[var(--q-text-dim)] underline"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v as PlatformRole)}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Set role…" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLATFORM_ROLE_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                bulkChangeRole.mutate({ userIds: Array.from(selectedIds), newRole: selectedRole })
              }
              disabled={bulkChangeRole.isPending}
            >
              Apply Role
            </Button>

            <Select
              value={selectedTier}
              onValueChange={(v) => setSelectedTier(v as PlanValue)}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue placeholder="Set plan…" />
              </SelectTrigger>
              <SelectContent>
                {PLAN_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>{PLAN_LABELS[v] ?? v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                bulkChangeTier.mutate({ userIds: Array.from(selectedIds), tier: selectedTier })
              }
              disabled={bulkChangeTier.isPending}
            >
              Apply Plan
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                bulkSuspend.mutate({ userIds: Array.from(selectedIds), suspended: true })
              }
              disabled={bulkSuspend.isPending}
            >
              Suspend
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                bulkSuspend.mutate({ userIds: Array.from(selectedIds), suspended: false })
              }
              disabled={bulkSuspend.isPending}
            >
              Unsuspend
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--q-border)] bg-[var(--q-surface-inset)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px]">
                <Checkbox
                  checked={allUsers.length > 0 && selectedIds.size === allUsers.length}
                  onCheckedChange={(checked) =>
                    setSelectedIds(checked ? new Set(allUsers.map((u) => u.id)) : new Set())
                  }
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Campaigns</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              : allUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(user.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          if (checked) next.add(user.id); else next.delete(user.id);
                          setSelectedIds(next);
                        }}
                        aria-label={`Select ${user.displayName ?? user.name ?? user.id}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          <img src={user.image} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {(user.displayName ?? user.name ?? '?')[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-foreground">{user.displayName ?? user.name ?? 'Unnamed'}</div>
                          <div className="text-sm text-[var(--q-text-dim)]">{user.email ?? 'No email'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={user.platformRole} />
                    </TableCell>
                    <TableCell>
                      <PlanBadge tier={user.tier} />
                    </TableCell>
                    <TableCell className="text-sm text-[var(--q-text-dim)]">
                      {user.suspended ? 'Suspended' : user.subscriptionStatus ?? 'No subscription'}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--q-text-dim)]">
                      {user._count.campaigns} owned / {user._count.campaignMemberships} member
                    </TableCell>
                    <TableCell className="text-sm text-[var(--q-text-dim)]">
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
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/users/${user.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRoleDialogUser({
                                id: user.id,
                                name: user.displayName ?? user.name,
                                role: user.platformRole,
                              });
                              setSelectedRole(user.platformRole);
                            }}
                          >
                            <UserCog className="mr-2 h-4 w-4" />
                            Change Role
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setTierDialogUser({
                                id: user.id,
                                name: user.displayName ?? user.name,
                                tier: user.tier as PlanValue,
                              });
                              setSelectedTier((PLAN_VALUES.includes(user.tier as PlanValue) ? user.tier : 'alpha') as PlanValue);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Change Plan
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => forcePasswordReset.mutate({ userId: user.id })}>
                            <KeyRound className="mr-2 h-4 w-4" />
                            Force Password Reset
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-[var(--q-text-danger)]"
                            onClick={() => suspend.mutate({ userId: user.id, suspended: !user.suspended })}
                          >
                            <Ban className="mr-2 h-4 w-4" />
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

      {usersQuery.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => void usersQuery.fetchNextPage()}
            disabled={usersQuery.isFetchingNextPage}
          >
            {usersQuery.isFetchingNextPage ? 'Loading…' : `Load more (${allUsers.length} shown)`}
          </Button>
        </div>
      )}

      <Dialog open={!!roleDialogUser} onOpenChange={(open) => !open && setRoleDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role - {roleDialogUser?.name ?? 'User'}</DialogTitle>
            <DialogDescription>
              Current role: {roleDialogUser ? PLATFORM_ROLE_LABELS[roleDialogUser.role] : ''}
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as PlatformRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PLATFORM_ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                roleDialogUser &&
                changeRole.mutate({ userId: roleDialogUser.id, newRole: selectedRole })
              }
              disabled={changeRole.isPending}
            >
              {changeRole.isPending ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tierDialogUser} onOpenChange={(open) => !open && setTierDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan - {tierDialogUser?.name ?? 'User'}</DialogTitle>
            <DialogDescription>
              Current plan: {tierDialogUser ? PLAN_LABELS[tierDialogUser.tier] ?? tierDialogUser.tier : ''}
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedTier} onValueChange={(value) => setSelectedTier(value as PlanValue)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {PLAN_LABELS[value] ?? value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTierDialogUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                tierDialogUser &&
                changeTier.mutate({ userId: tierDialogUser.id, tier: selectedTier })
              }
              disabled={changeTier.isPending}
            >
              {changeTier.isPending ? 'Updating...' : 'Update Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
