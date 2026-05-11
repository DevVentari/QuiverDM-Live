'use client';

import Link from 'next/link';
import { PlatformRole } from '@prisma/client';
import {
  ArrowUpRight,
  BookOpen,
  Brush,
  KeyRound,
  ShieldAlert,
  UserCircle2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { PLAN_LABELS, hasMinimumRole } from '@/lib/platform';
import { RoleBadge } from '@/components/ui/role-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { keyConfigs } from '@/components/settings/config';

export default function SettingsOverviewPage() {
  const profile = trpc.userSettings.getProfile.useQuery(undefined, { staleTime: 300_000 });
  const settings = trpc.userSettings.getSettings.useQuery(undefined, { staleTime: 300_000 });

  const configuredProviders = settings.data
    ? keyConfigs.filter((config) => settings.data?.[config.hasField]).length
    : 0;
  const hasDdb = !!settings.data?.hasDndBeyondCobaltCookie;
  const isAdmin = !!profile.data?.platformRole && hasMinimumRole(profile.data.platformRole as PlatformRole, PlatformRole.WARDEN);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.1rem] border border-border/60 bg-card/35 p-5">
        {profile.isLoading || settings.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="label-overline">Overview</p>
                {profile.data?.platformRole && <RoleBadge role={profile.data.platformRole as PlatformRole} />}
                {profile.data?.tier && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-[0.16em]">
                    {PLAN_LABELS[profile.data.tier] ?? profile.data.tier}
                  </Badge>
                )}
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold tracking-[0.04em] text-foreground">
                  {profile.data?.displayName || profile.data?.name || 'Your archive'}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--q-text-dim)]">
                  This is the quickest read on your QuiverDM setup: who you are, which engines are connected,
                  and whether the archive is ready for session prep.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <StatusPill label="AI providers" value={`${configuredProviders}/5`} helper={configuredProviders > 0 ? 'Linked' : 'None connected'} />
              <StatusPill label="D&D Beyond" value={hasDdb ? 'Linked' : 'Idle'} helper={hasDdb ? 'Import ready' : 'Not connected'} />
              <StatusPill label="Atmosphere" value={settings.data?.videoBackground ? 'Animated' : 'Still'} helper="Visual mode" />
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <OverviewCard
          href="/settings/profile"
          title="Profile"
          description="Edit your identity, public display name, and table-facing bio."
          eyebrow="Identity"
          icon={UserCircle2}
          meta={profile.data?.email || 'No email loaded'}
        />
        <OverviewCard
          href="/settings/ai"
          title="AI & Usage"
          description="Manage model providers, encrypted keys, and token visibility."
          eyebrow="Arcane Engines"
          icon={KeyRound}
          meta={configuredProviders > 0 ? `${configuredProviders} provider${configuredProviders === 1 ? '' : 's'} configured` : 'No providers configured'}
        />
        <OverviewCard
          href="/settings/integrations"
          title="Integrations"
          description="Connect D&D Beyond and future external tools that feed your worlds."
          eyebrow="Links"
          icon={BookOpen}
          meta={hasDdb ? 'D&D Beyond connected' : 'Ready to connect'}
        />
        <OverviewCard
          href="/settings/appearance"
          title="Appearance"
          description="Set the archive’s visual atmosphere and ambient presentation."
          eyebrow="Atmosphere"
          icon={Brush}
          meta={settings.data?.videoBackground ? 'Animated background enabled' : 'Ambient background disabled'}
        />
        <OverviewCard
          href="/settings/account"
          title="Account"
          description="Change your password and control irreversible account actions."
          eyebrow="Security"
          icon={ShieldAlert}
          meta="Password, ownership, and deletion controls"
        />
        {isAdmin && (
          <OverviewCard
            href="/settings/admin"
            title="Admin"
            description="Platform controls for user management, invites, and operational oversight."
            eyebrow="Operations"
            icon={ShieldAlert}
            meta="Warden-only tools"
          />
        )}
      </div>

      <section className="rounded-[1.1rem] border border-amber-500/15 bg-amber-500/[0.03] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="label-overline">Recommended Path</p>
            <h3 className="mt-2 font-display text-xl font-semibold text-foreground">Configure the archive in this order</h3>
            <p className="mt-2 max-w-2xl text-sm text-[var(--q-text-dim)]">
              Connect an AI provider first, link D&D Beyond if you use owned content, then tune appearance once the practical setup is done.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/settings/ai">Configure AI</Link>
            </Button>
            <Button asChild>
              <Link href="/settings/integrations">
                Link Integrations
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function OverviewCard({
  href,
  title,
  description,
  eyebrow,
  icon: Icon,
  meta,
}: {
  href: string;
  title: string;
  description: string;
  eyebrow: string;
  icon: React.ComponentType<{ className?: string }>;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1.1rem] border border-border/60 bg-card/35 p-5 transition-colors hover:border-amber-500/25 hover:bg-card/55"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="label-overline">{eyebrow}</p>
          <div>
            <h3 className="font-display text-xl font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--q-text-dim)]">{description}</p>
          </div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/15 bg-amber-500/[0.05] text-amber-300 transition-transform group-hover:-translate-y-0.5">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-4">
        <span className="text-xs text-[var(--q-text-dim)]">{meta}</span>
        <span className="inline-flex items-center gap-2 text-sm font-medium text-amber-300">
          Open
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  );
}

function StatusPill({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/30 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--q-text-dim)]">{label}</p>
      <div className="mt-2 font-display text-xl font-semibold text-foreground">{value}</div>
      <p className="mt-1 text-xs text-[var(--q-text-dim)]">{helper}</p>
    </div>
  );
}
