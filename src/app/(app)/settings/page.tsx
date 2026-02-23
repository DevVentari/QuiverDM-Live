'use client';

import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Trash2, Save, Ticket, ExternalLink, Clock, FileText, Map, ArrowUpRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';

const keyConfigs = [
  {
    name: 'openaiApiKey' as const,
    label: 'OpenAI API Key',
    placeholder: 'sk-...',
    hasField: 'hasOpenaiApiKey' as const,
    maskedField: 'maskedOpenaiApiKey' as const,
  },
  {
    name: 'anthropicApiKey' as const,
    label: 'Anthropic API Key',
    placeholder: 'sk-ant-...',
    hasField: 'hasAnthropicApiKey' as const,
    maskedField: 'maskedAnthropicApiKey' as const,
  },
  {
    name: 'huggingfaceToken' as const,
    label: 'Hugging Face Token',
    placeholder: 'hf_...',
    hasField: 'hasHuggingfaceToken' as const,
    maskedField: 'maskedHuggingfaceToken' as const,
  },
  {
    name: 'dndBeyondCobaltCookie' as const,
    label: 'D&D Beyond Cobalt Cookie',
    placeholder: 'Cobalt session cookie',
    hasField: 'hasDndBeyondCobaltCookie' as const,
    maskedField: 'maskedDndBeyondCobaltCookie' as const,
  },
];

/**
 * Format seconds into a human-readable duration string.
 * Examples: "0 min", "45 min", "1 hr 30 min", "10 hr"
 */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0 min';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

/**
 * Returns the indicator color class based on usage percentage.
 * Normal: default foreground
 * Warning (>80%): amber/orange
 * Critical (>=100%): red
 */
function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'bg-red-500';
  if (percentage > 80) return 'bg-amber-500';
  return '';
}

/**
 * Returns the text color class based on usage percentage.
 */
function getTextColor(percentage: number): string {
  if (percentage >= 100) return 'text-red-500';
  if (percentage > 80) return 'text-amber-500';
  return 'text-muted-foreground';
}

/**
 * Format tier name for display.
 */
function formatTier(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Get badge variant based on tier.
 */
function getTierBadgeVariant(tier: string): 'default' | 'secondary' | 'outline' {
  switch (tier) {
    case 'pro': return 'default';
    case 'team': return 'default';
    default: return 'secondary';
  }
}

function getSubscriptionBadgeVariant(
  status: string | null | undefined
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'past_due':
      return 'destructive';
    case 'canceling':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getSubscriptionLabel(status: string | null | undefined): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'past_due':
      return 'Past Due';
    case 'canceling':
      return 'Canceling';
    case 'canceled':
      return 'Canceled';
    default:
      return 'None';
  }
}

