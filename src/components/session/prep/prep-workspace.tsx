'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAutoSave } from '@/hooks/use-auto-save';
import { trpc } from '@/lib/trpc';
import { emptyPrepData, type SessionPrepData } from '@/lib/prep-types';
import { PrepHeader } from './prep-header';
import { PrepImportZone } from './prep-import-zone';
import { BriefingBoard } from './briefing-board';
import { PartyStateSection } from './party-state-section';
import type { BriefingCard } from '@/lib/briefing-types';

type CampaignContext = {
  characters: any[];
  npcs: any[];
  recentSessions: any[];
  homebrew: any[];
};

function migrateNpcIds(data: SessionPrepData): SessionPrepData {
  const needsMigration = data.npcs.some(npc => !npc.id);
  if (!needsMigration) return data;
  return {
    ...data,
    npcs: data.npcs.map(npc => npc.id ? npc : { ...npc, id: npc.npcId ?? crypto.randomUUID() }),
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

  const [prepData, setPrepData] = useState<SessionPrepData>(() => migrateNpcIds(initialData ?? emptyPrepData()));
  const [title, setTitle] = useState(initialTitle);

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
      toast({ title: 'Failed to complete prep', description: error.message, variant: 'destructive' }),
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

  function handleExtracted(extracted: Partial<SessionPrepData>) {
    const parts: string[] = [];
    if (extracted.strongStart) parts.push(`Strong start: ${extracted.strongStart}`);
    if (extracted.scenes?.length) parts.push(`Scenes: ${extracted.scenes.map((s) => s.title).join(', ')}`);
    if (extracted.npcs?.length) parts.push(`NPCs: ${extracted.npcs.map((n) => n.name).join(', ')}`);
    if (extracted.looseThreads?.length) parts.push(`Threads: ${extracted.looseThreads.map((t) => t.text.slice(0, 60)).join(', ')}`);

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
      importedNotes: [...(p.importedNotes ?? []), { extractedAt: importedAt, sectionCounts: {} }],
    }));
  }

  const lastImport = prepData.importedNotes?.[prepData.importedNotes.length - 1];

  return (
    <div className={inline ? 'flex flex-col' : 'flex flex-col min-h-screen'}>
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

      <div className="flex flex-1">
        <main className="flex-1 min-w-0">
          <div className="px-6 py-6 space-y-6">
            <PrepImportZone
              sessionId={sessionId}
              campaignId={campaignId}
              onExtracted={(data) => handleExtracted(data)}
              lastImportedAt={lastImport?.extractedAt}
            />

            <BriefingBoard
              sessionId={sessionId}
              campaignId={campaignId}
              cards={prepData.briefingCards ?? []}
              onCardsChange={(cards) => setPrepData((p) => ({ ...p, briefingCards: cards }))}
            />

            <PartyStateSection
              characterNotes={prepData.characterNotes}
              campaignCharacters={(campaignContext.characters ?? []) as Array<{ id: string; name: string; class?: string | null }>}
              onChange={(notes) => setPrepData((p) => ({ ...p, characterNotes: notes }))}
            />
          </div>
        </main>
      </div>

      {!inline && (
        <div className="md:hidden border-t border-border/50 px-4 py-3 flex items-center justify-between"
          style={{ background: 'hsl(240 10% 5% / 0.97)', backdropFilter: 'blur(12px)' }}>
          <span className="text-xs" style={{ color: 'hsl(35 10% 48%)' }}>
            {(prepData.briefingCards ?? []).filter((c) => c.status !== 'proposed').length} /{' '}
            {(prepData.briefingCards ?? []).length} reviewed
          </span>
          <button
            onClick={() => completePrep.mutate({ id: sessionId })}
            disabled={completePrep.isPending}
            className="text-xs font-semibold px-3 py-1.5 rounded-sm"
            style={{ background: 'hsl(35 70% 18%)', border: '1px solid hsl(35 60% 32%)', color: 'hsl(35 80% 65%)' }}
          >
            {completePrep.isPending ? 'Saving…' : 'Mark Complete'}
          </button>
        </div>
      )}
    </div>
  );
}
