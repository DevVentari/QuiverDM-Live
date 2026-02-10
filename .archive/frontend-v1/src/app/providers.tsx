'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import superjson from 'superjson';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <Theme appearance="dark" accentColor="gray">
            {children}
          </Theme>
        </QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
}
