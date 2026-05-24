'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const TABS = [
  { label: 'Design System', href: '/dev/design-system' },
  { label: 'Cards',         href: '/dev/cards' },
  { label: 'Icons',         href: '/dev/icons' },
  { label: 'Theme',         href: '/dev/theme' },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;
  const isDark = resolvedTheme === 'dark';
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center justify-center w-8 h-8 rounded transition-colors"
      style={{ color: 'var(--q-text-dim)' }}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function DevLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative z-10 h-screen overflow-y-auto" style={{ background: 'var(--q-bg)' }}>
      <div
        className="sticky top-0 z-20 flex items-center gap-1 border-b px-6"
        style={{
          background: 'var(--q-shell-bar)',
          borderColor: 'var(--q-border-subtle)',
          backdropFilter: 'blur(12px)',
          height: 44,
        }}
      >
        <span
          className="label-overline mr-4"
          style={{ color: 'var(--q-text-faint)' }}
        >
          Dev
        </span>
        {TABS.map(({ label, href }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center px-3 h-full text-xs font-medium transition-colors border-b-2 -mb-px"
              style={{
                borderColor: active ? 'var(--q-accent-primary)' : 'transparent',
                color: active ? 'var(--q-text)' : 'var(--q-text-dim)',
              }}
            >
              {label}
            </Link>
          );
        })}
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
      {children}
    </div>
  );
}
