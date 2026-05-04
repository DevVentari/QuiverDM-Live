'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  FlaskConical,
  Settings,
  PanelLeftClose,
  PanelLeft,
  CalendarDays,
  ScrollText,
  Brain,
  ChevronLeft,
  Shield,
  UsersRound,
  Home,
  Drama,
  Swords,
  BookOpen,
} from 'lucide-react';
import { useCompendiumStore } from '@/store/compendium-store';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { QuiverLogo } from '@/components/logo/quiver-logo';
import { useLogoVariant } from '@/hooks/use-logo-variant';
import { CampaignPill } from '@/components/campaign/campaign-pill';



function getCampaignNav(slug: string) {
  return {
    campaign: [
      { href: `/campaigns/${slug}`, label: 'Overview', icon: Home, exact: true },
      { href: `/campaigns/${slug}/sessions`, label: 'Sessions', icon: CalendarDays },
      { href: `/campaigns/${slug}/summaries`, label: 'Summaries', icon: ScrollText },
    ],
    world: [
      { href: `/campaigns/${slug}/npcs`, label: 'NPCs', icon: Drama },
      { href: `/campaigns/${slug}/brain`, label: 'DM Brain', icon: Brain },
      { href: `/campaigns/${slug}/encounters`, label: 'Encounters', icon: Swords },
    ],
    library: [
      { href: `/campaigns/${slug}/homebrew`, label: 'Homebrew', icon: FlaskConical },
      { href: `/campaigns/${slug}/players`, label: 'Characters', icon: Shield },
      { href: `/campaigns/${slug}/members`, label: 'Members', icon: UsersRound },
    ],
  };
}

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'relative flex items-center gap-2.5 px-5 py-[7px] text-sm font-sans font-medium transition-colors',
        isActive
          ? 'text-amber-400/90 bg-amber-500/[0.07]'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
        collapsed && 'justify-center px-0'
      )}
    >
      {isActive && (
        <span
          className="absolute left-0 top-0 bottom-0 w-0.5"
          style={{
            background: 'hsl(35 80% 55%)',
            boxShadow: '0 0 8px hsl(35 80% 48% / 0.55)',
          }}
        />
      )}
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          isActive ? 'text-amber-400/90' : 'opacity-60'
        )}
        strokeWidth={1.8}
      />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="h-3" />;
  return (
    <p className="px-5 pt-4 pb-1.5 text-[11px] font-sans font-bold uppercase tracking-[0.18em]" style={{ color: 'hsl(35 10% 55%)' }}>
      {label}
    </p>
  );
}


