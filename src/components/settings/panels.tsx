'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { PlatformRole } from '@prisma/client';
import {
  ArrowUpRight,
  BookOpen,
  ExternalLink,
  Loader2,
  MonitorPlay,
  Save,
  Ticket,
  Trash2,
  Zap,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { hasMinimumRole } from '@/lib/platform';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { RoleBadge } from '@/components/ui/role-badge';
import { keyConfigs, type KeyConfig } from './config';

function SettingsCard({
  title,
  description,
  children,
  accentClassName,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  accentClassName?: string;
}) {
  return (
    <section className={`stone-card ${accentClassName ?? ''}`}>
      <div className="stone-card-header">
        <div>
          <span className="stone-card-title">{title}</span>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="stone-card-body space-y-4">{children}</div>
    </section>
  );
}

export function ProfileSettingsPanel() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const profile = trpc.userSettings.getProfile.useQuery(undefined, { staleTime: 300_000 });
  const updateProfile = trpc.userSettings.updateProfile.useMutation({
    onSuccess: () => {
      toast({ title: 'Profile updated' });
      void utils.userSettings.getProfile.invalidate();
    },
    onError: (error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const [profileForm, setProfileForm] = useState({ name: '', displayName: '', bio: '' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (profile.data && !loaded) {
      setProfileForm({
        name: profile.data.name || '',
        displayName: profile.data.displayName || '',
        bio: profile.data.bio || '',
      });
      setLoaded(true);
    }
  }, [profile.data, loaded]);

  return (
    <SettingsCard title="Profile" description="How you appear to yourself and to the rest of the table.">
      {profile.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-card/40 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{profile.data?.email}</p>
              <p className="text-xs text-muted-foreground">Account identity and public table-facing details.</p>
            </div>
            {profile.data?.platformRole && <RoleBadge role={profile.data.platformRole as PlatformRole} />}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={profileForm.name}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-displayname">Display Name</Label>
              <Input
                id="profile-displayname"
                value={profileForm.displayName}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, displayName: e.target.value }))}
                placeholder="Shown to other players"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-bio">Bio</Label>
            <Textarea
              id="profile-bio"
              value={profileForm.bio}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, bio: e.target.value }))}
              placeholder="Tell other players what kind of DM or player you are."
              rows={5}
              maxLength={500}
            />
            <p className="text-right text-xs text-muted-foreground">{profileForm.bio.length}/500</p>
          </div>

          <Button onClick={() => updateProfile.mutate(profileForm)} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Profile
          </Button>
        </>
      )}
    </SettingsCard>
  );
}

export function PasswordSettingsPanel() {
  const { toast } = useToast();
  const changePassword = trpc.userSettings.changePassword.useMutation({
    onSuccess: () => {
      toast({ title: 'Password changed' });
      setPasswordForm({ current: '', next: '', confirm: '' });
    },
    onError: (error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');

  return (
    <SettingsCard title="Password" description="Control how you enter the archive.">
      {passwordError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {passwordError}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="pw-current">Current password</Label>
        <Input
          id="pw-current"
          type="password"
          value={passwordForm.current}
          onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pw-new">New password</Label>
          <Input
            id="pw-new"
            type="password"
            value={passwordForm.next}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, next: e.target.value }))}
            minLength={8}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw-confirm">Confirm new password</Label>
          <Input
            id="pw-confirm"
            type="password"
            value={passwordForm.confirm}
            onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
            minLength={8}
          />
        </div>
      </div>

      <Button
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
          changePassword.mutate({
            currentPassword: passwordForm.current,
            newPassword: passwordForm.next,
          });
        }}
        disabled={changePassword.isPending || !passwordForm.current || !passwordForm.next}
      >
        {changePassword.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Change Password
      </Button>
    </SettingsCard>
  );
}

function KeyRow({
  config,
  data,
  editing,
  setEditing,
  onSave,
  onDelete,
}: {
  config: KeyConfig;
  data: Record<string, any>;
  editing: Record<string, string>;
  setEditing: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: (keyName: string) => void;
  onDelete: (keyName: KeyConfig['name']) => void;
}) {
  const hasKey = data[config.hasField];
  const masked = data[config.maskedField];
  const isEditing = config.name in editing;

  return (
    <div className="rounded-md border border-border/60 bg-card/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Label>{config.label}</Label>
            {config.badge && (
              <Badge variant="secondary" className="text-[10px] text-emerald-400">
                {config.badge}
              </Badge>
            )}
            {hasKey && (
              <Badge variant="outline" className="text-[10px]">
                Configured
              </Badge>
            )}
          </div>
          {config.description && (
            <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
          )}
        </div>
      </div>

      <div className="mt-3">
        {isEditing ? (
          <div className="flex flex-wrap gap-2">
            <Input
              type="text"
              placeholder={config.placeholder}
              value={editing[config.name]}
              onChange={(e) => setEditing((prev) => ({ ...prev, [config.name]: e.target.value }))}
              className="font-mono text-xs"
            />
            <Button size="sm" onClick={() => onSave(config.name)}>
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
        ) : hasKey ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input type="text" value={masked || '••••••••'} disabled className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={() => setEditing((prev) => ({ ...prev, [config.name]: '' }))}>
              Change
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(config.name)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing((prev) => ({ ...prev, [config.name]: '' }))}>
            Add Key
          </Button>
        )}
      </div>
    </div>
  );
}

