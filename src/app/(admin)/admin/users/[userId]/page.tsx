'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PlatformRole } from '@prisma/client';
import { ArrowLeft, Ban, KeyRound, RefreshCw, Shield, UserCog } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { PLAN_LABELS, PLATFORM_ROLE_LABELS } from '@/lib/platform';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlanBadge } from '@/components/ui/plan-badge';
import { RoleBadge } from '@/components/ui/role-badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

function formatCost(cost: number): string {
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default function AdminUserDetailPage({
  params,
}: {
  params: { userId: string };
}) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<PlatformRole>(PlatformRole.ADVENTURER);
  const [selectedTier, setSelectedTier] = useState<PlanValue>('alpha');
  const [roleOpen, setRoleOpen] = useState(false);
  const [tierOpen, setTierOpen] = useState(false);

  const detail = trpc.adminUsers.getDetail.useQuery(
    { userId: params.userId },
    { refetchInterval: 30_000 },
  );

  useEffect(() => {
    if (!detail.data) return;
    setSelectedRole(detail.data.user.platformRole);
    setSelectedTier(
      (PLAN_VALUES.includes(detail.data.user.tier as PlanValue)
        ? detail.data.user.tier
        : 'alpha') as PlanValue,
    );
  }, [detail.data]);

  const utils = trpc.useUtils();

  const changeRole = trpc.adminUsers.changeRole.useMutation({
    onSuccess: () => {
      toast({ title: 'Role updated' });
      void utils.adminUsers.getDetail.invalidate({ userId: params.userId });
      setRoleOpen(false);
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const changeTier = trpc.adminUsers.changeTier.useMutation({
    onSuccess: () => {
      toast({ title: 'Plan updated' });
      void utils.adminUsers.getDetail.invalidate({ userId: params.userId });
      setTierOpen(false);
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const suspend = trpc.adminUsers.suspend.useMutation({
    onSuccess: () => {
      toast({ title: 'Access updated' });
      void utils.adminUsers.getDetail.invalidate({ userId: params.userId });
    },
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const forcePasswordReset = trpc.adminUsers.forcePasswordReset.useMutation({
    onSuccess: () => toast({ title: 'Password reset email sent' }),
    onError: (err) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const user = detail.data?.user;
  const apiSummary = detail.data?.apiSummary;

  const providerBadges = useMemo(
    () => detail.data?.authProviders.map((provider) => provider.toUpperCase()) ?? [],
    [detail.data?.authProviders],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/users"
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to users
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {user?.displayName ?? user?.name ?? user?.email ?? 'User Detail'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Database-backed account inspection, role authority, usage counters, and recent platform activity.
          </p>
          {detail.isError && (
            <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Failed to load user details.{' '}
              <button onClick={() => void detail.refetch()} className="underline">
                Retry
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRoleOpen(true)} disabled={!user}>
            <UserCog className="mr-2 h-4 w-4" />
            Change Role
          </Button>
          <Button variant="outline" onClick={() => setTierOpen(true)} disabled={!user}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Change Plan
          </Button>
          <Button variant="outline" onClick={() => forcePasswordReset.mutate({ userId: params.userId })} disabled={!user}>
            <KeyRound className="mr-2 h-4 w-4" />
            Password Reset
          </Button>
          <Button
            variant={user?.suspended ? 'secondary' : 'destructive'}
            onClick={() => user && suspend.mutate({ userId: user.id, suspended: !user.suspended })}
            disabled={!user}
          >
            <Ban className="mr-2 h-4 w-4" />
            {user?.suspended ? 'Restore Access' : 'Suspend Access'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {detail.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-7 w-20" />
              </CardHeader>
              <CardContent><Skeleton className="h-3 w-32" /></CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription>Platform Role</CardDescription>
                <CardTitle className="text-xl">{user ? PLATFORM_ROLE_LABELS[user.platformRole] : '—'}</CardTitle>
              </CardHeader>
              <CardContent>{user && <RoleBadge role={user.platformRole} />}</CardContent>
            </Card>
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription>Plan</CardDescription>
                <CardTitle className="text-xl">{user ? PLAN_LABELS[user.tier] ?? user.tier : '—'}</CardTitle>
              </CardHeader>
              <CardContent>{user && <PlanBadge tier={user.tier} />}</CardContent>
            </Card>
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription>API Cost</CardDescription>
                <CardTitle className="text-xl">{formatCost(apiSummary?.estimatedCost ?? 0)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {(apiSummary?.requestCount ?? 0).toLocaleString()} requests across {(apiSummary?.logCount ?? 0).toLocaleString()} logs.
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription>Account State</CardDescription>
                <CardTitle className="text-xl">{user?.suspended ? 'Suspended' : 'Active'}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Subscription: {user?.subscriptionStatus ?? 'None'}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle>Account Record</CardTitle>
            <CardDescription>Core identity and auth surfaces.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border border-border/50 bg-background/40 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Email</p>
                  <p className="mt-1 text-foreground">{user?.email ?? 'None'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Display Name</p>
                  <p className="mt-1 text-foreground">{user?.displayName ?? 'None'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Joined</p>
                  <p className="mt-1 text-foreground">{formatDate(user?.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Updated</p>
                  <p className="mt-1 text-foreground">{formatDate(user?.updatedAt)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Subscription Ends</p>
                  <p className="mt-1 text-foreground">{formatDate(user?.subscriptionEndsAt)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Onboarding</p>
                  <p className="mt-1 text-foreground">{user?.onboardingCompleted ? 'Completed' : 'Not completed'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <Shield className="h-4 w-4 text-primary" />
                Authentication
              </div>
              <div className="flex flex-wrap gap-2">
                {providerBadges.length > 0 ? (
                  providerBadges.map((provider) => (
                    <Badge key={provider} variant="outline">
                      {provider}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary">No linked auth providers</Badge>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-background/40 p-4">
              <div className="mb-3 text-sm font-medium text-foreground">Stored API Keys</div>
              <div className="grid gap-2 md:grid-cols-2">
                {detail.data?.apiKeys.map((key) => (
                  <div key={key.name} className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                    <span className="text-muted-foreground">{key.label}</span>
                    <Badge variant={key.present ? 'secondary' : 'outline'}>
                      {key.present ? 'Present' : 'Missing'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader>
            <CardTitle>Usage And Activity</CardTitle>
            <CardDescription>Usage counters, owned campaigns, and recent model calls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Campaigns Owned</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{detail.data?.usage.campaignsOwned ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">PDF Uploads</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {detail.data?.usage.pdfUploads ?? 0} / {detail.data?.usage.pdfUploadLimit ?? -1}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">AI Recaps</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {detail.data?.usage.aiRecaps ?? 0} / {detail.data?.usage.aiRecapLimit ?? -1}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Owned Campaigns</p>
                <Link href="/admin/api-usage" className="text-sm text-primary transition-colors hover:text-primary/80">
                  Global usage tracker
                </Link>
              </div>
              <div className="space-y-3">
                {detail.data?.ownedCampaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-lg border border-border/50 bg-background/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">{campaign.slug}</p>
                      </div>
                      <Badge variant="secondary">{campaign.status}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {campaign._count.gameSessions} sessions · updated {formatDate(campaign.updatedAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-foreground">Recent API Logs</p>
              <div className="rounded-lg border border-border/50 bg-background/40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Feature</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.data?.recentApiUsage.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</TableCell>
                        <TableCell className="capitalize">{log.provider}</TableCell>
                        <TableCell>{log.feature}</TableCell>
                        <TableCell className="text-right text-primary">{formatCost(log.estimatedCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Current role: {user ? PLATFORM_ROLE_LABELS[user.platformRole] : ''}
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
            <Button variant="outline" onClick={() => setRoleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => changeRole.mutate({ userId: params.userId, newRole: selectedRole })}
              disabled={changeRole.isPending}
            >
              {changeRole.isPending ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tierOpen} onOpenChange={setTierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Plan</DialogTitle>
            <DialogDescription>
              Current plan: {user ? PLAN_LABELS[user.tier] ?? user.tier : ''}
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
            <Button variant="outline" onClick={() => setTierOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => changeTier.mutate({ userId: params.userId, tier: selectedTier })}
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
