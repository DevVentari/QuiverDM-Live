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
import { Trash2, Save, Ticket, ExternalLink, ArrowUpRight, Loader2, Zap, MonitorPlay, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { RoleBadge } from '@/components/ui/role-badge';
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


export default function SettingsPage() {
  const { toast } = useToast();
  const profile = trpc.userSettings.getProfile.useQuery(undefined, { staleTime: 300_000 });
  const settings = trpc.userSettings.getSettings.useQuery(undefined, { staleTime: 300_000 });
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
    onSuccess: () => {
      toast({ title: 'Saved' });
      utils.userSettings.getSettings.invalidate();
    },
    onError: (error) => toast({ title: 'Save failed', description: error.message, variant: 'destructive' }),
  });

  const deleteKey = trpc.userSettings.deleteApiKey.useMutation({
    onSuccess: () => utils.userSettings.getSettings.invalidate(),
  });

  const updatePreferences = trpc.userSettings.updatePreferences.useMutation({
    onSuccess: () => utils.userSettings.getSettings.invalidate(),
  });

  const [editing, setEditing] = useState<Record<string, string>>({});
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
    <div className="max-w-5xl xl:max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
      <div>
        <p className="label-overline mb-0.5">Account</p>
        <h1 className="text-xl sm:text-2xl font-display font-bold tracking-wide">Settings</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
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
        </div>

        <div className="space-y-6">
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
        <div className="stone-card-body">
          <div className="grid gap-4 md:grid-cols-2">
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
      </div>

      <div className="stone-card">
        <div className="stone-card-header">
          <span className="stone-card-title">Integrations</span>
          <p className="text-sm text-muted-foreground">
            Connect external tools and import content into your campaigns.
          </p>
        </div>
        <div className="stone-card-body space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-amber-400" />
              <div>
                <div className="font-medium">D&D Beyond Library</div>
                <div className="text-sm text-muted-foreground">
                  Import sourcebooks from your D&D Beyond account
                </div>
              </div>
            </div>
            <Link href="/settings/ddb">
              <Button variant="outline" size="sm">
                Open
                <ArrowUpRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
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
