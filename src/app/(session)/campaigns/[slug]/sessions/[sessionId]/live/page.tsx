'use client';

import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useLiveTranscription } from '@/hooks/useLiveTranscription';
import { CockpitHeader } from '@/components/cockpit/cockpit-header';
import { PartyOverviewPanel } from '@/components/cockpit/party-overview-panel';
import { LiveNotesPanel } from '@/components/cockpit/live-notes-panel';
import { CombatPanel } from '@/components/cockpit/combat-panel';
import { PrepReferencePanel } from '@/components/cockpit/prep-reference-panel';
import { NpcQuickRecall } from '@/components/cockpit/npc-quick-recall';
import { CockpitToolbar } from '@/components/cockpit/cockpit-toolbar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SessionPrepDataSchema } from '@/lib/prep-types';

export default function SessionCockpitPage() {
  const params = useParams();
  const slug = params.slug as string;
  const sessionId = params.sessionId as string;

  const [mode, setMode] = useState<'rp' | 'combat'>('rp');

  const sessionQuery = trpc.sessions.getById.useQuery({ id: sessionId });
  const campaignQuery = trpc.campaigns.getBySlug.useQuery({ slug });

  const transcription = useLiveTranscription(sessionId);

  const initStates = trpc.sessions.initCharacterSessionStates.useMutation();

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'rp' ? 'combat' : 'rp'));
  }, []);

  const handleToggleRecording = useCallback(async () => {
    if (transcription.isRecording) {
      await transcription.stop();
    } else {
      await transcription.start();
    }
  }, [transcription]);

  const campaignId = (campaignQuery.data as any)?.id as string | undefined;
  useEffect(() => {
    if (!campaignId) return;
    initStates.mutate({ campaignId, sessionId });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, sessionId]);


  if (sessionQuery.isLoading || campaignQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-3 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  const session = sessionQuery.data;
  const campaign = campaignQuery.data as any;

  if (!session || !campaign) {
    return (
      <div className="flex h-screen items-center justify-center text-destructive">
        Session not found
      </div>
    );
  }

  const rawSession = session as any;
  const prepData = rawSession.prepData
    ? SessionPrepDataSchema.safeParse(rawSession.prepData).data ?? null
    : null;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <CockpitHeader
        sessionTitle={session.title ?? `Session ${session.sessionNumber}`}
        sessionNumber={session.sessionNumber}
        isRecording={transcription.isRecording}
        mode={mode}
        onModeToggle={toggleMode}
        onToggleRecording={handleToggleRecording}
        sessionId={sessionId}
        campaignId={campaign.id}
      />

      {/* 3-column grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Party State */}
        <div className="w-60 shrink-0 border-r border-border overflow-y-auto">
          <PartyOverviewPanel campaignId={campaign.id} sessionId={sessionId} />
        </div>

        {/* Center: RP or Combat */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {mode === 'rp' ? (
            <LiveNotesPanel
              sessionId={sessionId}
              initialNotes={session.quickNotes ?? ''}
              dmHints={transcription.dmHints}
            />
          ) : (
            <CombatPanel sessionId={sessionId} />
          )}
        </div>

        {/* Right: Prep + NPCs */}
        <div className="w-80 shrink-0 border-l border-border overflow-hidden flex flex-col">
          <Tabs defaultValue="prep" className="flex flex-col h-full">
            <TabsList className="shrink-0 w-full rounded-none border-b border-border bg-transparent h-10">
              <TabsTrigger value="prep" className="flex-1 text-xs">Prep</TabsTrigger>
              <TabsTrigger value="npcs" className="flex-1 text-xs">NPCs</TabsTrigger>
            </TabsList>
            <TabsContent value="prep" className="flex-1 overflow-y-auto m-0 p-3">
              <PrepReferencePanel prepData={prepData} />
            </TabsContent>
            <TabsContent value="npcs" className="flex-1 overflow-y-auto m-0 p-3">
              <NpcQuickRecall campaignId={campaign.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <CockpitToolbar
        sessionId={sessionId}
        slug={slug}
        mode={mode}
        onToggleMode={toggleMode}
      />
    </div>
  );
}
