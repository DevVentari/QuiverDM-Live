'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlatformRole } from '@prisma/client';
import { ChevronRight, KeyRound, Sparkles, Wand2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { PLAN_LABELS, hasMinimumRole } from '@/lib/platform';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RoleBadge } from '@/components/ui/role-badge';
import { keyConfigs, settingsNavItems } from './config';

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const profile = trpc.userSettings.getProfile.useQuery(undefined, { staleTime: 300_000 });
  const settings = trpc.userSettings.getSettings.useQuery(undefined, { staleTime: 300_000 });

  const configuredProviders = settings.data
    ? keyConfigs.filter((config) => settings.data?.[config.hasField]).length
    : 0;
  const navItems = settingsNavItems.filter((item) => {
    if (!item.adminOnly) return true;
    return !!profile.data?.platformRole && hasMinimumRole(profile.data.platformRole as PlatformRole, PlatformRole.WARDEN);
  });

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[1.25rem] border border-amber-500/15 bg-[linear-gradient(135deg,hsl(240_10%_10%/.92),hsl(240_12%_7%/.98))] p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(35_70%_40%/.18),transparent_42%),radial-gradient(circle_at_85%_12%,hsl(262_55%_45%/.12),transparent_30%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-amber-200/70">
              <Wand2 className="h-3.5 w-3.5" />
              Archive Control Room
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-[0.04em] text-amber-50 sm:text-4xl">
                Settings
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-amber-100/65">
                Identity, arcane engines, and world-facing integrations belong here. Each section holds one kind of power.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <SummaryTile
              label="Profile"
              value={profile.isLoading ? '...' : profile.data?.displayName || profile.data?.name || 'Unclaimed'}
              helper={profile.data?.tier ? PLAN_LABELS[profile.data.tier] ?? profile.data.tier : 'No tier'}
            />
            <SummaryTile
              label="AI Providers"
              value={settings.isLoading ? '...' : `${configuredProviders}/5`}
              helper={configuredProviders > 0 ? 'Configured' : 'No keys connected'}
            />
            <SummaryTile
              label="Atmosphere"
              value={settings.isLoading ? '...' : settings.data?.videoBackground ? 'Animated' : 'Still'}
              helper="Visual ambience"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[1rem] border border-border/60 bg-card/40 p-3 backdrop-blur">
            <div className="border-b border-border/50 px-3 pb-3">
              {profile.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ) : (
                <>
                  <p className="font-display text-lg font-semibold tracking-[0.04em] text-foreground">
                    {profile.data?.displayName || profile.data?.name || 'QuiverDM'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {profile.data?.platformRole && <RoleBadge role={profile.data.platformRole as PlatformRole} />}
                    {profile.data?.tier && (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-[0.16em]">
                        {PLAN_LABELS[profile.data.tier] ?? profile.data.tier}
                      </Badge>
                    )}
                  </div>
                </>
              )}
            </div>

            <nav className="space-y-1 pt-3">
              {navItems.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group flex items-start gap-3 rounded-xl px-3 py-3 transition-colors',
                      active
                        ? 'bg-amber-500/[0.08] text-amber-100 ring-1 ring-amber-500/20'
                        : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground'
                    )}
                  >
                    <div className={cn(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                      active
                        ? 'border-amber-500/30 bg-amber-500/[0.08] text-amber-300'
                        : 'border-border/60 bg-background/40 text-muted-foreground'
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{item.label}</span>
                        <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', active ? 'text-amber-300' : 'opacity-0 group-hover:opacity-100')} />
                      </div>
                      <p className={cn('mt-1 text-xs leading-relaxed', active ? 'text-amber-100/70' : 'text-muted-foreground')}>
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="rounded-[1rem] border border-amber-500/15 bg-amber-500/[0.03] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/[0.08] text-amber-300">
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-100">Recommended setup</p>
                <p className="text-xs leading-relaxed text-amber-100/65">
                  Connect Gemini first, then add D&D Beyond if you want imported sourcebooks grounded in your own library.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/45">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-display text-xl font-semibold text-amber-50">{value}</span>
        <Sparkles className="h-3.5 w-3.5 text-amber-300/70" />
      </div>
      <p className="mt-1 text-xs text-amber-100/55">{helper}</p>
    </div>
  );
}
