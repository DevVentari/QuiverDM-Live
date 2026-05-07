'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useCampaign } from './campaign-context';
import {
  LayoutDashboard,
  ScrollText,
  Sparkles,
  Ghost,
  Users,
  Search,
  BookOpen,
  Swords,
  UserCog,
  Settings2,
  Brain,
  Map,
} from 'lucide-react';

const tabs = [
  { label: 'Overview',   href: '',           icon: LayoutDashboard, dmOnly: false },
  { label: 'Sessions',   href: '/sessions',  icon: ScrollText,      dmOnly: false },
  { label: 'Summaries',  href: '/summaries', icon: Sparkles,        dmOnly: false },
  { label: 'NPCs',       href: '/npcs',      icon: Ghost,           dmOnly: false },
  { label: 'Players',    href: '/players',   icon: Users,           dmOnly: false },
  { label: 'Search',     href: '/search',    icon: Search,          dmOnly: false },
  { label: 'Homebrew',   href: '/homebrew',  icon: BookOpen,        dmOnly: false },
  { label: 'Encounters', href: '/encounters',icon: Swords,          dmOnly: false },
  { label: 'World Map',  href: '/world-map', icon: Map,             dmOnly: false },
  { label: 'DM Brain',   href: '/brain',     icon: Brain,           dmOnly: true },
  { label: 'Members',    href: '/members',   icon: UserCog,         dmOnly: true },
  { label: 'Settings',   href: '/settings',  icon: Settings2,       dmOnly: true },
];

export function CampaignNav() {
  const pathname = usePathname();
  const { slug, isDM } = useCampaign();
  const base = `/campaigns/${slug}`;

  const visibleTabs = tabs.filter((tab) => {
    if (tab.dmOnly) return isDM;
    return true;
  });

  return (
    <div className="relative">
      {/* Bottom border full-width rule */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />

      <nav className="flex w-full overflow-x-auto scrollbar-hide pb-px">
        {visibleTabs.map((tab) => {
          const href = base + tab.href;
          const isActive =
            tab.href === ''
              ? pathname === base
              : pathname.startsWith(href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                'group relative flex shrink-0 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all duration-150 select-none outline-none',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {/* Icon */}
              <Icon
                className={cn(
                  'h-3.5 w-3.5 shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />

              {/* Label — use Cinzel for a hint of D&D character */}
              <span className={cn(isActive && 'font-semibold')}>
                {tab.label}
              </span>

              {/* Active indicator — amber underline */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
              )}

              {/* Hover indicator */}
              {!isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-border opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
