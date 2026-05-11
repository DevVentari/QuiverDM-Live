'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { useHeaderStore, type HeaderSlot } from '@/store/header-store';
import { UserMenu } from '@/components/user-menu';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

const PRESSURE_TRACKS = [
  { key: 'pressurePolitical',     label: 'Political' },
  { key: 'pressureSupernatural',  label: 'Supernatural' },
  { key: 'pressureEconomic',      label: 'Economic' },
  { key: 'pressureCosmic',        label: 'Cosmic' },
] as const;

function pressureColor(value: number): string {
  if (value > 0.75) return 'hsl(0 60% 50%)';
  if (value > 0.5)  return 'hsl(35 80% 55%)';
  return 'hsl(240 10% 30%)';
}

function PressureGauges({ campaignId }: { campaignId: string }) {
  const { data: state } = trpc.brain.state.get.useQuery({ campaignId }, { staleTime: 60_000 });
  if (!state) return null;

  const active = PRESSURE_TRACKS
    .map(({ key, label }) => ({ label, value: state[key] as number ?? 0 }))
    .filter(({ value }) => value > 0);
  if (!active.length) return null;

  return (
    <div className="flex items-center gap-4 px-4 flex-1">
      {active.map(({ label, value: raw }) => {
        const pct = Math.round(raw * 100);
        const color = pressureColor(raw);
        return (
          <div key={label} className="flex flex-col gap-0.5">
            <span
              className="text-[9px] uppercase tracking-[0.2em] leading-none"
              style={{ color: 'hsl(240 5% 30%)' }}
            >
              {label}
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className="rounded-full overflow-hidden"
                style={{ width: 36, height: 3, background: 'hsl(255 10% 100% / 0.05)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <span
                className="text-[8px] font-bold tabular-nums leading-none"
                style={{ color }}
              >
                {pct}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CampaignDropdown({ slot }: { slot: NonNullable<HeaderSlot> }) {
  const router = useRouter();
  const campaigns = trpc.campaigns.getMyMemberships.useQuery(undefined, { staleTime: 300_000 });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex flex-col text-left hover:opacity-75 transition-opacity focus:outline-none flex-shrink-0">
          <span
            className="text-[8px] font-bold uppercase tracking-[0.22em] leading-none mb-0.5"
            style={{ color: 'hsl(35 60% 45%)' }}
          >
            Campaign
          </span>
          <div className="flex items-center gap-1">
            <span
              className="text-sm font-bold leading-tight"
              style={{ color: 'hsl(35 30% 90%)' }}
            >
              {slot.title}
            </span>
            <ChevronDown className="h-3 w-3 flex-shrink-0" style={{ color: 'hsl(35 20% 45%)' }} strokeWidth={1.8} />
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {campaigns.data?.map((c) => (
          <DropdownMenuItem
            key={c.slug}
            onClick={() => router.push(`/campaigns/${c.slug}/sessions`)}
            className="gap-2"
          >
            {c.slug === slot.campaignSlug
              ? <Check className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              : <span className="w-3.5 flex-shrink-0" />}
            <span className="truncate">{c.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/campaigns')}>
          All campaigns
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CommandBar() {
  const slot = useHeaderStore((s) => s.slot);
  const inCampaign = !!slot?.campaignSlug;
  const pathname = usePathname();

  return (
    <header
      className="relative flex h-12 flex-shrink-0 items-center gap-3 px-4 border-b"
      style={{
        borderColor: 'hsl(35 35% 14%)',
        background: 'linear-gradient(180deg, hsl(240 12% 7% / 0.98), hsl(240 12% 5.5% / 0.96))',
      }}
    >
      {/* Amber glow along the bottom border */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(35 80% 55% / 0.20) 30%, hsl(35 80% 55% / 0.25) 50%, transparent)',
        }}
      />

      {slot?.campaignSlug ? (
        <>
          {/* Campaign dropdown */}
          <CampaignDropdown slot={slot} />

          {/* Vertical divider */}
          <div className="h-6 w-px flex-shrink-0" style={{ background: 'hsl(240 10% 18%)' }} />

          {/* Pressure gauges — DM only */}
          {slot.isDM && slot.campaignId && (
            <PressureGauges campaignId={slot.campaignId} />
          )}
          {(!slot.isDM || !slot.campaignId) && <div className="flex-1" />}

          {/* Vertical divider */}
          <div className="h-6 w-px flex-shrink-0" style={{ background: 'hsl(240 10% 18%)' }} />

          {/* Quick actions — campaign context */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" className="h-7 px-3 text-xs gap-1.5" asChild>
              <Link href={`/campaigns/${slot.campaignSlug}/sessions/prep`}>
                <Plus className="h-3 w-3" />
                New Session
              </Link>
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-3 text-xs">
              Import
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1" />
          {pathname === '/campaigns' && (
            <>
              <div className="h-6 w-px flex-shrink-0" style={{ background: 'hsl(240 10% 18%)' }} />
              <Button size="sm" className="h-7 px-3 text-xs gap-1.5 flex-shrink-0" asChild>
                <Link href="/campaigns/new">
                  <Plus className="h-3 w-3" />
                  New Campaign
                </Link>
              </Button>
            </>
          )}
        </>
      )}

      {/* Right: user */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
        <UserMenu />
      </div>
    </header>
  );
}
