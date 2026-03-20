'use client';

import { usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';

export function useCompendiumRoute() {
  const pathname = usePathname();
  const encounterMatch = pathname.match(/\/campaigns\/([^/]+)\/encounters\/([^/]+)/);
  const sessionMatch = pathname.match(/\/sessions\/([^/]+)\/live/);
  const campaignSlugMatch = pathname.match(/\/campaigns\/([^/]+)/);
  const campaignSlug = campaignSlugMatch?.[1] ?? null;

  const { data: campaignData } = trpc.campaigns.getBySlug.useQuery(
    { slug: campaignSlug! },
    { enabled: !!campaignSlug }
  );

  return {
    campaignSlug,
    campaignId: campaignData?.id ?? null,
    currentPlanId: encounterMatch?.[2] ?? null,
    currentSessionId: sessionMatch?.[1] ?? null,
  };
}
