'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAutoSave } from '@/hooks/use-auto-save';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { emptyPrepData, type SessionPrepData } from '@/lib/prep-types';
import { PrepHeader } from './prep-header';
import { PrepSectionNav, PREP_SECTIONS, type SectionId } from './prep-section-nav';
import { PrepSectionCard } from './prep-section-card';
import { PrepImportZone } from './prep-import-zone';
import { StepCharacters } from './steps/step-characters';
import { StepStrongStart } from './steps/step-strong-start';
import { StepScenes } from './steps/step-scenes';
import { StepSecrets } from './steps/step-secrets';
import { StepNpcs } from './steps/step-npcs';
import { StepMonsters } from './steps/step-monsters';
import { StepRewards } from './steps/step-rewards';
import { StepLooseThreads } from './steps/step-loose-threads';

const SECTION_DESCRIPTIONS: Record<SectionId, string> = {
  'characters':   'Who are your players, and what do they want?',
  'strong-start': 'How does tonight begin?',
  'scenes':       'What scenes might unfold?',
  'secrets':      'What secrets can be discovered?',
  'npcs':         'Who will the party encounter?',
  'monsters':     'What dangers lurk ahead?',
  'rewards':      'What spoils await the brave?',
  'threads':      'What threads remain unresolved?',
};

type CampaignContext = {
  characters: any[];
  npcs: any[];
  recentSessions: any[];
  homebrew: any[];
};

interface PrepWorkspaceProps {
  sessionId: string;
  initialData: SessionPrepData;
  campaignContext: CampaignContext;
  slug: string;
  initialTitle: string;
  prepStatus?: string;
}

