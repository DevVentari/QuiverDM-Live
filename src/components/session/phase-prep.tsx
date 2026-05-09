'use client';

import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import { Play } from 'lucide-react';
import { SessionPrepDataSchema, emptyPrepData } from '@/lib/prep-types';
import { PrepWorkspace } from '@/components/session/prep/prep-workspace';

interface PhasePrepProps {
  session: Record<string, unknown>;
  slug: string;
  campaignId: string;
  onStatusChange: () => void;
}

export function PhasePrep({ session, slug, campaignId, onStatusChange }: PhasePrepProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const sessionId = session.id as string;

  const contextQuery = trpc.sessions.getPrepContext.useQuery(
    { campaignId },
    { enabled: !!campaignId }
  );

  const acceptCards = trpc.sessions.acceptBriefingCards.useMutation();
  const startSession = trpc.sessions.update.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: sessionId });
      onStatusChange();
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  async function handleReadyToRun() {
    try {
      await acceptCards.mutateAsync({ sessionId, campaignId });
    } catch {
      // Non-fatal — proceed even if no spatial cards
    }
    startSession.mutate({ id: sessionId, status: 'in_progress' });
  }

  const initialData = useMemo(() => {
    const parsed = SessionPrepDataSchema.safeParse((session as any).prepData);
    const base = parsed.success ? parsed.data : emptyPrepData();

    if (base.characterNotes.length > 0) return base;

    const characters = (contextQuery.data?.characters ?? []) as Array<{ id: string; name: string }>;
    return {
      ...base,
      characterNotes: characters.map((character) => ({
        characterId: character.id,
        name: character.name,
        goals: '',
        notes: '',
      })),
    };
  }, [session, contextQuery.data]);

  if (contextQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!contextQuery.data) return null;

  return (
    <div className="space-y-4">
      <PrepWorkspace
        sessionId={sessionId}
        initialData={initialData}
        campaignContext={contextQuery.data as any}
        slug={slug}
        campaignId={campaignId}
        initialTitle={(session as any).title ?? 'Session'}
        prepStatus={(session as any).prepStatus ?? 'draft'}
        inline
        onComplete={onStatusChange}
      />
      <button
        onClick={handleReadyToRun}
        disabled={acceptCards.isPending || startSession.isPending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-sm font-[var(--q-font-display)] text-sm tracking-widest uppercase transition-colors disabled:opacity-50"
        style={{
          background: 'linear-gradient(180deg, hsl(35 60% 22%) 0%, hsl(35 55% 17%) 100%)',
          border: '1px solid hsl(35 60% 32%)',
          color: 'hsl(35 85% 65%)',
          boxShadow: '0 0 24px hsl(35 60% 20% / 0.5), inset 0 1px 0 hsl(35 80% 50% / 0.15)',
        }}
      >
        <Play className="h-4 w-4" />
        Ready to Run
      </button>
    </div>
  );
}
