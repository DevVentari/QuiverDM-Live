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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40" style={{
        borderTop: '1px solid hsl(35 35% 16%)',
        background: 'hsl(240 10% 5% / 0.97)',
        backdropFilter: 'blur(12px)',
      }}>
        <div className="flex">
          {tabs.map(tab => {
            const href = `${base}${tab.href}`;
            const isActive = tab.href === '' ? pathname === base : pathname.startsWith(href);
            return (
              <Link
                key={tab.label}
                href={href}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold tracking-wide transition-colors active:opacity-70"
                style={{ color: isActive ? 'hsl(35 80% 55%)' : 'hsl(35 10% 40%)' }}
              >
                <tab.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
