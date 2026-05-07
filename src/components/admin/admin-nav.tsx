'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlatformRole } from '@prisma/client';
import { cn } from '@/lib/utils';
import { Activity, BarChart3, BookOpen, LayoutDashboard, Ticket, Users } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/api-usage', label: 'Usage', icon: BarChart3 },
  { href: '/admin/invites', label: 'Invites', icon: Ticket },
  { href: '/admin/rules-sources', label: 'Rules Sources', icon: BookOpen },
  { href: '/admin/health', label: 'Health', icon: Activity },
];

export function AdminNav({ role: _role }: { role: PlatformRole }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