export default function SettingsPage() {
  const { toast } = useToast();
  const profile = trpc.userSettings.getProfile.useQuery(undefined, { staleTime: 300_000 });
  const settings = trpc.userSettings.getSettings.useQuery(undefined, { staleTime: 300_000 });
  const usage = trpc.usage.getStatus.useQuery(undefined, { staleTime: 300_000 });
  const billingStatus = trpc.billing.getStatus.useQuery(undefined, { staleTime: 300_000 });
  const billingPlans = trpc.billing.getPlans.useQuery(undefined, { staleTime: 300_000 });
  const utils = trpc.useUtils();

  const updateProfile = trpc.userSettings.updateProfile.useMutation({
    onSuccess: () => {
      toast({ title: 'Profile updated' });
      utils.userSettings.getProfile.invalidate();
    },
    onError: (error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const changePassword = trpc.userSettings.changePassword.useMutation({
    onSuccess: () => {
      toast({ title: 'Password changed' });
      setPasswordForm({ current: '', next: '', confirm: '' });
    },
    onError: (error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const deleteAccount = trpc.userSettings.deleteAccount.useMutation({
    onSuccess: async () => {
      await signOut({ callbackUrl: '/auth/signin' });
    },
    onError: (error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const updateKeys = trpc.userSettings.updateApiKeys.useMutation({
    onSuccess: () => utils.userSettings.getSettings.invalidate(),
  });

  const deleteKey = trpc.userSettings.deleteApiKey.useMutation({
    onSuccess: () => utils.userSettings.getSettings.invalidate(),
  });

  const createCheckout = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast({
        title: 'Checkout failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createPortal = trpc.billing.createPortal.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast({
        title: 'Portal failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const cancelSubscription = trpc.billing.cancel.useMutation({
    onSuccess: async () => {
      toast({
        title: 'Subscription updated',
        description: 'Your subscription will cancel at period end.',
      });
      await billingStatus.refetch();
    },
    onError: (error) => {
      toast({
        title: 'Cancellation failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [editing, setEditing] = useState<Record<string, string>>({});
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', displayName: '', bio: '' });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (profile.data && !profileLoaded) {
      setProfileForm({
        name: profile.data.name || '',
        displayName: profile.data.displayName || '',
        bio: profile.data.bio || '',
      });
      setProfileLoaded(true);
    }
  }, [profile.data, profileLoaded]);

  function handleStartCheckout(priceId: string | null | undefined) {
    if (!priceId) {
      toast({
        title: 'Plan unavailable',
        description: 'Stripe price ID is not configured.',
        variant: 'destructive',
      });
      return;
    }

    createCheckout.mutate({ priceId });
  }

  function handleCancelSubscription() {
    setCancelDialogOpen(true);
  }

  if (settings.isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const data = (settings.data || {}) as any;

  function handleSave(keyName: string) {
    updateKeys.mutate({ [keyName]: editing[keyName] });
    setEditing((prev) => {
      const next = { ...prev };
      delete next[keyName];
      return next;
    });
  }

  return (
    <div className="max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8">
      <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>

      {/* Usage & Limits Section */}
      {usage.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      ) : usage.data ? (
        <>
          {/* Current Plan Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Usage &amp; Limits</CardTitle>
                  <CardDescription>
                    Your current plan and resource usage
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={getTierBadgeVariant(usage.data.tier)}>
                    {formatTier(usage.data.tier)} Plan
                  </Badge>
                  {usage.data.tier === 'free' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartCheckout(billingPlans.data?.pro.priceId)}
                      disabled={createCheckout.isPending}
                    >
                      {createCheckout.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 mr-1" />
                      )}
                      Upgrade to Pro
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Subscription Status */}
              {billingStatus.data && (
                <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-muted-foreground">Subscription:</span>
                    <Badge variant={getSubscriptionBadgeVariant(billingStatus.data.subscriptionStatus)}>
                      {getSubscriptionLabel(billingStatus.data.subscriptionStatus)}
                    </Badge>
                    {billingStatus.data.currentPeriodEnd && (
                      <span className="text-muted-foreground">
                        Period ends {new Date(billingStatus.data.currentPeriodEnd).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {billingStatus.data.subscriptionStatus === 'past_due' && (
                    <p className="mt-2 text-destructive">
                      Payment is past due. Open billing portal to update your payment method.
                    </p>
                  )}

                  {billingStatus.data.subscriptionStatus === 'canceling' && (
                    <p className="mt-2 text-muted-foreground">
                      Your subscription will remain active until the period end date.
                    </p>
                  )}
                </div>
              )}

              {/* Billing Actions */}
              <div className="flex flex-wrap gap-2">
                {usage.data.tier === 'free' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartCheckout(billingPlans.data?.team.priceId)}
                    disabled={createCheckout.isPending}
                  >
                    Upgrade to Team ({billingPlans.data?.team.displayPrice ?? '$19/mo'})
                  </Button>
                )}

                {usage.data.tier === 'pro' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartCheckout(billingPlans.data?.team.priceId)}
                    disabled={createCheckout.isPending}
                  >
                    Upgrade to Team ({billingPlans.data?.team.displayPrice ?? '$19/mo'})
                  </Button>
                )}

                {billingStatus.data?.hasSubscription && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createPortal.mutate()}
                    disabled={createPortal.isPending}
                  >
                    {createPortal.isPending && (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    )}
                    Manage Subscription
                  </Button>
                )}

                {billingStatus.data?.hasSubscription && billingStatus.data.subscriptionStatus !== 'canceling' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleCancelSubscription}
                    disabled={cancelSubscription.isPending}
                  >
                    {cancelSubscription.isPending && (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    )}
                    Cancel Subscription
                  </Button>
                )}
              </div>

              {/* Usage Meters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Campaigns Meter */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Map className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Campaigns</span>
                  </div>
                  {usage.data.campaigns.limit === -1 ? (
                    <>
                      <Progress value={0} className="h-2" aria-label="Campaign usage" />
                      <p className="text-sm text-muted-foreground">
                        {usage.data.campaigns.used} used — Unlimited
                      </p>
                    </>
                  ) : (
                    <>
                      <Progress
                        value={Math.min(usage.data.campaigns.percentage, 100)}
                        className="h-2"
                        indicatorClassName={getProgressColor(usage.data.campaigns.percentage)}
                        aria-label="Campaign usage"
                      />
                      <p className={`text-sm ${getTextColor(usage.data.campaigns.percentage)}`}>
                        {usage.data.campaigns.used} of {usage.data.campaigns.limit} used
                      </p>
                    </>
                  )}
                </div>

                {/* Transcription Meter */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Transcription</span>
                  </div>
                  {usage.data.transcription.limit === -1 ? (
                    <>
                      <Progress value={0} className="h-2" aria-label="Transcription usage" />
                      <p className="text-sm text-muted-foreground">
                        {formatDuration(usage.data.transcription.used)} used — Unlimited
                      </p>
                    </>
                  ) : (
                    <>
                      <Progress
                        value={Math.min(usage.data.transcription.percentage, 100)}
                        className="h-2"
                        indicatorClassName={getProgressColor(usage.data.transcription.percentage)}
                        aria-label="Transcription usage"
                      />
                      <p className={`text-sm ${getTextColor(usage.data.transcription.percentage)}`}>
                        {formatDuration(usage.data.transcription.used)} of {formatDuration(usage.data.transcription.limit)} used
                      </p>
                    </>
                  )}
                </div>

                {/* PDF Uploads Meter */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">PDF Uploads</span>
                  </div>
                  {usage.data.pdfUploads.limit === -1 ? (
                    <>
                      <Progress value={0} className="h-2" aria-label="PDF upload usage" />
                      <p className="text-sm text-muted-foreground">
                        {usage.data.pdfUploads.used} used — Unlimited
                      </p>
                    </>
                  ) : (
                    <>
                      <Progress
                        value={Math.min(usage.data.pdfUploads.percentage, 100)}
                        className="h-2"
                        indicatorClassName={getProgressColor(usage.data.pdfUploads.percentage)}
                        aria-label="PDF upload usage"
                      />
                      <p className={`text-sm ${getTextColor(usage.data.pdfUploads.percentage)}`}>
                        {usage.data.pdfUploads.used} of {usage.data.pdfUploads.limit} used
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Billing Period */}
              <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                <span>
                  Billing period: {new Date(usage.data.periodStart).toLocaleDateString()} — {new Date(usage.data.periodEnd).toLocaleDateString()}
                </span>
                <span className="mx-2">|</span>
                <span>
                  Resets on {new Date(usage.data.periodEnd).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      ) : usage.isError ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">Failed to load usage data. Please try refreshing the page.</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your public display information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Name</Label>
                  <Input
                    id="profile-name"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-displayname">Display Name</Label>
                  <Input
                    id="profile-displayname"
                    value={profileForm.displayName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="Shown to other players"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-bio">Bio</Label>
                <Textarea
                  id="profile-bio"
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell other players about yourself..."
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">{profileForm.bio.length}/500</p>
              </div>
              <Button
                size="sm"
                onClick={() => updateProfile.mutate(profileForm)}
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Profile
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {passwordError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="pw-current">Current password</Label>
            <Input
              id="pw-current"
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pw-new">New password</Label>
              <Input
                id="pw-new"
                type="password"
                value={passwordForm.next}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, next: e.target.value }))}
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">Confirm new password</Label>
              <Input
                id="pw-confirm"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                minLength={8}
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setPasswordError('');
              if (passwordForm.next !== passwordForm.confirm) {
                setPasswordError('Passwords do not match.');
                return;
              }
              if (passwordForm.next.length < 8) {
                setPasswordError('New password must be at least 8 characters.');
                return;
              }
              changePassword.mutate({ currentPassword: passwordForm.current, newPassword: passwordForm.next });
            }}
            disabled={changePassword.isPending || !passwordForm.current || !passwordForm.next}
          >
            {changePassword.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Change Password
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Configure API keys for AI extraction and integrations.
            Keys are encrypted at rest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {keyConfigs.map((config) => {
            const hasKey = data[config.hasField];
            const masked = data[config.maskedField];
            const isEditing = config.name in editing;

            return (
              <div key={config.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{config.label}</Label>
                  {hasKey && (
                    <Badge variant="secondary" className="text-xs">
                      Configured
                    </Badge>
                  )}
                </div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder={config.placeholder}
                      value={editing[config.name]}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [config.name]: e.target.value }))
                      }
                      className="font-mono text-xs"
                    />
                    <Button size="sm" onClick={() => handleSave(config.name)}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditing((prev) => {
                          const next = { ...prev };
                          delete next[config.name];
                          return next;
                        })
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {hasKey ? (
                      <>
                        <Input
                          type="text"
                          value={masked || '••••••••'}
                          disabled
                          className="font-mono text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditing((prev) => ({ ...prev, [config.name]: '' }))
                          }
                          aria-label={`Show/hide ${config.label}`}
                        >
                          Change
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteKey.mutate({ keyName: config.name })}
                          aria-label={`Delete ${config.label}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditing((prev) => ({ ...prev, [config.name]: '' }))
                        }
                      >
                        Add Key
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>
            Administrative tools and settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
            <div className="flex items-center gap-3">
              <Ticket className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">Beta Invite Codes</div>
                <div className="text-sm text-muted-foreground">
                  Generate and manage closed beta invite codes
                </div>
              </div>
            </div>
            <Link href="/admin/invites">
              <Button variant="outline" size="sm">
                Manage
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your account and all campaign data. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleteAccount.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete My Account
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Subscription"
        description="Cancel your subscription at the end of the current billing period?"
        confirmLabel="Cancel Subscription"
        variant="destructive"
        onConfirm={() => {
          cancelSubscription.mutate();
          setCancelDialogOpen(false);
        }}
        loading={cancelSubscription.isPending}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Account"
        description="This will permanently delete your account, all your campaigns, characters, NPCs, and session data. This action cannot be undone."
        confirmLabel="Delete My Account"
        variant="destructive"
        onConfirm={() => {
          deleteAccount.mutate();
          setDeleteDialogOpen(false);
        }}
        loading={deleteAccount.isPending}
      />
    </div>
  );
}
