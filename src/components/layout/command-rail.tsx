'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Swords, BookOpen, ScrollText,
  Home, CalendarDays, Drama, Library, Brain,
  Shield, Settings, PanelLeft, PanelLeftClose,
  Package, MapPin, Sparkles, Skull,
} from 'lucide-react';
import { QuiverLogo } from '@/components/logo/quiver-logo';
import { useHeaderStore } from '@/store/header-store';
import { useLogoVariant } from '@/hooks/use-logo-variant';
import { CompendiumSection } from '@/components/sidebar/compendium-section';
import { CompendiumSearch } from '@/components/sidebar/compendium-search';

const RAIL_KEY = 'quiver.rail.pinned';

function RailItem({
  href,
  label,
  icon: Icon,
  isActive,
  pinned,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  pinned: boolean;
}) {
  return (
    <Link
      href={href}
      title={!pinned ? label : undefined}
      className={cn(
        'relative flex items-center gap-3 transition-colors min-h-[44px]',
        pinned ? 'px-4' : 'justify-center',
        isActive
          ? 'text-amber-400/90'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
      )}
      style={isActive ? { background: 'hsl(35 80% 55% / 0.08)' } : undefined}
    >
      {isActive && (
        <span
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
          style={{ background: 'hsl(35 80% 55%)', boxShadow: '0 0 8px hsl(35 80% 48% / 0.5)' }}
        />
      )}
      <Icon
        className={cn('h-4 w-4 shrink-0', isActive ? 'text-amber-400/90' : 'opacity-60')}
        strokeWidth={1.8}
      />
      <span
        className="text-sm font-medium font-sans leading-none transition-all duration-200 overflow-hidden whitespace-nowrap"
        style={{ maxWidth: pinned ? 160 : 0, opacity: pinned ? 1 : 0 }}
      >
        {label}
      </span>
    </Link>
  );
}

function RailDivider() {
  return <div className="mx-3 my-1.5 border-t" style={{ borderColor: 'hsl(35 35% 14%)' }} />;
}

function RailSectionLabel({ label, pinned }: { label: string; pinned: boolean }) {
  if (!pinned) return <RailDivider />;
  return (
    <p
      className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] overflow-hidden whitespace-nowrap"
      style={{ color: 'hsl(35 10% 45%)' }}
    >
      {label}
    </p>
  );
}

