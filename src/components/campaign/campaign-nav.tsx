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
} from 'lucide-react';

const tabs = [
  { label: 'Overview',   href: '',           icon: LayoutDashboard },
  { label: 'Sessions',   href: '/sessions',  icon: ScrollText },
  { label: 'Summaries',  href: '/summaries', icon: Sparkles },
  { label: 'NPCs',       href: '/npcs',      icon: Ghost },
  { label: 'Players',    href: '/players',   icon: Users },
  { label: 'Search',     href: '/search',    icon: Search },
  { label: 'Homebrew',   href: '/homebrew',  icon: BookOpen },
  { label: 'Encounters', href: '/encounters',icon: Swords },
  { label: 'Members',    href: '/members',   icon: UserCog },
  { label: 'Settings',   href: '/settings',  icon: Settings2 },
];

export function CampaignNav() {
  const pathname = usePathname();
  const { slug, isDM } = useCampaign();
  const base = `/campaigns/${slug}`;

  const visibleTabs = tabs.filter((tab) => {
    if (tab.href === '/members' || tab.href === '/settings') return isDM;
    return true;
  });

  return (
    <div className="relative">
      {/* Bottom border full-width rule */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />

      <nav className="flex gap-0.5 overflow-x-auto scrollbar-hide pb-px">
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
                'group relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all duration-150 select-none outline-none',
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
