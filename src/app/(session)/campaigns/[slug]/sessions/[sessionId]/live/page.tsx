'use client';

import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { track, EVENTS } from '@/lib/analytics';
import { useLiveTranscription } from '@/hooks/useLiveTranscription';
import { CockpitHeader } from '@/components/cockpit/cockpit-header';
import { PartyOverviewPanel } from '@/components/cockpit/party-overview-panel';
import { LiveNotesPanel } from '@/components/cockpit/live-notes-panel';
import { CombatPanel } from '@/components/cockpit/combat-panel';
import { SceneRunner } from '@/components/cockpit/scene-runner';
import { SceneContextPanel } from '@/components/cockpit/scene-context-panel';
import { NpcQuickRecall } from '@/components/cockpit/npc-quick-recall';
import { BrainCockpitPanel } from '@/components/cockpit/brain-cockpit-panel';
import { CoDMPanel } from '@/components/cockpit/co-dm-panel';
import { CockpitToolbar } from '@/components/cockpit/cockpit-toolbar';
import { BattleMapPanel } from '@/components/cockpit/battle-map-panel';
import { InitiativePanel } from '@/components/cockpit/initiative-panel';
import { SessionIntelDrawer } from '@/components/cockpit/session-intel-drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SessionPrepDataSchema } from '@/lib/prep-types';

export default function SessionCockpitPage() {
  const params = useParams();
  const slug = params.slug as string;
  const sessionId = params.sessionId as string;

  const [mode, setMode] = useState<'rp' | 'combat'>('rp');

  // Scene runner state
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isSceneExpanded, setIsSceneExpanded] = useState(false);
  const prevSceneIndexRef = useRef(activeSceneIndex);

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

  const rawSession = sessionQuery.data as any;
  const prepData = rawSession?.prepData
    ? SessionPrepDataSchema.safeParse(rawSession.prepData).data ?? null
    : null;

  const scenes = prepData?.scenes ?? [];
  const sourceIds = scenes.map((s: any) => s.sourceId).filter(Boolean) as string[];
  const sourcebookScenesQuery = trpc.sourcebookScenes.getByIds.useQuery(
    { campaignId: campaignId ?? '', ids: sourceIds },
    { enabled: !!campaignId && sourceIds.length > 0 }
  );
  const sourcebookScenes = (sourcebookScenesQuery.data ?? []) as any[];

  useEffect(() => {
    if (!campaignId) return;
    initStates.mutate({ campaignId, sessionId });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, sessionId]);

  useEffect(() => {
    track(EVENTS.SESSION_STARTED, { session_id: sessionId });
  }, [sessionId]);

  // Initialise from persisted session value
  useEffect(() => {
    const s = sessionQuery.data as any;
    if (s?.activeSceneIndex != null) {
      setActiveSceneIndex(s.activeSceneIndex);
    }
  }, [sessionQuery.data]);

  // Expand card whenever scene advances
  useEffect(() => {
    if (activeSceneIndex !== prevSceneIndexRef.current) {
      setIsSceneExpanded(true);
      prevSceneIndexRef.current = activeSceneIndex;
    }
  }, [activeSceneIndex]);

  // Persist active scene
  const updateActiveScene = trpc.sessions.updateActiveScene.useMutation();
  const debouncedUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNavigate = (index: number) => {
    setActiveSceneIndex(index);
    if (debouncedUpdateRef.current) clearTimeout(debouncedUpdateRef.current);
    debouncedUpdateRef.current = setTimeout(() => {
      if (campaignId) {
        updateActiveScene.mutate({ campaignId, sessionId, sceneIndex: index });
      }
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (debouncedUpdateRef.current) clearTimeout(debouncedUpdateRef.current);
    };
  }, []);

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
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: Party State */}
        <div className="w-60 shrink-0 border-r border-[var(--q-border)] overflow-y-auto">
          <PartyOverviewPanel campaignId={campaign.id} sessionId={sessionId} />
        </div>

        {/* Center: SceneRunner + RP or Combat */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Scene runner always visible above notes/combat */}
          <SceneRunner
            scenes={scenes.slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))}
            activeIndex={activeSceneIndex}
            isExpanded={isSceneExpanded}
            onNavigate={handleNavigate}
            onExpandToggle={setIsSceneExpanded}
          />

          {/* Notes/combat below */}
          <div
            className="flex-1 overflow-hidden"
            onClick={() => setIsSceneExpanded(false)}
          >
            {mode === 'rp' ? (
              <LiveNotesPanel
                sessionId={sessionId}
                initialNotes={session.quickNotes ?? ''}
                dmHints={transcription.dmHints}
              />
            ) : (
              <BattleMapPanel campaignId={campaign.id} sessionId={sessionId} />
            )}
          </div>
        </div>

        {/* Right: Scene + NPCs */}
        <div className="w-80 shrink-0 border-l border-[var(--q-border)] overflow-hidden flex flex-col">
          <Tabs defaultValue="scene" className="flex flex-col h-full">
            <TabsList className="shrink-0 w-full rounded-none border-b border-[var(--q-border)] bg-transparent h-10">
              <TabsTrigger value="scene" className="flex-1 text-xs">Scene</TabsTrigger>
              <TabsTrigger value="npcs" className="flex-1 text-xs">NPCs</TabsTrigger>
              <TabsTrigger value="brain" className="flex-1 text-xs">Brain</TabsTrigger>
              <TabsTrigger value="co-dm" className="flex-1 text-xs">Co-DM</TabsTrigger>
              <TabsTrigger value="initiative" className="flex-1 text-xs">Initiative</TabsTrigger>
            </TabsList>
            <TabsContent value="scene" className="flex-1 overflow-y-auto m-0 p-3">
              <SceneContextPanel
                activeScene={scenes[activeSceneIndex] ?? null}
                prepData={prepData}
                sourcebookScenes={sourcebookScenes}
              />
            </TabsContent>
            <TabsContent value="npcs" className="flex-1 overflow-y-auto m-0 p-3">
              <NpcQuickRecall campaignId={campaign.id} />
            </TabsContent>
            <TabsContent value="brain" className="flex-1 overflow-y-auto m-0 p-3">
              <BrainCockpitPanel campaignId={campaign.id} />
            </TabsContent>
            <TabsContent value="co-dm" className="flex-1 overflow-y-auto m-0 p-3">
              <CoDMPanel sessionId={sessionId} />
            </TabsContent>
            <TabsContent value="initiative" className="flex-1 overflow-y-auto m-0 p-3">
              <InitiativePanel campaignId={campaign.id} sessionId={sessionId} />
            </TabsContent>
          </Tabs>
        </div>

        {campaignId && (
          <SessionIntelDrawer
            campaignId={campaignId}
            sessionId={sessionId}
            intentBrief={
              (rawSession?.intentBrief as
                | { toneKeywords: string[]; playerGoals: string[]; dmOnlyTruths: string[] }
                | null
                | undefined) ?? null
            }
          />
        )}
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
