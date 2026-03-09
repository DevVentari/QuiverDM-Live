'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { VoiceProvider } from './voice-provider';
import { classifyIntent } from '@/lib/voice/intent-classifier';
import { routeAction } from '@/lib/voice/action-router';
import type { ReactNode } from 'react';

function useCampaignSlugFromPath(): string | null {
  const pathname = usePathname();
  const match = pathname.match(/\/campaigns\/([^/]+)/);
  return match?.[1] ?? null;
}

export function CampaignVoiceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const slug = useCampaignSlugFromPath();
  const campaignQuery = trpc.campaigns.getBySlug.useQuery(
    { slug: slug! },
    { enabled: !!slug, staleTime: 300_000 }
  );
  const campaignId = (campaignQuery.data as { id?: string } | undefined)?.id;

  const voiceQueryMutation = trpc.brain.voiceQuery.useMutation();

  const handleCommand = useCallback(async (transcript: string): Promise<string> => {
    const intent = classifyIntent(transcript);
    const action = routeAction(intent, slug ?? null);

    if (action.navigateTo) {
      if (action.response) {
        setTimeout(() => router.push(action.navigateTo!), 600);
      } else {
        router.push(action.navigateTo);
      }
      return action.response || `Navigating to ${intent.target}.`;
    }

    if (action.response) {
      return action.response;
    }

    if (!campaignId) {
      return 'Open a campaign to query the DM Brain.';
    }

    try {
      const answer = await voiceQueryMutation.mutateAsync({ campaignId, query: transcript });
      return answer;
    } catch {
      return 'Could not query the DM Brain. Try again.';
    }
  }, [campaignId, slug, router, voiceQueryMutation]);

  return (
    <VoiceProvider onCommand={handleCommand}>
      {children}
    </VoiceProvider>
  );
}