export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { open: openCompendium, isOpen: compendiumOpen } = useCompendiumStore();

  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];
  const inCampaign = !!campaignSlug;

  const campaigns = trpc.campaigns.getMyMemberships.useQuery(undefined, {
    staleTime: 300_000,
  });

  const currentCampaign = campaigns.data?.find((c) => c.slug === campaignSlug) ?? null;
  const campaignNavSections = campaignSlug ? getCampaignNav(campaignSlug) : null;

  const baseVariant = useLogoVariant();
  const isLiveSession = pathname.match(/\/sessions\/[^/]+\/live$/) !== null;
  const logoVariant = isLiveSession ? 'gilded' : baseVariant;

  return (
    <aside
      className={cn(
        'relative hidden md:flex flex-col border-r border-[hsl(35_35%_18%)] transition-all duration-200',
        'bg-[hsl(240,10%,7%)]',
        collapsed ? 'w-16' : 'w-[240px] 2xl:w-[280px]'
      )}
    >
      {/* UI 2.0 ambient gradient — amber + purple bleed from top */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: [
            'radial-gradient(ellipse 140% 30% at 50% 0%, hsl(35 80% 38% / 0.14) 0%, transparent 60%)',
            'radial-gradient(ellipse 80% 20% at 85% 0%, hsl(260 50% 45% / 0.09) 0%, transparent 50%)',
          ].join(', '),
        }}
      />
      {/* Amber gradient right border */}
      <div
        className="absolute top-0 right-[-1px] w-px h-full pointer-events-none z-10"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, hsl(35 80% 55% / 0.35) 25%, hsl(35 80% 62% / 0.35) 55%, transparent 100%)',
        }}
      />

      {/* Logo */}
      <div
        className={cn(
          'relative z-10 flex items-center border-b border-[hsl(35_35%_18%)]',
          collapsed ? 'justify-center px-3 h-14' : 'justify-between px-5 h-14'
        )}
      >
        {collapsed ? (
          <>
            <Link href="/dashboard" aria-label="QuiverDM">
              <QuiverLogo variant={logoVariant} size="sm" />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="absolute right-1 h-7 w-7"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
          </>
        ) : (
          <>
            <Link href="/dashboard" className="flex items-center gap-2.5 leading-none min-w-0">
              <QuiverLogo variant={logoVariant} size="md" />
              <div className="flex flex-col min-w-0">
                <span
                  className="font-display text-[13px] font-bold tracking-[0.1em] leading-none"
                  style={{ color: 'hsl(35 70% 88%)', textShadow: '0 0 18px hsl(35 80% 48% / 0.35)' }}
                >
                  QUIVER<span style={{ color: 'hsl(35 80% 62%)' }}>DM</span>
                </span>
                <span className="font-sans text-[8px] uppercase tracking-[0.14em] mt-1" style={{ color: 'hsl(240 5% 36%)' }}>
                  Campaign Companion
                </span>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-7 w-7 shrink-0"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex-1 overflow-y-auto py-1">
        {/* Campaign zone — only when inside a campaign */}
        {inCampaign && campaignNavSections && (
          <>
            <div className="mx-3 my-3 border-t border-[hsl(35_35%_14%)]" />
            <CampaignPill
              current={currentCampaign}
              campaigns={campaigns.data ?? []}
              collapsed={collapsed}
            />
            <SectionLabel label="Campaign" collapsed={collapsed} />
            {campaignNavSections.campaign.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                isActive={item.exact ? pathname === item.href : pathname.startsWith(item.href + '/')}
                collapsed={collapsed}
              />
            ))}

            <SectionLabel label="World" collapsed={collapsed} />
            {campaignNavSections.world.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                collapsed={collapsed}
              />
            ))}

            <SectionLabel label="Library" collapsed={collapsed} />
            {campaignNavSections.library.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                collapsed={collapsed}
              />
            ))}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[hsl(35_35%_18%)] py-2">
        {/* Compendium toggle */}
        <button
          onClick={openCompendium}
          className={cn(
            'flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors rounded-sm mx-1',
            compendiumOpen
              ? 'text-[var(--card-amber)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
            collapsed && 'justify-center px-0'
          )}
          title="Compendium"
          aria-label="Open Compendium"
        >
          <BookOpen
            className={cn('h-4 w-4 flex-shrink-0', compendiumOpen && 'drop-shadow-[0_0_4px_hsl(35_80%_48%/0.6)]')}
            strokeWidth={1.8}
          />
          {!collapsed && <span className="font-body">Compendium</span>}
        </button>
        <NavItem
          href="/settings"
          label="Settings"
          icon={Settings}
          isActive={pathname === '/settings' || pathname.startsWith('/settings/')}
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const pathname = usePathname();
  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];
  const inCampaign = !!campaignSlug;
  const campaignNavSections = campaignSlug ? getCampaignNav(campaignSlug) : null;
  const { open: openCompendium, isOpen: compendiumOpen } = useCompendiumStore();

  const renderLink = (item: { href: string; label: string; icon: React.ElementType }, exact = false) => {
    const isActive = exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'relative flex items-center gap-2.5 px-5 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'text-amber-400/90 bg-amber-500/[0.07]'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
        )}
      >
        {isActive && (
          <span
            className="absolute left-0 top-0 bottom-0 w-0.5"
            style={{
              background: 'hsl(35 80% 55%)',
              boxShadow: '0 0 8px hsl(35 80% 48% / 0.55)',
            }}
          />
        )}
        <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-amber-400/90' : 'opacity-60')} strokeWidth={1.8} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <nav className="flex flex-col py-2">
      {inCampaign && campaignNavSections ? (
        <>
          <p className="px-5 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">Campaign</p>
          {campaignNavSections.campaign.map((item) => renderLink(item, item.exact))}
          <p className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">World</p>
          {campaignNavSections.world.map((item) => renderLink(item))}
          <p className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">Library</p>
          {campaignNavSections.library.map((item) => renderLink(item))}
          <p className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">App</p>
          {renderLink({ href: '/campaigns', label: 'All Campaigns', icon: ChevronLeft })}
          <button
            onClick={openCompendium}
            className={cn(
              'relative flex w-full items-center gap-2.5 px-5 py-2 text-sm font-medium transition-colors',
              compendiumOpen
                ? 'text-[var(--card-amber)] bg-amber-500/[0.07]'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
            )}
          >
            <BookOpen className={cn('h-4 w-4 shrink-0', compendiumOpen ? 'text-[var(--card-amber)] drop-shadow-[0_0_4px_hsl(35_80%_48%/0.6)]' : 'opacity-60')} strokeWidth={1.8} />
            <span>Compendium</span>
          </button>
          {renderLink({ href: '/settings', label: 'Settings', icon: Settings })}
        </>
      ) : (
        <>
          <button
            onClick={openCompendium}
            className={cn(
              'relative flex w-full items-center gap-2.5 px-5 py-2 text-sm font-medium transition-colors',
              compendiumOpen
                ? 'text-[var(--card-amber)] bg-amber-500/[0.07]'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
            )}
          >
            <BookOpen className={cn('h-4 w-4 shrink-0', compendiumOpen ? 'text-[var(--card-amber)] drop-shadow-[0_0_4px_hsl(35_80%_48%/0.6)]' : 'opacity-60')} strokeWidth={1.8} />
            <span>Compendium</span>
          </button>
          {renderLink({ href: '/settings', label: 'Settings', icon: Settings })}
        </>
      )}
    </nav>
  );
}
