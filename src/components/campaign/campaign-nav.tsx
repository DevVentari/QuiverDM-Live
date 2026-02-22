'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useCampaign } from './campaign-context';

const tabs = [
  { label: 'Overview', href: '' },
  { label: 'Sessions', href: '/sessions' },
  { label: 'NPCs', href: '/npcs' },
  { label: 'Players', href: '/players' },
  { label: 'Search', href: '/search' },
  { label: 'Homebrew', href: '/homebrew' },
  { label: 'Members', href: '/members' },
  { label: 'Settings', href: '/settings' },
];

export function CampaignNav() {
  const pathname = usePathname();
  const { slug, isDM } = useCampaign();
  const base = `/campaigns/${slug}`;

  const visibleTabs = tabs.filter((tab) => {
    // Players: visible to all - members can see the party roster
    if (tab.href === '/members' || tab.href === '/settings') return isDM;
    return true;
  });

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border pb-px">
      {visibleTabs.map((tab) => {
        const href = base + tab.href;
        const isActive =
          tab.href === ''
            ? pathname === base
            : pathname.startsWith(href);
        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              'px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-foreground text-foreground font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
