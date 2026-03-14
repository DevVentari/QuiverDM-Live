'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sword, Home, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PlayNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-4">
      <div className="mb-6">
        <Link href="/play" className="flex items-center gap-2 text-sm font-semibold text-amber-400 font-display">
          <Sword className="h-4 w-4" />
          <span>Player Mode</span>
        </Link>
      </div>
      <Link
        href="/play"
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
          pathname === '/play'
            ? 'bg-amber-500/10 text-amber-400'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
        )}
      >
        <Home className="h-4 w-4" />
        My Campaigns
      </Link>
      <div className="mt-4 pt-4 border-t border-white/5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <Users className="h-4 w-4" />
          DM Dashboard
        </Link>
      </div>
    </nav>
  );
}
