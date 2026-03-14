'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Swords,
  Users,
  BookOpen,
  MessageSquare,
  Settings,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

const mainNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campaigns', icon: Swords },
  { href: '/characters', label: 'Characters', icon: Users },
  { href: '/homebrew', label: 'Homebrew', icon: BookOpen },
];

const toolsNav = [
  { href: '/feedback', label: 'Feedback', icon: MessageSquare },
];

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
        'relative flex items-center gap-2.5 px-5 py-[7px] text-[13px] font-medium transition-colors',
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
      />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="h-4" />;
  return (
    <p className="px-5 pt-4 pb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">
      {label}
    </p>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Detect current campaign slug from URL
  const campaignSlug = pathname.match(/\/campaigns\/([^/]+)/)?.[1];

  // Load campaigns for the switcher (lightweight, long stale time)
  const campaigns = trpc.campaigns.getMyMemberships.useQuery(undefined, {
    staleTime: 300_000,
    enabled: !collapsed,
  });

  const currentCampaign =
    campaigns.data?.find((c) => c.slug === campaignSlug) ??
    campaigns.data?.[0] ??
    null;

  return (
    <aside
      className={cn(
        'relative hidden md:flex flex-col border-r border-[hsl(35_35%_18%)] transition-all duration-200',
        'bg-[hsl(240,10%,7%)]',
        collapsed ? 'w-16' : 'w-[220px]'
      )}
    >
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
          'flex items-center justify-between border-b border-[hsl(35_35%_18%)]',
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
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/50 mt-0.5">
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
            <PanelLeft className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Campaign switcher */}
      {!collapsed && (
        <Link
          href="/campaigns"
          className="mx-3 mt-3 mb-1 flex items-center justify-between gap-2 rounded-[3px] border border-[hsl(35_35%_18%)] bg-[hsl(240,10%,10%)] px-3 py-2 transition-colors hover:border-[hsl(35_50%_26%)]"
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground/90 truncate">
              {currentCampaign?.name ?? 'Select Campaign'}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {currentCampaign
                ? `${currentCampaign.sessionCount ?? 0} sessions`
                : 'Switch campaign'}
            </p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        </Link>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1">
        <SectionLabel label="Navigate" collapsed={collapsed} />
        {mainNav.map((item) => (
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
      </nav>

      {/* Bottom: Settings */}
      <div className="border-t border-[hsl(35_35%_18%)] py-2">
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

  return (
    <nav className="flex flex-col py-2">
      {/* Section label */}
      <p className="px-5 pt-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">
        Navigate
      </p>
      {mainNav.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex items-center gap-2.5 px-5 py-2 text-[13px] font-medium transition-colors',
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
            <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-amber-400/90' : 'opacity-60')} />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <p className="px-5 pt-4 pb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 font-display">
        Tools
      </p>
      {[...toolsNav, { href: '/settings', label: 'Settings', icon: Settings }].map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex items-center gap-2.5 px-5 py-2 text-[13px] font-medium transition-colors',
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
            <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-amber-400/90' : 'opacity-60')} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
