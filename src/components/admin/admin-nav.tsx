'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlatformRole } from '@prisma/client';
import { cn } from '@/lib/utils';
import { Users, Zap, Ticket, BookOpen, Shield } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/api-usage', label: 'API Usage', icon: Zap },
  { href: '/admin/invites', label: 'Invites', icon: Ticket },
  { href: '/admin/rules-sources', label: 'Rules Sources', icon: BookOpen },
];

export function AdminNav({ role }: { role: PlatformRole }) {
  const pathname = usePathname();

  return (
    <nav className="w-56 min-h-screen border-r border-border/50 bg-card/30 p-4 space-y-1">
      <div className="flex items-center gap-2 px-3 py-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm tracking-wide uppercase text-primary">
          Admin Panel
        </span>
      </div>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
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
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
