'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Settings,
  PanelLeftClose,
  PanelLeft,
  LayoutDashboard,
  CalendarDays,
  ScrollText,
  Brain,
  Shield,
  UsersRound,
  Home,
  Drama,
  Swords,
  Package,
  MapPin,
  Sparkles,
  Skull,
  ChevronLeft,
  BookOpen,
  Library,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { QuiverLogo } from '@/components/logo/quiver-logo';
import { useLogoVariant } from '@/hooks/use-logo-variant';
import { useHeaderStore } from '@/store/header-store';
import { CompendiumSection } from '@/components/sidebar/compendium-section';
import { CompendiumSearch } from '@/components/sidebar/compendium-search';

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  collapsed: boolean;
  exact?: boolean;
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
          style={{ background: 'hsl(35 80% 55%)', boxShadow: '0 0 8px hsl(35 80% 48% / 0.55)' }}
        />
      )}
      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-amber-400/90' : 'opacity-60')} strokeWidth={1.8} />
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
  const [searchActive, setSearchActive] = useState(false);
  const slot = useHeaderStore((s) => s.slot);

  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];
  const campaignId = slot?.campaignId ?? '';
  const inCampaign = !!campaignSlug && !!campaignId;

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
      {/* Ambient gradients */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{ background: ['radial-gradient(ellipse 140% 30% at 50% 0%, hsl(35 80% 38% / 0.14) 0%, transparent 60%)', 'radial-gradient(ellipse 80% 20% at 85% 0%, hsl(260 50% 45% / 0.09) 0%, transparent 50%)'].join(', ') }} />
      <div className="absolute top-0 right-[-1px] w-px h-full pointer-events-none z-10" style={{ background: 'linear-gradient(180deg, transparent 0%, hsl(35 80% 55% / 0.35) 25%, hsl(35 80% 62% / 0.35) 55%, transparent 100%)' }} />

      {/* Logo */}
      <div className={cn('relative z-10 flex items-center border-b border-[hsl(35_35%_18%)]', collapsed ? 'justify-center px-3 h-14' : 'justify-between px-5 h-14')}>
        {collapsed ? (
          <>
            <Link href="/dashboard" aria-label="QuiverDM"><QuiverLogo variant={logoVariant} size="sm" /></Link>
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} className="absolute right-1 h-7 w-7" aria-label="Expand sidebar">
              <PanelLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
          </>
        ) : (
          <>
            <Link href="/dashboard" className="flex items-center gap-2.5 leading-none min-w-0">
              <QuiverLogo variant={logoVariant} size="md" />
              <div className="flex flex-col min-w-0">
                <span className="font-display text-[13px] font-bold tracking-[0.1em] leading-none" style={{ color: 'hsl(35 70% 88%)', textShadow: '0 0 18px hsl(35 80% 48% / 0.35)' }}>
                  QUIVER<span style={{ color: 'hsl(35 80% 62%)' }}>DM</span>
                </span>
                <span className="font-sans text-[8px] uppercase tracking-[0.14em] mt-1" style={{ color: 'hsl(240 5% 36%)' }}>Campaign Companion</span>
              </div>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} className="h-7 w-7 shrink-0" aria-label="Collapse sidebar">
              <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
          </>
        )}
      </div>

      {/* Search */}
      {inCampaign && (
        <CompendiumSearch
          campaignId={campaignId}
          slug={campaignSlug!}
          collapsed={collapsed}
          onSearchActive={setSearchActive}
        />
      )}

      {/* Navigation */}
      <nav className={cn('relative z-10 flex-1 overflow-y-auto py-1', searchActive && 'invisible h-0 overflow-hidden')}>
        {inCampaign && (
          <>
            <div className="mx-3 my-3 border-t border-[hsl(35_35%_14%)]" />

            <SectionLabel label="Campaign" collapsed={collapsed} />
            <NavItem href={`/campaigns/${campaignSlug}`}          label="Overview"  icon={Home}         isActive={pathname === `/campaigns/${campaignSlug}`}                           collapsed={collapsed} exact />
            <NavItem href={`/campaigns/${campaignSlug}/sessions`}  label="Sessions"  icon={CalendarDays} isActive={pathname.startsWith(`/campaigns/${campaignSlug}/sessions`)}          collapsed={collapsed} />
            <NavItem href={`/campaigns/${campaignSlug}/summaries`} label="Summaries" icon={ScrollText}   isActive={pathname.startsWith(`/campaigns/${campaignSlug}/summaries`)}         collapsed={collapsed} />

            <SectionLabel label="World" collapsed={collapsed} />
            <CompendiumSection label="NPCs"      entityType="npc"      icon={Drama}  campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/npcs`}       collapsed={collapsed} />
            <NavItem href={`/campaigns/${campaignSlug}/world`} label="World Lore" icon={Library} isActive={pathname.startsWith(`/campaigns/${campaignSlug}/world`)} collapsed={collapsed} />
            <NavItem href={`/campaigns/${campaignSlug}/brain`} label="DM Brain" icon={Brain} isActive={pathname.startsWith(`/campaigns/${campaignSlug}/brain`)} collapsed={collapsed} />
            <CompendiumSection label="Encounters" entityType="encounter" icon={Swords} campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/encounters`}  collapsed={collapsed} />

            <SectionLabel label="Library" collapsed={collapsed} />
            <CompendiumSection label="Items"     entityType="item"     icon={Package}   campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/homebrew`}   collapsed={collapsed} />
            <CompendiumSection label="Locations" entityType="location" icon={MapPin}    campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/homebrew`}   collapsed={collapsed} />
            <CompendiumSection label="Spells"    entityType="spell"    icon={Sparkles}  campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/homebrew`}   collapsed={collapsed} />
            <CompendiumSection label="Monsters"  entityType="monster"  icon={Skull}     campaignId={campaignId} slug={campaignSlug!} listHref={`/campaigns/${campaignSlug}/homebrew`}   collapsed={collapsed} />
          </>
        )}

        {!inCampaign && (
          <>
            <div className="mx-3 my-3 border-t border-[hsl(35_35%_14%)]" />

            <SectionLabel label="App" collapsed={collapsed} />
            <NavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} isActive={pathname === '/dashboard'} collapsed={collapsed} exact />
            <NavItem href="/campaigns" label="Campaigns" icon={Swords} isActive={pathname === '/campaigns' || pathname.startsWith('/campaigns/')} collapsed={collapsed} />
            <NavItem href="/homebrew" label="Homebrew" icon={BookOpen} isActive={pathname === '/homebrew' || pathname.startsWith('/homebrew/')} collapsed={collapsed} />
            <NavItem href="/recap" label="Recaps" icon={ScrollText} isActive={pathname === '/recap' || pathname.startsWith('/recap/')} collapsed={collapsed} />
          </>
        )}
      </nav>

      {/* Bottom icon row */}
      <div className="relative z-10 border-t border-[hsl(35_35%_18%)] py-2 flex items-center gap-1 px-2">
        {inCampaign && (
          <>
            <Link
              href={`/campaigns/${campaignSlug}/players`}
              title="Party"
              className={cn('flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded text-xs transition-colors', pathname.startsWith(`/campaigns/${campaignSlug}/players`) ? 'text-amber-400/90 bg-amber-500/[0.07]' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]')}
            >
              <Shield className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              {!collapsed && <span>Party</span>}
            </Link>
            <Link
              href={`/campaigns/${campaignSlug}/members`}
              title="Members"
              className={cn('flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded text-xs transition-colors', pathname.startsWith(`/campaigns/${campaignSlug}/members`) ? 'text-amber-400/90 bg-amber-500/[0.07]' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]')}
            >
              <UsersRound className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              {!collapsed && <span>Members</span>}
            </Link>
          </>
        )}
        <Link
          href="/settings"
          title="Settings"
          className={cn('flex items-center justify-center p-1.5 rounded transition-colors', pathname.startsWith('/settings') ? 'text-amber-400/90' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]')}
        >
          <Settings className="h-4 w-4" strokeWidth={1.8} />
        </Link>
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const pathname = usePathname();
  const slot = useHeaderStore((s) => s.slot);
  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];
  const campaignId = slot?.campaignId ?? '';
  const inCampaign = !!campaignSlug && !!campaignId;

  const renderLink = (item: { href: string; label: string; icon: React.ElementType }, exact = false) => {
    const isActive = exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link key={item.href} href={item.href} className={cn('relative flex items-center gap-2.5 px-5 py-2 text-sm font-medium transition-colors', isActive ? 'text-amber-400/90 bg-amber-500/[0.07]' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]')}>
        {isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: 'hsl(35 80% 55%)', boxShadow: '0 0 8px hsl(35 80% 48% / 0.55)' }} />}
        <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-amber-400/90' : 'opacity-60')} strokeWidth={1.8} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <nav className="flex flex-col py-2">
      {inCampaign ? (
        <>
          <p className="px-5 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">Campaign</p>
          {renderLink({ href: `/campaigns/${campaignSlug}`,          label: 'Overview',   icon: Home         }, true)}
          {renderLink({ href: `/campaigns/${campaignSlug}/sessions`,  label: 'Sessions',   icon: CalendarDays })}
          {renderLink({ href: `/campaigns/${campaignSlug}/summaries`, label: 'Summaries',  icon: ScrollText   })}
          <p className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">World</p>
          {renderLink({ href: `/campaigns/${campaignSlug}/npcs`,       label: 'NPCs',       icon: Drama  })}
          {renderLink({ href: `/campaigns/${campaignSlug}/brain`,      label: 'DM Brain',   icon: Brain  })}
          {renderLink({ href: `/campaigns/${campaignSlug}/encounters`, label: 'Encounters', icon: Swords })}
          <p className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">Library</p>
          {renderLink({ href: `/campaigns/${campaignSlug}/homebrew`,   label: 'Homebrew',   icon: Package })}
          <p className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">App</p>
          {renderLink({ href: `/campaigns/${campaignSlug}/players`,  label: 'Party',         icon: Shield    })}
          {renderLink({ href: `/campaigns/${campaignSlug}/members`,  label: 'Members',       icon: UsersRound})}
          {renderLink({ href: '/campaigns', label: 'All Campaigns', icon: ChevronLeft })}
          {renderLink({ href: '/settings',  label: 'Settings',      icon: Settings    })}
        </>
      ) : (
        <>
          <p className="px-5 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">App</p>
          {renderLink({ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, true)}
          {renderLink({ href: '/campaigns', label: 'Campaigns', icon: Swords })}
          {renderLink({ href: '/homebrew', label: 'Homebrew', icon: BookOpen })}
          {renderLink({ href: '/recap', label: 'Recaps', icon: ScrollText })}
          {renderLink({ href: '/settings', label: 'Settings', icon: Settings })}
        </>
      )}
    </nav>
  );
}
