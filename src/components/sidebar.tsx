'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Globe,
  User,
  FlaskConical,
  MessageSquare,
  Settings,
  PanelLeftClose,
  PanelLeft,
  ChevronsUpDown,
  Check,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

const globalNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campaigns', icon: Globe },
  { href: '/characters', label: 'Characters', icon: User },
  { href: '/homebrew', label: 'Homebrew', icon: FlaskConical },
];

const toolsNav = [
  { href: '/feedback', label: 'Feedback', icon: MessageSquare },
];

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

function CampaignSwitcher({
  currentCampaign,
  campaigns,
  collapsed,
}: {
  currentCampaign: { slug: string; name: string; sessionCount?: number | null } | null;
  campaigns: { slug: string; name: string; sessionCount?: number | null }[];
  collapsed: boolean;
}) {
  const router = useRouter();

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-[3px] border border-[hsl(35_35%_18%)] bg-[hsl(240,10%,10%)] text-muted-foreground/60 transition-colors hover:border-[hsl(35_50%_26%)] hover:text-foreground"
            title="Switch campaign"
          >
            <Globe className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-52">
          {campaigns.map((c) => (
            <DropdownMenuItem
              key={c.slug}
              onClick={() => router.push(`/campaigns/${c.slug}`)}
              className="gap-2"
            >
              {c.slug === currentCampaign?.slug && <Check className="h-3.5 w-3.5 text-amber-400" />}
              {c.slug !== currentCampaign?.slug && <span className="w-3.5" />}
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="mx-3 mt-3 mb-1 flex w-[calc(100%-24px)] items-center justify-between gap-2 rounded-[3px] border border-[hsl(35_35%_18%)] px-3 py-2 text-left transition-colors hover:border-[hsl(35_50%_26%)]"
          style={{
            background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
            boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.08)',
          }}
        >
          <div className="min-w-0">
            <p className="font-sans text-xs font-semibold truncate" style={{ color: 'hsl(35 20% 88%)' }}>
              {currentCampaign?.name ?? 'Select Campaign'}
            </p>
            <p className="font-sans text-[10px] mt-0.5" style={{ color: 'hsl(35 10% 44%)' }}>
              {currentCampaign
                ? `${currentCampaign.sessionCount ?? 0} sessions`
                : 'Switch campaign'}
            </p>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" strokeWidth={1.8} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-52">
        {campaigns.map((c) => (
          <DropdownMenuItem
            key={c.slug}
            onClick={() => router.push(`/campaigns/${c.slug}`)}
            className="gap-2"
          >
            {c.slug === currentCampaign?.slug
              ? <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              : <span className="w-3.5 shrink-0" />
            }
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

function CampaignContext({
  campaign,
  collapsed,
}: {
  campaign: { name: string; sessionCount?: number | null } | null;
  collapsed: boolean;
}) {
  if (collapsed) return <div className="h-2" />;
  return (
    <div
      className="mx-3 mt-3 mb-1 rounded-[3px] border border-[hsl(35_35%_18%)] px-3 py-2.5"
      style={{
        background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
        boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.08)',
      }}
    >
      <Link
        href="/campaigns"
        className="flex items-center gap-1 mb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.1em]"
        style={{ color: 'hsl(240 5% 36%)', transition: 'color 150ms' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'hsl(240 5% 55%)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'hsl(240 5% 36%)')}
      >
        <ChevronLeft className="h-3 w-3" strokeWidth={2.5} />
        All Campaigns
      </Link>
      <div className="flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} style={{ color: 'hsl(35 80% 62%)' }} />
        <span
          className="font-display text-[13px] font-bold tracking-[0.03em] truncate"
          style={{
            color: 'hsl(35 80% 68%)',
            textShadow: '0 0 14px hsl(35 80% 48% / 0.3)',
          }}
        >
          {campaign?.name ?? 'Campaign'}
        </span>
        <span
          className="font-sans text-[8px] font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full shrink-0"
          style={{
            border: '1px solid hsl(35 60% 28%)',
            background: 'hsl(35 60% 10%)',
            color: 'hsl(35 70% 52%)',
          }}
        >
          DM
        </span>
      </div>
      <p className="font-sans text-[10px] mt-1" style={{ color: 'hsl(35 10% 40%)' }}>
        {campaign?.sessionCount ?? 0} sessions
      </p>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { open: openCompendium, isOpen: compendiumOpen } = useCompendiumStore();

  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];

  const campaigns = trpc.campaigns.getMyMemberships.useQuery(undefined, {
    staleTime: 300_000,
  });

  const currentCampaign = campaigns.data?.find((c) => c.slug === campaignSlug) ?? null;
  const inCampaign = !!campaignSlug;

  const campaignNavSections = campaignSlug ? getCampaignNav(campaignSlug) : null;

  return (
    <aside
      className={cn(
        'relative hidden md:flex flex-col border-r border-[hsl(35_35%_18%)] transition-all duration-200',
        'bg-[hsl(240,10%,7%)]',
        collapsed ? 'w-16' : 'w-[240px]'
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
          'relative z-10 flex items-center justify-between border-b border-[hsl(35_35%_18%)]',
          collapsed ? 'px-3 h-14' : 'px-5 h-14'
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex flex-col leading-none">
            <span
              className="font-display text-base font-bold tracking-wide"
              style={{
                color: 'hsl(35 80% 62%)',
                textShadow: '0 0 18px hsl(35 80% 48% / 0.35)',
              }}
            >
              QuiverDM
            </span>
            <span className="font-sans text-[9px] uppercase tracking-[0.14em] mt-0.5" style={{ color: 'hsl(240 5% 36%)' }}>
              Campaign Companion
            </span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn('h-7 w-7 shrink-0', collapsed && 'mx-auto')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={1.8} />
          )}
        </Button>
      </div>

      {/* Campaign switcher / context header */}
      {inCampaign ? (
        <CampaignContext campaign={currentCampaign} collapsed={collapsed} />
      ) : (
        <CampaignSwitcher
          currentCampaign={currentCampaign}
          campaigns={campaigns.data ?? []}
          collapsed={collapsed}
        />
      )}

      {/* Navigation */}
      <nav className="relative z-10 flex-1 overflow-y-auto py-1">
        {inCampaign && campaignNavSections ? (
          <>
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
        ) : (
          <>
            <SectionLabel label="Navigate" collapsed={collapsed} />
            {globalNav.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                isActive={
                  pathname === item.href || pathname.startsWith(item.href + '/')
                }
                collapsed={collapsed}
              />
            ))}

            <SectionLabel label="Tools" collapsed={collapsed} />
            {toolsNav.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                isActive={
                  pathname === item.href || pathname.startsWith(item.href + '/')
                }
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
          <p className="px-5 pt-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">Navigate</p>
          {globalNav.map((item) => renderLink(item))}
          <p className="px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">Tools</p>
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
          {[...toolsNav, { href: '/settings', label: 'Settings', icon: Settings }].map((item) => renderLink(item))}
        </>
      )}
    </nav>
  );
}
