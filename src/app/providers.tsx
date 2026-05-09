'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useSession, SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import superjson from 'superjson';
import { Toaster } from '@/components/ui/sonner';
import { ThemeInitializer } from '@/components/theme-initializer';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
  });
}

function PostHogUserIdentifier() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;
    if (session?.user?.id) {
      posthog.identify(session.user.id, {
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      });
    } else {
      posthog.reset();
    }
  }, [session, status]);

  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      posthog.captureException(
        e.reason instanceof Error ? e.reason : new Error(String(e.reason)),
      );
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <PostHogProvider client={posthog}>
      <SessionProvider>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem={false}
              disableTransitionOnChange
            >
              <PostHogUserIdentifier />
              <ThemeInitializer />
              {children}
              <Toaster />
            </ThemeProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </SessionProvider>
    </PostHogProvider>
  );
}
