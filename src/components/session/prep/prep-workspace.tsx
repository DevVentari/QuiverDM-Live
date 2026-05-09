'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAutoSave } from '@/hooks/use-auto-save';
import { trpc } from '@/lib/trpc';
import { emptyPrepData, type SessionPrepData } from '@/lib/prep-types';
import { PrepHeader } from './prep-header';
import { PrepImportButton } from './prep-import-button';
import { BriefingBoard } from './briefing-board';
import { PartyStateSection } from './party-state-section';
import { PrepMapCanvas } from './prep-map-canvas';
import { BriefingPinCard } from './briefing-pin-card';
import type { BriefingCard } from '@/lib/briefing-types';

type CampaignContext = {
  characters: any[];
  npcs: any[];
  recentSessions: any[];
  homebrew: any[];
};

function migrateNpcIds(data: SessionPrepData): SessionPrepData {
  const needsMigration = data.npcs.some((npc) => !npc.id);
  if (!needsMigration) return data;
  return {
    ...data,
    npcs: data.npcs.map((npc) =>
      npc.id ? npc : { ...npc, id: npc.npcId ?? crypto.randomUUID() }
    ),
  };
}

interface PrepWorkspaceProps {
  sessionId: string;
  initialData: SessionPrepData;
  campaignContext: CampaignContext;
  slug: string;
  campaignId: string;
  initialTitle: string;
  prepStatus?: string;
  inline?: boolean;
  onComplete?: () => void;
}

export function PrepWorkspace({
  sessionId,
  initialData,
  campaignContext,
  slug,
  campaignId,
  initialTitle,
  prepStatus = 'draft',
  inline = false,
  onComplete,
}: PrepWorkspaceProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [prepData, setPrepData] = useState<SessionPrepData>(() =>
    migrateNpcIds(initialData ?? emptyPrepData())
  );
  const [title, setTitle] = useState(initialTitle);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);

  const updatePrep = trpc.sessions.updatePrep.useMutation();
  const updateSession = trpc.sessions.update.useMutation();
  const completePrep = trpc.sessions.completePrep.useMutation({
    onSuccess: () => {
      if (onComplete) {
        onComplete();
      } else {
        toast({ title: 'Prep marked complete' });
        router.push(`/campaigns/${slug}/sessions/${sessionId}`);
      }
    },
    onError: (error) =>
      toast({
        title: 'Failed to complete prep',
        description: error.message,
        variant: 'destructive',
      }),
  });

  useEffect(() => {
    const needsMigration = initialData.npcs.some((npc) => !npc.id);
    if (!needsMigration) return;
    updatePrep.mutate({ id: sessionId, prepData: migrateNpcIds(initialData) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const savePayload = useMemo(() => ({ prepData, title }), [prepData, title]);
  const onSave = useCallback(
    async (payload: typeof savePayload) => {
      await updatePrep.mutateAsync({ id: sessionId, prepData: payload.prepData });
      await updateSession.mutateAsync({ id: sessionId, title: payload.title });
    },
    [sessionId, updatePrep, updateSession]
  );
  const { status: saveStatus } = useAutoSave(savePayload, onSave, 2000);

  function updateCard(updated: BriefingCard) {
    setPrepData((p) => ({
      ...p,
      briefingCards: (p.briefingCards ?? []).map((c) =>
        c.id === updated.id ? updated : c
      ),
    }));
  }

  function handleExtracted(data: Partial<SessionPrepData>, _sectionCounts: Record<string, number>) {
    const parts: string[] = [];
    if (data.strongStart) parts.push(`Strong start: ${data.strongStart}`);
    if (data.scenes?.length)
      parts.push(`Scenes: ${data.scenes.map((s) => s.title).join(', ')}`);
    if (data.npcs?.length)
      parts.push(`NPCs: ${data.npcs.map((n) => n.name).join(', ')}`);
    if (data.looseThreads?.length)
      parts.push(
        `Threads: ${data.looseThreads.map((t) => t.text.slice(0, 60)).join(', ')}`
      );
    if (parts.length === 0) return;

    const card: BriefingCard = {
      id: crypto.randomUUID(),
      type: 'CUSTOM',
      entityName: 'Imported Notes',
      urgencyLevel: 3,
      context: 'Extracted from your imported notes.',
      proposal: parts.join('\n'),
      status: 'dm-added',
    };
    const importedAt = new Date().toISOString();
    setPrepData((p) => ({
      ...p,
      briefingCards: [...(p.briefingCards ?? []), card],
      importedNotes: [
        ...(p.importedNotes ?? []),
        { extractedAt: importedAt, sectionCounts: {} },
      ],
    }));
  }

  function handleCardDrop(card: BriefingCard, x: number, y: number, mapId: string) {
    setPrepData((p) => ({
      ...p,
      briefingCards: (p.briefingCards ?? []).map((c) =>
        c.id === card.id
          ? { ...c, mapCoords: { placement: 'proposed' as const, mapId, x, y } }
          : c
      ),
    }));
  }

  const allCards = prepData.briefingCards ?? [];
  const spatialCards = allCards.filter((c) => !!c.mapCoords);
  const railCards = allCards.filter((c) => !c.mapCoords);

  const focusedCard = focusedCardId
    ? allCards.find((c) => c.id === focusedCardId) ?? null
    : null;

  const lastImport = prepData.importedNotes?.[prepData.importedNotes.length - 1];

  return (
    <div className={inline ? 'flex flex-col flex-1 min-h-0' : 'flex flex-col h-screen'}>
      {!inline && (
        <PrepHeader
          title={title}
          onTitleChange={setTitle}
          saveStatus={saveStatus}
          slug={slug}
          onComplete={() => completePrep.mutate({ id: sessionId })}
          isCompleting={completePrep.isPending}
          prepStatus={prepStatus}
          isFullscreen={false}
          onToggleFullscreen={() => {}}
          sessionId={sessionId}
        />
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left: map + party strip */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <div className="flex-1 relative min-h-0">
            <PrepMapCanvas
              campaignId={campaignId}
              cards={allCards}
              onCardChange={updateCard}
              onCardDrop={handleCardDrop}
            />
          </div>
          <PartyStateSection
            characterNotes={prepData.characterNotes}
            campaignCharacters={
              (campaignContext.characters ?? []) as Array<{
                id: string;
                name: string;
                race?: string | null;
                class?: string | null;
                subclass?: string | null;
                level?: number | null;
                portraitUrl?: string | null;
              }>
            }
            onChange={(notes) => setPrepData((p) => ({ ...p, characterNotes: notes }))}
          />
        </div>

        {/* Right: rail or focused card */}
        <div
          className="w-[300px] xl:w-[320px] shrink-0 flex flex-col border-l overflow-hidden"
          style={{
            borderColor: 'oklch(0.2 0.005 270)',
            background: 'oklch(0.115 0.005 265)',
          }}
        >
          {focusedCard ? (
            <BriefingPinCard
              card={focusedCard}
              onChange={updateCard}
              onClose={() => setFocusedCardId(null)}
            />
          ) : (
            <>
              <PrepImportButton
                sessionId={sessionId}
                campaignId={campaignId}
                lastImportedAt={lastImport?.extractedAt}
                onExtracted={handleExtracted}
              />
              <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-3">
                <BriefingBoard
                  sessionId={sessionId}
                  campaignId={campaignId}
                  cards={railCards}
                  onCardsChange={(updatedRailCards) => {
                    setPrepData((p) => ({
                      ...p,
                      briefingCards: [...spatialCards, ...updatedRailCards],
                    }));
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
