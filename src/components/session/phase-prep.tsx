'use client';

import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';
import { Swords } from 'lucide-react';
import { PrepStatusCard } from '@/components/session/prep-status-card';

interface PhasePrepProps {
  session: Record<string, unknown>;
  slug: string;
  campaignId: string;
  onStatusChange: () => void;
}

export function PhasePrep({ session, slug, campaignId: _campaignId, onStatusChange }: PhasePrepProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const sessionId = session.id as string;

  const startSession = trpc.sessions.update.useMutation({
    onSuccess: () => {
      void utils.sessions.getById.invalidate({ id: sessionId });
      onStatusChange();
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <PrepStatusCard session={session} sessionId={sessionId} slug={slug} />
      <Button
        size="sm"
        onClick={() => startSession.mutate({ id: sessionId, status: 'in_progress' })}
        disabled={startSession.isPending}
        className="w-full"
      >
        <Swords className="mr-1.5 h-3.5 w-3.5" />
        Mark as Run
      </Button>
    </div>
  );
}
