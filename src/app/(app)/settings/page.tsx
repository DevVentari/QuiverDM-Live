'use client';

import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Trash2, Save, Ticket, ExternalLink, FileText, Map, ArrowUpRight, Loader2, Upload, Sparkles, Search, Image as ImageIcon, Zap, MonitorPlay } from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { RoleBadge } from '@/components/ui/role-badge';
import { PlanBadge } from '@/components/ui/plan-badge';
import { PlatformRole } from '@prisma/client';
import { hasMinimumRole } from '@/lib/platform';

interface KeyConfig {
  name: 'geminiApiKey' | 'openaiApiKey' | 'anthropicApiKey' | 'huggingfaceToken' | 'dndBeyondCobaltCookie';
  label: string;
  placeholder: string;
  hasField: 'hasGeminiApiKey' | 'hasOpenaiApiKey' | 'hasAnthropicApiKey' | 'hasHuggingfaceToken' | 'hasDndBeyondCobaltCookie';
  maskedField: 'maskedGeminiApiKey' | 'maskedOpenaiApiKey' | 'maskedAnthropicApiKey' | 'maskedHuggingfaceToken' | 'maskedDndBeyondCobaltCookie';
  description?: string;
  badge?: string;
}

const keyConfigs: KeyConfig[] = [
  {
    name: 'geminiApiKey' as const,
    label: 'Google Gemini API Key',
    placeholder: 'AIza...',
    hasField: 'hasGeminiApiKey' as const,
    maskedField: 'maskedGeminiApiKey' as const,
    description: 'Recommended for new users — 1,000 free requests/day. Powers homebrew AI extraction.',
    badge: 'Free tier',
  },
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

  const updatePreferences = trpc.userSettings.updatePreferences.useMutation({
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
      <div className="max-w-4xl space-y-4">
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
    <div className="max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
      <h1 className="text-xl sm:text-2xl font-display font-bold tracking-wide">Settings</h1>

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
          <div className="stone-card">
            <div className="stone-card-header">
              <div className="flex items-center justify-between">
                <div>
                  <span className="stone-card-title">Usage &amp; Limits</span>
                  <p className="text-sm text-muted-foreground">
                    Your current plan and resource usage
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <PlanBadge tier={usage.data.tier} />
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
                  {usage.data.tier === 'alpha' && (
                    <span className="text-xs text-amber-300/70">Alpha access</span>
                  )}
                </div>
              </div>
            </div>
            <div className="stone-card-body space-y-6">
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

                {(usage.data.tier === 'pro' || usage.data.tier === 'alpha') && (
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
                    <p className="text-sm text-muted-foreground">
                      {usage.data.campaigns.used} used — <span className="text-foreground/70">Unlimited</span>
                    </p>
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

                {/* PDF Uploads Meter */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">PDF Uploads</span>
                  </div>
                  {usage.data.pdfUploads.limit === -1 ? (
                    <p className="text-sm text-muted-foreground">
                      {usage.data.pdfUploads.used} used — <span className="text-foreground/70">Unlimited</span>
                    </p>
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

                {/* Session Uploads Meter */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Session Uploads</span>
                  </div>
                  {usage.data.sessionUploads.limit === -1 ? (
                    <p className="text-sm text-muted-foreground">
                      {usage.data.sessionUploads.used} used — <span className="text-foreground/70">Unlimited</span>
                    </p>
                  ) : (
                    <>
                      <Progress
                        value={Math.min(usage.data.sessionUploads.percentage, 100)}
                        className="h-2"
                        indicatorClassName={getProgressColor(usage.data.sessionUploads.percentage)}
                        aria-label="Session upload usage"
                      />
                      <p className={`text-sm ${getTextColor(usage.data.sessionUploads.percentage)}`}>
                        {usage.data.sessionUploads.used} of {usage.data.sessionUploads.limit} used
                      </p>
                    </>
                  )}
                </div>

                {/* AI Recaps Meter */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">AI Recaps</span>
                  </div>
                  {usage.data.aiRecaps.limit === -1 ? (
                    <p className="text-sm text-muted-foreground">
                      {usage.data.aiRecaps.used} used — <span className="text-foreground/70">Unlimited</span>
                    </p>
                  ) : (
                    <>
                      <Progress
                        value={Math.min(usage.data.aiRecaps.percentage, 100)}
                        className="h-2"
                        indicatorClassName={getProgressColor(usage.data.aiRecaps.percentage)}
                        aria-label="AI recap usage"
                      />
                      <p className={`text-sm ${getTextColor(usage.data.aiRecaps.percentage)}`}>
                        {usage.data.aiRecaps.used} of {usage.data.aiRecaps.limit} used
                      </p>
                    </>
                  )}
                </div>

                {/* Semantic Searches Meter */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Semantic Searches</span>
                  </div>
                  {usage.data.semanticSearches.limit === -1 ? (
                    <p className="text-sm text-muted-foreground">
                      {usage.data.semanticSearches.used} used — <span className="text-foreground/70">Unlimited</span>
                    </p>
                  ) : (
                    <>
                      <Progress
                        value={Math.min(usage.data.semanticSearches.percentage, 100)}
                        className="h-2"
                        indicatorClassName={getProgressColor(usage.data.semanticSearches.percentage)}
                        aria-label="Semantic search usage"
                      />
                      <p className={`text-sm ${getTextColor(usage.data.semanticSearches.percentage)}`}>
                        {usage.data.semanticSearches.used} of {usage.data.semanticSearches.limit} used
                      </p>
                    </>
                  )}
                </div>

                {/* Image Generations Meter */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Image Generations</span>
                  </div>
                  {usage.data.imageGenerations.limit === -1 ? (
                    <p className="text-sm text-muted-foreground">
                      {usage.data.imageGenerations.used} used — <span className="text-foreground/70">Unlimited</span>
                    </p>
                  ) : (
                    <>
                      <Progress
                        value={Math.min(usage.data.imageGenerations.percentage, 100)}
                        className="h-2"
                        indicatorClassName={getProgressColor(usage.data.imageGenerations.percentage)}
                        aria-label="Image generation usage"
                      />
                      <p className={`text-sm ${getTextColor(usage.data.imageGenerations.percentage)}`}>
                        {usage.data.imageGenerations.used} of {usage.data.imageGenerations.limit} used
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
                <span className="mx-2 text-muted-foreground/40">·</span>
                <span>
                  Resets on {new Date(usage.data.periodEnd).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </>
      ) : usage.isError ? (
        <div className="stone-card">
          <div className="stone-card-body py-6">
            <p className="text-sm text-destructive">Failed to load usage data. Please try refreshing the page.</p>
          </div>
        </div>
      ) : null}

      <div className="stone-card">
        <div className="stone-card-header">
          <div className="flex items-center gap-3">
            <span className="stone-card-title">Profile</span>
            {profile.data?.platformRole && (
              <RoleBadge role={profile.data.platformRole as PlatformRole} />
            )}
          </div>
          <p className="text-sm text-muted-foreground">Your public display information</p>
        </div>
        <div className="stone-card-body space-y-4">
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
        </div>
      </div>

      <div className="stone-card">
        <div className="stone-card-header">
          <span className="stone-card-title">Password</span>
          <p className="text-sm text-muted-foreground">Change your account password</p>
        </div>
        <div className="stone-card-body space-y-4">
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
        </div>
      </div>

      <div className="stone-card">
        <div className="stone-card-header">
          <div className="flex items-center justify-between">
            <div>
              <span className="stone-card-title">API Keys</span>
              <p className="text-sm text-muted-foreground">
                Configure API keys for AI extraction and integrations.
                Keys are encrypted at rest.
              </p>
            </div>
            <Link href="/settings/api-usage">
              <Button variant="outline" size="sm">
                <Zap className="h-4 w-4 mr-1" />
                View API Usage
              </Button>
            </Link>
          </div>
        </div>
        <div className="stone-card-body space-y-6">
          {keyConfigs.map((config) => {
            const hasKey = data[config.hasField];
            const masked = data[config.maskedField];
            const isEditing = config.name in editing;

            return (
              <div key={config.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{config.label}</Label>
                  <div className="flex items-center gap-2">
                    {config.badge && (
                      <Badge variant="secondary" className="text-xs text-emerald-400">
                        {config.badge}
                      </Badge>
                    )}
                    {hasKey && (
                      <Badge variant="secondary" className="text-xs">
                        Configured
                      </Badge>
                    )}
                  </div>
                </div>
                {config.description && !hasKey && (
                  <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                )}
                {isEditing ? (
                  <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      {profile.data?.platformRole && hasMinimumRole(profile.data.platformRole as PlatformRole, PlatformRole.WARDEN) && (
        <div className="stone-card">
          <div className="stone-card-header">
            <span className="stone-card-title">Admin</span>
            <p className="text-sm text-muted-foreground">
              Administrative tools and settings
            </p>
          </div>
          <div className="stone-card-body space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <Ticket className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Admin Panel</div>
                  <div className="text-sm text-muted-foreground">
                    Manage users, usage, and platform settings
                  </div>
                </div>
              </div>
              <Link href="/admin/users">
                <Button variant="outline" size="sm">
                  Open
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="stone-card">
        <div className="stone-card-header">
          <span className="stone-card-title">Appearance</span>
          <p className="text-sm text-muted-foreground">Display and visual preferences</p>
        </div>
        <div className="stone-card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MonitorPlay className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium text-sm">Animated Background</div>
                <div className="text-xs text-muted-foreground">
                  Looping dungeon video behind the app. Disabled on mobile and when reduced motion is preferred.
                </div>
              </div>
            </div>
            <Switch
              checked={settings.data?.videoBackground ?? true}
              onCheckedChange={(checked) => updatePreferences.mutate({ videoBackground: checked })}
              disabled={updatePreferences.isPending}
            />
          </div>
        </div>
      </div>

      <div className="stone-card border-destructive/30">
        <div className="stone-card-header">
          <span className="stone-card-title text-destructive">Delete Account</span>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all campaign data. This cannot be undone.
          </p>
        </div>
        <div className="stone-card-body">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleteAccount.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete My Account
          </Button>
        </div>
      </div>

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
