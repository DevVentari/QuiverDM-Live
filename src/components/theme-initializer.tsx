'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { trpc } from '@/lib/trpc';

export function ThemeInitializer() {
  const { status } = useSession();
  const { data: settings } = trpc.userSettings.getSettings.useQuery(undefined, {
    staleTime: 300_000,
    enabled: status === 'authenticated',
  });
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (settings?.theme && settings.theme !== theme) {
      setTheme(settings.theme);
    }
  }, [settings?.theme]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
