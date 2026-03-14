'use client';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { BookOpen, Users, ScrollText, Wand2, Map } from 'lucide-react';

const tabs = [
  { label: 'Hub', href: '', icon: Map },
  { label: 'Recaps', href: '/sessions', icon: ScrollText },
  { label: 'Party', href: '/characters', icon: Users },
  { label: 'NPCs', href: '/npcs', icon: BookOpen },
  { label: 'Lore', href: '/lore', icon: Wand2 },
];

export default function PlayCampaignLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const base = `/play/${slug}`;

  return (
    <div className="flex flex-col min-h-screen pb-16 md:pb-0">
      <div className="flex-1">{children}</div>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-white/8 bg-background/95 backdrop-blur z-40">
        <div className="flex">
          {tabs.map(tab => {
            const href = `${base}${tab.href}`;
            const isActive = tab.href === '' ? pathname === base : pathname.startsWith(href);
            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                  isActive ? 'text-amber-400' : 'text-muted-foreground'
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
