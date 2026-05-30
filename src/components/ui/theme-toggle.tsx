'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({ showLabel = false, className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const updatePreferences = trpc.userSettings.updatePreferences.useMutation();

  useEffect(() => setMounted(true), []);

  const toggle = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    updatePreferences.mutate({ theme: next });
  };

  if (!mounted) return <div className="w-7 h-[44px]" />;

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'flex items-center justify-center min-h-[44px] px-1.5 rounded transition-colors',
        'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]',
        className,
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4" strokeWidth={1.8} />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.8} />
      )}
      {showLabel && (
        <span className="ml-2 text-sm">{isDark ? 'Light' : 'Dark'}</span>
      )}
    </button>
  );
}
