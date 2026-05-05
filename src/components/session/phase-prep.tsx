'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
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

  const startSession = trpc.sessions.update.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: sessionId });
      onStatusChange();
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

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
        initialTitle={(session as any).title ?? 'Session'}
        prepStatus={(session as any).prepStatus ?? 'draft'}
        inline
        onComplete={onStatusChange}
      />
      <Button
        size="sm"
        onClick={() => startSession.mutate({ id: sessionId, status: 'in_progress' })}
        disabled={startSession.isPending}
        className="w-full"
      >
        <Play className="mr-1.5 h-3.5 w-3.5" />
        Ready to Run
      </Button>
    </div>
  );
}