export function PrepWorkspace({
  sessionId,
  initialData,
  campaignContext,
  slug,
  initialTitle,
  prepStatus = 'draft',
}: PrepWorkspaceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { campaignId } = useCampaign();

  const [prepData, setPrepData] = useState<SessionPrepData>(initialData ?? emptyPrepData());
  const [title, setTitle] = useState(initialTitle);
  const [activeSection, setActiveSection] = useState<SectionId | undefined>(undefined);
  const [suggestedCounts, setSuggestedCounts] = useState<Record<string, number>>({});

  const updatePrep = trpc.sessions.updatePrep.useMutation();
  const updateSession = trpc.sessions.update.useMutation();
  const completePrep = trpc.sessions.completePrep.useMutation({
    onSuccess: () => {
      toast({ title: 'Prep marked complete' });
      router.push(`/campaigns/${slug}/sessions/${sessionId}`);
    },
    onError: (error) =>
      toast({ title: 'Failed to complete prep', description: error.message, variant: 'destructive' }),
  });

  const savePayload = useMemo(() => ({ prepData, title }), [prepData, title]);

  const onSave = useCallback(
    async (payload: typeof savePayload) => {
      await updatePrep.mutateAsync({ id: sessionId, prepData: payload.prepData });
      await updateSession.mutateAsync({ id: sessionId, title: payload.title });
    },
    [sessionId, updatePrep, updateSession]
  );

  const { status: saveStatus } = useAutoSave(savePayload, onSave, 2000);

  const completedSections = useMemo((): Set<SectionId> => {
    const s = new Set<SectionId>();
    if (prepData.characterNotes.some((n: any) => n.goals || n.notes)) s.add('characters');
    if (prepData.strongStart) s.add('strong-start');
    if (prepData.scenes.length > 0) s.add('scenes');
    if (prepData.secretsAndClues.length > 0) s.add('secrets');
    if (prepData.npcs.length > 0) s.add('npcs');
    if (prepData.monsters.length > 0) s.add('monsters');
    if (prepData.rewards.length > 0) s.add('rewards');
    if (prepData.looseThreads.length > 0) s.add('threads');
    return s;
  }, [prepData]);

  function handleExtracted(extracted: Partial<SessionPrepData>, counts: Record<string, number>) {
    setSuggestedCounts(counts);
    const importedAt = new Date().toISOString();
    setPrepData((prev) => ({
      ...prev,
      strongStart: extracted.strongStart ?? prev.strongStart,
      scenes: extracted.scenes?.length ? [...prev.scenes, ...extracted.scenes] : prev.scenes,
      secretsAndClues: extracted.secretsAndClues?.length
        ? [...prev.secretsAndClues, ...extracted.secretsAndClues]
        : prev.secretsAndClues,
      npcs: extracted.npcs?.length ? [...prev.npcs, ...extracted.npcs] : prev.npcs,
      monsters: extracted.monsters?.length ? [...prev.monsters, ...extracted.monsters] : prev.monsters,
      rewards: extracted.rewards?.length ? [...prev.rewards, ...extracted.rewards] : prev.rewards,
      looseThreads: extracted.looseThreads?.length
        ? [...prev.looseThreads, ...extracted.looseThreads]
        : prev.looseThreads,
      importedNotes: [
        ...(prev.importedNotes ?? []),
        { extractedAt: importedAt, sectionCounts: counts },
      ],
    }));
  }

  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const lastImport = prepData.importedNotes?.[prepData.importedNotes.length - 1];

  return (
    <div className="flex flex-col min-h-screen">
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
      />

      <div className="flex flex-1">
        <aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r border-border/50 bg-card/30 sticky top-0 self-start h-screen overflow-y-auto">
          <PrepSectionNav
            completedSections={completedSections}
            activeSection={activeSection}
            onSectionClick={scrollToSection}
          />
        </aside>

        <main className="flex-1">
          <div className="px-6 py-8 space-y-4">
            <PrepImportZone
              sessionId={sessionId}
              campaignId={campaignId}
              onExtracted={handleExtracted}
              lastImportedAt={lastImport?.extractedAt}
            />

            <PrepSectionCard id="characters" title="Review Characters" description={SECTION_DESCRIPTIONS['characters']}
              defaultOpen={completedSections.has('characters')} onExpand={() => setActiveSection('characters')}>
              <StepCharacters characterNotes={prepData.characterNotes}
                onChange={(notes) => setPrepData((p) => ({ ...p, characterNotes: notes }))} />
            </PrepSectionCard>

            <PrepSectionCard id="strong-start" title="Strong Start" description={SECTION_DESCRIPTIONS['strong-start']}
              suggestedCount={suggestedCounts['strong-start']} defaultOpen={!!prepData.strongStart}
              onExpand={() => setActiveSection('strong-start')}>
              <StepStrongStart sessionId={sessionId} value={prepData.strongStart}
                onChange={(v) => setPrepData((p) => ({ ...p, strongStart: v }))} />
            </PrepSectionCard>

            <PrepSectionCard id="scenes" title="Potential Scenes" description={SECTION_DESCRIPTIONS['scenes']}
              suggestedCount={suggestedCounts['scenes']} defaultOpen={prepData.scenes.length > 0}
              onExpand={() => setActiveSection('scenes')}>
              <StepScenes sessionId={sessionId} scenes={prepData.scenes} strongStart={prepData.strongStart}
                onChange={(scenes) => setPrepData((p) => ({ ...p, scenes }))} />
            </PrepSectionCard>

            <PrepSectionCard id="secrets" title="Secrets & Clues" description={SECTION_DESCRIPTIONS['secrets']}
              suggestedCount={suggestedCounts['secrets']} defaultOpen={prepData.secretsAndClues.length > 0}
              onExpand={() => setActiveSection('secrets')}>
              <StepSecrets sessionId={sessionId} secrets={prepData.secretsAndClues}
                onChange={(secretsAndClues) => setPrepData((p) => ({ ...p, secretsAndClues }))} />
            </PrepSectionCard>

            <PrepSectionCard id="npcs" title="Featured NPCs" description={SECTION_DESCRIPTIONS['npcs']}
              suggestedCount={suggestedCounts['npcs']} defaultOpen={prepData.npcs.length > 0}
              onExpand={() => setActiveSection('npcs')}>
              <StepNpcs npcs={prepData.npcs} campaignNpcs={campaignContext.npcs}
                onChange={(npcs) => setPrepData((p) => ({ ...p, npcs }))} />
            </PrepSectionCard>

            <PrepSectionCard id="monsters" title="Monsters" description={SECTION_DESCRIPTIONS['monsters']}
              suggestedCount={suggestedCounts['monsters']} defaultOpen={prepData.monsters.length > 0}
              onExpand={() => setActiveSection('monsters')}>
              <StepMonsters monsters={prepData.monsters}
                onChange={(monsters) => setPrepData((p) => ({ ...p, monsters }))} />
            </PrepSectionCard>

            <PrepSectionCard id="rewards" title="Rewards" description={SECTION_DESCRIPTIONS['rewards']}
              suggestedCount={suggestedCounts['rewards']} defaultOpen={prepData.rewards.length > 0}
              onExpand={() => setActiveSection('rewards')}>
              <StepRewards rewards={prepData.rewards}
                onChange={(rewards) => setPrepData((p) => ({ ...p, rewards }))} />
            </PrepSectionCard>

            <PrepSectionCard id="threads" title="Loose Threads" description={SECTION_DESCRIPTIONS['threads']}
              suggestedCount={suggestedCounts['threads']} defaultOpen={prepData.looseThreads.length > 0}
              onExpand={() => setActiveSection('threads')}>
              <StepLooseThreads sessionId={sessionId} threads={prepData.looseThreads}
                onChange={(looseThreads) => setPrepData((p) => ({ ...p, looseThreads }))} />
            </PrepSectionCard>
          </div>
        </main>
      </div>

      <div className="md:hidden border-t border-border/50 px-4 py-3 flex items-center justify-between"
        style={{ background: 'hsl(240 10% 5% / 0.97)', backdropFilter: 'blur(12px)' }}>
        <span className="text-xs" style={{ color: 'hsl(35 10% 48%)' }}>
          {completedSections.size} / {PREP_SECTIONS.length} sections
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
    </div>
  );
}
