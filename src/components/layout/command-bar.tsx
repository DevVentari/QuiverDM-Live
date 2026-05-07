'use client';

import { useRouter } from 'next/navigation';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useHeaderStore } from '@/store/header-store';
import { UserMenu } from '@/components/user-menu';
import { VoiceButton } from '@/components/voice/voice-button';
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
  const stateQuery = trpc.brain.state.get.useQuery({ campaignId }, { staleTime: 60_000 });
  const state = stateQuery.data as Record<string, number> | undefined;
  if (!state) return null;

  const active = PRESSURE_TRACKS.filter(({ key }) => (state[key] ?? 0) > 0);
  if (!active.length) return null;

  return (
    <div className="flex items-center gap-4 px-4 flex-1">
      {active.map(({ key, label }) => {
        const raw = state[key] ?? 0;
        const pct = Math.round(raw * 100);
        const color = pressureColor(raw);
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <span
              className="text-[8px] uppercase tracking-[0.2em] leading-none"
              style={{ color: 'hsl(240 5% 30%)' }}
            >
              {label}
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className="rounded-full overflow-hidden"
                style={{ width: 40, height: 3, background: 'hsl(255 10% 100% / 0.05)' }}
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

function CampaignDropdown({ slot }: { slot: { title: string; campaignSlug: string; isDM?: boolean; campaignId?: string } }) {
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
              className="text-[13px] font-bold leading-tight"
              style={{ color: 'hsl(35 30% 90%)' }}
            >
              {slot.title}
            </span>
            <ChevronsUpDown className="h-3 w-3 flex-shrink-0" style={{ color: 'hsl(35 20% 45%)' }} strokeWidth={1.8} />
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {campaigns.data?.map((c) => (
          <DropdownMenuItem
            key={c.slug}
            onClick={() => router.push(`/campaigns/${c.slug}`)}
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

      {inCampaign && slot?.campaignSlug ? (
        <>
          {/* Campaign dropdown */}
          <CampaignDropdown slot={slot as { title: string; campaignSlug: string; isDM?: boolean; campaignId?: string }} />

          {/* Vertical divider */}
          <div className="h-6 w-px flex-shrink-0" style={{ background: 'hsl(240 10% 18%)' }} />

          {/* Pressure gauges — DM only */}
          {slot.isDM && slot.campaignId && (
            <PressureGauges campaignId={slot.campaignId} />
          )}
          {(!slot.isDM || !slot.campaignId) && <div className="flex-1" />}
        </>
      ) : (
        <div className="flex-1" />
      )}

      {/* Right: voice + user */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
        <VoiceButton />
        <UserMenu />
      </div>
    </header>
  );
}