export function CommandRail() {
  const pathname = usePathname();
  const slot = useHeaderStore((s) => s.slot);
  const [pinned, setPinned] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(RAIL_KEY) === 'true';
  });
  const [searchActive, setSearchActive] = useState(false);
  const logoVariant = useLogoVariant();
  const isLiveSession = pathname.match(/\/sessions\/[^/]+\/live$/) !== null;

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem(RAIL_KEY, String(next));
  };

  const campaignSlug = slot?.campaignSlug;
  const campaignId = slot?.campaignId ?? '';
  const inCampaign = !!campaignSlug;
  const width = pinned ? 260 : 72;
  const collapsed = !pinned;

  return (
    <aside
      className="relative hidden md:flex flex-col border-r flex-shrink-0 transition-all duration-200"
      style={{
        width,
        borderColor: 'hsl(35 35% 18%)',
        background: 'hsl(240 12% 4.5%)',
      }}
    >
      {/* Ambient gradients */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse 140% 25% at 50% 0%, hsl(35 80% 38% / 0.12), transparent)',
        }}
      />
      <div
        className="absolute top-0 right-[-1px] w-px h-full pointer-events-none z-10"
        style={{
          background: 'linear-gradient(180deg, transparent, hsl(35 80% 55% / 0.30) 30%, hsl(35 80% 55% / 0.30) 65%, transparent)',
        }}
      />

      {/* Logo row */}
      <div
        className="relative z-10 flex items-center border-b flex-shrink-0"
        style={{
          height: 48,
          borderColor: 'hsl(35 35% 18%)',
          padding: pinned ? '0 16px' : '0',
          justifyContent: pinned ? 'flex-start' : 'center',
        }}
      >
        {pinned ? (
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <QuiverLogo variant={isLiveSession ? 'gilded' : logoVariant} size="md" />
            <div className="flex flex-col min-w-0">
              <span
                className="font-display text-[12px] font-bold tracking-[0.1em] leading-none"
                style={{ color: 'hsl(35 70% 88%)', textShadow: '0 0 18px hsl(35 80% 48% / 0.35)' }}
              >
                QUIVER<span style={{ color: 'hsl(35 80% 62%)' }}>DM</span>
              </span>
              <span
                className="font-sans text-[8px] uppercase tracking-[0.14em] mt-1"
                style={{ color: 'hsl(240 5% 36%)' }}
              >
                Campaign Companion
              </span>
            </div>
          </Link>
        ) : (
          <Link href="/dashboard" aria-label="QuiverDM">
            <QuiverLogo variant={isLiveSession ? 'gilded' : logoVariant} size="sm" />
          </Link>
        )}
      </div>

      {/* Search — only when expanded and in campaign */}
      {inCampaign && (
        <div className="relative z-10">
          <CompendiumSearch
            campaignId={campaignId}
            slug={campaignSlug!}
            collapsed={collapsed}
            onSearchActive={setSearchActive}
          />
        </div>
      )}

      {/* Nav */}
      <nav
        className={cn('relative z-10 flex-1 overflow-y-auto overflow-x-hidden py-1', searchActive && 'invisible h-0 overflow-hidden')}
      >
        {inCampaign ? (
          <>
            <RailSectionLabel label="Campaign" pinned={pinned} />
            <RailItem href={`/campaigns/${campaignSlug}`}            label="Overview"   icon={Home}         isActive={pathname === `/campaigns/${campaignSlug}`}                    pinned={pinned} />
            <RailItem href={`/campaigns/${campaignSlug}/sessions`}   label="Sessions"   icon={CalendarDays} isActive={pathname.startsWith(`/campaigns/${campaignSlug}/sessions`)}   pinned={pinned} />

            <RailSectionLabel label="World" pinned={pinned} />
            <CompendiumSection
              label="NPCs"
              entityType="npc"
              icon={Drama}
              campaignId={campaignId}
              slug={campaignSlug!}
              listHref={`/campaigns/${campaignSlug}/npcs`}
              collapsed={collapsed}
            />
            <RailItem href={`/campaigns/${campaignSlug}/world`}      label="World Lore" icon={Library}      isActive={pathname.startsWith(`/campaigns/${campaignSlug}/world`)}      pinned={pinned} />
            <RailItem href={`/campaigns/${campaignSlug}/brain`}      label="DM Brain"   icon={Brain}        isActive={pathname.startsWith(`/campaigns/${campaignSlug}/brain`)}      pinned={pinned} />
            <CompendiumSection
              label="Encounters"
              entityType="encounter"
              icon={Swords}
              campaignId={campaignId}
              slug={campaignSlug!}
              listHref={`/campaigns/${campaignSlug}/encounters`}
              createHref={`/campaigns/${campaignSlug}/encounters?create=true`}
              collapsed={collapsed}
            />

            <RailSectionLabel label="Library" pinned={pinned} />
            <CompendiumSection label="Items"     entityType="item"     icon={Package}  campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/world`} createHref="/homebrew" collapsed={collapsed} />
            <CompendiumSection label="Locations" entityType="location" icon={MapPin}   campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/world`} createHref="/homebrew" collapsed={collapsed} />
            <CompendiumSection label="Spells"    entityType="spell"    icon={Sparkles} campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/world`} createHref="/homebrew" collapsed={collapsed} />
            <CompendiumSection label="Monsters"  entityType="monster"  icon={Skull}    campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/world`} createHref="/homebrew" collapsed={collapsed} />
          </>
        ) : (
          <>
            <RailItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} isActive={pathname === '/dashboard'}              pinned={pinned} />
            <RailItem href="/campaigns" label="Campaigns" icon={Swords}          isActive={pathname === '/campaigns'}               pinned={pinned} />
            <RailItem href="/homebrew"  label="Homebrew"  icon={BookOpen}        isActive={pathname.startsWith('/homebrew')}        pinned={pinned} />
            <RailItem href="/recap"     label="Recaps"    icon={ScrollText}      isActive={pathname.startsWith('/recap')}           pinned={pinned} />
          </>
        )}
      </nav>

      {/* Footer */}
      <div
        className="relative z-10 border-t flex items-center gap-1 px-2 py-2 flex-shrink-0"
        style={{ borderColor: 'hsl(35 35% 18%)' }}
      >
        {inCampaign && (
          <Link
            href={`/campaigns/${campaignSlug}/players`}
            title="Party"
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 min-h-[44px] rounded text-xs transition-colors',
              pathname.startsWith(`/campaigns/${campaignSlug}/players`)
                ? 'text-amber-400/90 bg-amber-500/[0.07]'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
            )}
          >
            <Shield className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            {pinned && <span>Party</span>}
          </Link>
        )}
        <Link
          href="/settings"
          title="Settings"
          className={cn(
            'flex items-center justify-center min-h-[44px] px-1.5 rounded transition-colors',
            pathname.startsWith('/settings') ? 'text-amber-400/90' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
          )}
        >
          <Settings className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </div>

      {/* Pin toggle */}
      <button
        onClick={togglePin}
        title={pinned ? 'Collapse rail' : 'Pin rail'}
        className="relative z-10 flex h-11 w-full items-center justify-center border-t transition-colors hover:bg-white/[0.04]"
        style={{ borderColor: 'hsl(35 35% 18%)' }}
      >
        {pinned
          ? <PanelLeftClose className="h-3.5 w-3.5 opacity-40" strokeWidth={1.8} />
          : <PanelLeft className="h-3.5 w-3.5 opacity-40" strokeWidth={1.8} />}
        {pinned && (
          <span className="ml-2 text-xs text-muted-foreground opacity-40">Collapse</span>
        )}
      </button>
    </aside>
  );
}
