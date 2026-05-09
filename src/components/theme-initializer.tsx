'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { trpc } from '@/lib/trpc';

export function ThemeInitializer() {
  const { data: settings } = trpc.userSettings.getSettings.useQuery(undefined, {
    staleTime: 300_000,
  });
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (settings?.theme && settings.theme !== theme) {
      setTheme(settings.theme);
    }
  }, [settings?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
