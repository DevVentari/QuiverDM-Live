'use client';

import { usePathname, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useEffect } from 'react';

/**
 * Client component that checks whether the current user needs onboarding.
 * If they do and they're not already on the /onboarding page, redirect them.
 * Renders children immediately to avoid layout flash.
 */
export function OnboardingCheck({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isOnboardingPage = pathname?.startsWith('/onboarding');

  // Only run the query if we're NOT already on the onboarding page
  const { data: needsOnboarding } = trpc.onboarding.needsOnboarding.useQuery(
    undefined,
    {
      enabled: !isOnboardingPage,
      // Avoid refetching too aggressively on every navigation
      staleTime: 60_000,
      retry: false,
    }
  );

  useEffect(() => {
    if (needsOnboarding === true && !isOnboardingPage) {
      router.push('/onboarding');
    }
  }, [needsOnboarding, isOnboardingPage, router]);

  return <>{children}</>;
}
