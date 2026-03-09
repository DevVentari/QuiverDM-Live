'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { VoiceProvider } from './voice-provider';
import type { ReactNode } from 'react';

const QUERY_TIMEOUT_MS = 5000;

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

  const [search, setSearch] = useState('');
  const entitiesQuery = trpc.brain.entities.list.useQuery(
    { campaignId: campaignId ?? '', search },
    { enabled: false, staleTime: 0 }
  );

  const resolveRef = useRef<((value: string) => void) | null>(null);
  const rejectRef = useRef<((reason: unknown) => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      rejectRef.current?.('Component unmounted');
      rejectRef.current = null;
      resolveRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!resolveRef.current || !entitiesQuery.data || !mountedRef.current) return;

    const results = entitiesQuery.data;
    const response = results.length === 0
      ? `No entities found matching "${search}".`
      : `Found: ${results.slice(0, 3).map((e) => `${e.name} (${e.type})`).join(', ')}.`;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    resolveRef.current(response);
    resolveRef.current = null;
    rejectRef.current = null;
  }, [entitiesQuery.data, search]);

  const handleBrainQuery = useCallback(async (transcript: string): Promise<string> => {
    if (!campaignId) {
      return 'Open a campaign to query the DM Brain.';
    }

    rejectRef.current?.('New query started');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    return new Promise<string>((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;

      timeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          resolve('Brain query timed out. Try again.');
        }
        resolveRef.current = null;
        rejectRef.current = null;
      }, QUERY_TIMEOUT_MS);

      setSearch(transcript);
      entitiesQuery.refetch();
    });
  }, [campaignId, entitiesQuery]);

  return (
    <VoiceProvider onQuery={handleBrainQuery}>
      {children}
    </VoiceProvider>
  );
}
