'use client';

import { usePathname } from 'next/navigation';
import { useState, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { VoiceProvider } from './voice-provider';
import type { ReactNode } from 'react';

function useCampaignSlugFromPath(): string | null {
  const pathname = usePathname();
  const match = pathname.match(/\/campaigns\/([^/]+)/);
  return match?.[1] ?? null;
}

export function CampaignVoiceShell({ children }: { children: ReactNode }) {
  const slug = useCampaignSlugFromPath();
  const campaignQuery = trpc.campaigns.getBySlug.useQuery(
    { slug: slug! },
    { enabled: !!slug, staleTime: 300_000 }
  );
  const campaignId = (campaignQuery.data as { id?: string } | undefined)?.id;

  const [search, setSearch] = useState<string | undefined>(undefined);
  const resolveRef = useRef<((value: string) => void) | null>(null);

  const entitiesQuery = trpc.brain.entities.list.useQuery(
    { campaignId: campaignId!, search },
    {
      enabled: !!campaignId && search !== undefined,
      staleTime: 0,
    }
  );

  const handleBrainQuery = useCallback(
    async (transcript: string): Promise<string> => {
      if (!campaignId) {
        return 'Open a campaign to query the DM Brain.';
      }

      return new Promise<string>((resolve) => {
        resolveRef.current = resolve;
        setSearch(transcript);
      });
    },
    [campaignId]
  );

  const prevSearchRef = useRef<string | undefined>(undefined);
  if (
    search !== undefined &&
    search !== prevSearchRef.current &&
    entitiesQuery.data !== undefined &&
    resolveRef.current
  ) {
    prevSearchRef.current = search;
    const results = entitiesQuery.data;
    let response: string;
    if (results.length === 0) {
      response = `No entities found matching "${search}".`;
    } else {
      const names = results
        .slice(0, 3)
        .map((e) => `${e.name} (${e.type})`)
        .join(', ');
      response = `Found: ${names}.`;
    }
    resolveRef.current(response);
    resolveRef.current = null;
  }

  return (
    <VoiceProvider onQuery={handleBrainQuery}>
      {children}
    </VoiceProvider>
  );
}