export function ApiKeysPanel() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const settings = trpc.userSettings.getSettings.useQuery(undefined, { staleTime: 300_000 });
  const updateKeys = trpc.userSettings.updateApiKeys.useMutation({
    onSuccess: () => {
      toast({ title: 'Saved' });
      void utils.userSettings.getSettings.invalidate();
    },
    onError: (error) => toast({ title: 'Save failed', description: error.message, variant: 'destructive' }),
  });
  const deleteKey = trpc.userSettings.deleteApiKey.useMutation({
    onSuccess: () => void utils.userSettings.getSettings.invalidate(),
  });

  const [editing, setEditing] = useState<Record<string, string>>({});

  if (settings.isLoading) {
    return (
      <SettingsCard title="AI Providers" description="Choose which arcane engines power your workflows.">
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </SettingsCard>
    );
  }

  const data = (settings.data || {}) as Record<string, any>;

  function handleSave(keyName: string) {
    updateKeys.mutate({ [keyName]: editing[keyName] });
    setEditing((prev) => {
      const next = { ...prev };
      delete next[keyName];
      return next;
    });
  }

  return (
    <SettingsCard title="AI Providers" description="Connect model providers and encrypted credentials used across QuiverDM.">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/15 bg-amber-500/[0.03] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">Usage visibility lives here too.</p>
          <p className="text-xs text-muted-foreground">See which providers are active before you spend tokens.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings/api-usage">
            <Zap className="mr-2 h-4 w-4" />
            View API Usage
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {keyConfigs.map((config) => (
          <KeyRow
            key={config.name}
            config={config}
            data={data}
            editing={editing}
            setEditing={setEditing}
            onSave={handleSave}
            onDelete={(keyName) => deleteKey.mutate({ keyName })}
          />
        ))}
      </div>
    </SettingsCard>
  );
}

export function IntegrationsSettingsPanel() {
  return (
    <SettingsCard title="Integrations" description="Link outside knowledge sources and importers into your campaigns.">
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-card/30 p-4 transition-colors hover:bg-accent/40">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-amber-400" />
            <div>
              <div className="font-medium">D&D Beyond Library</div>
              <div className="text-sm text-muted-foreground">Import sourcebooks and seed them into your worlds.</div>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/ddb">
              Open
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

export function AppearanceSettingsPanel() {
  const utils = trpc.useUtils();
  const settings = trpc.userSettings.getSettings.useQuery(undefined, { staleTime: 300_000 });
  const updatePreferences = trpc.userSettings.updatePreferences.useMutation({
    onSuccess: () => void utils.userSettings.getSettings.invalidate(),
  });

  return (
    <SettingsCard title="Appearance" description="Tune the mood of the archive without sacrificing readability.">
      <div className="flex items-center justify-between rounded-md border border-border/60 bg-card/30 p-4">
        <div className="flex items-center gap-3">
          <MonitorPlay className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm">Animated Background</div>
            <div className="text-xs text-muted-foreground">
              Keep the ambient video loop behind the app. Disabled on mobile and when reduced motion is preferred.
            </div>
          </div>
        </div>
        <Switch
          checked={settings.data?.videoBackground ?? true}
          onCheckedChange={(checked) => updatePreferences.mutate({ videoBackground: checked })}
          disabled={updatePreferences.isPending}
        />
      </div>
    </SettingsCard>
  );
}

export function DangerZonePanel() {
  const deleteAccount = trpc.userSettings.deleteAccount.useMutation({
    onSuccess: async () => {
      await signOut({ callbackUrl: '/auth/signin' });
    },
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <SettingsCard
        title="Delete Account"
        description="Erase your archive, campaigns, characters, and history permanently."
        accentClassName="border-destructive/30"
      >
        <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} disabled={deleteAccount.isPending}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete My Account
        </Button>
      </SettingsCard>

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
    </>
  );
}

export function SessionControlPanel() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <SettingsCard title="Session Control" description="Leave the archive cleanly on this device.">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Sign out of QuiverDM</p>
          <p className="text-xs text-muted-foreground">
            End your current session and return to the sign-in gate.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            setIsSigningOut(true);
            await signOut({ callbackUrl: '/auth/signin' });
          }}
          disabled={isSigningOut}
        >
          {isSigningOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Sign Out
        </Button>
      </div>
    </SettingsCard>
  );
}

export function AdminSettingsPanel() {
  const profile = trpc.userSettings.getProfile.useQuery(undefined, { staleTime: 300_000 });

  if (!profile.data?.platformRole || !hasMinimumRole(profile.data.platformRole as PlatformRole, PlatformRole.WARDEN)) {
    return (
      <SettingsCard title="Admin" description="Platform operations reserved for wardens and mythkeepers.">
        <p className="text-sm text-muted-foreground">
          This section is only available to wardens and mythkeepers.
        </p>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard title="Admin" description="Platform operations reserved for wardens and mythkeepers.">
      <div className="flex items-center justify-between rounded-md border border-border/60 bg-card/30 p-4 transition-colors hover:bg-accent/40">
        <div className="flex items-center gap-3">
          <Ticket className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-medium">Admin Panel</div>
            <div className="text-sm text-muted-foreground">Manage users, invite codes, usage, and platform controls.</div>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">
            Open
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </SettingsCard>
  );
}
