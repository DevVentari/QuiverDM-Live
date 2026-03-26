'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Loader2, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAutoSave } from '@/hooks/use-auto-save';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { emptyPrepData, PrepNpcSchema, SceneSchema, type SessionPrepData } from '@/lib/prep-types';
import { PrepHeader } from './prep-header';
import { PrepSectionNav, PREP_SECTIONS, type SectionId } from './prep-section-nav';
import { PrepSectionCard } from './prep-section-card';
import { PrepImportZone } from './prep-import-zone';
import { PrepBrainContextCard } from './prep-brain-context-card';
import { PrepBrainDrawer } from './prep-brain-drawer';
import { StepCharacters } from './steps/step-characters';
import { StepStrongStart } from './steps/step-strong-start';
import { StepScenes } from './steps/step-scenes';
import { StepSecrets } from './steps/step-secrets';
import { StepNpcs } from './steps/step-npcs';
import { StepMonsters } from './steps/step-monsters';
import { StepRewards } from './steps/step-rewards';
import { StepLooseThreads } from './steps/step-loose-threads';

type BrainSectionKey = 'characters' | 'strong-start' | 'scenes' | 'secrets' | 'npcs' | 'monsters' | 'rewards' | 'threads';

interface BrainSuggestionState {
  section: BrainSectionKey;
  text: string;
}

function BrainSuggestButton({
  section,
  campaignId,
  currentContent,
  onSuggest,
}: {
  section: BrainSectionKey;
  campaignId: string;
  currentContent?: string;
  onSuggest: (section: BrainSectionKey, text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const suggest = trpc.brain.sectionSuggest.useMutation();

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    setError(false);
    try {
      const result = await suggest.mutateAsync({ campaignId, section, currentContent });
      setSuggestion(result.suggestion);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleUse = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (suggestion) {
      onSuggest(section, suggestion);
      setSuggestion(null);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSuggestion(null);
    setError(false);
  };

  return (
    <div className="contents">
      <button
        onClick={error ? handleDismiss : suggestion ? undefined : handleClick}
        disabled={loading || !!suggestion}
        title={error ? 'No brain data — click to dismiss' : 'Brain Suggest'}
        className="h-6 w-6 flex items-center justify-center rounded-sm transition-colors hover:bg-white/10 disabled:opacity-40 shrink-0"
        style={{ color: error ? 'hsl(35 10% 40%)' : 'hsl(35 60% 55%)' }}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Brain className="h-3.5 w-3.5" />
        )}
      </button>

      {suggestion && (
        <div
          className="rounded-sm border px-4 py-3 mt-2"
          style={{
            borderColor: 'hsl(35 60% 35% / 0.5)',
            background: 'hsl(35 30% 8% / 0.8)',
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'hsl(35 70% 55%)' }}>
            Brain suggests:
          </p>
          <p className="text-xs mb-3" style={{ color: 'hsl(35 15% 78%)' }}>{suggestion}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUse}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-sm font-medium transition-colors"
              style={{ background: 'hsl(35 50% 18%)', border: '1px solid hsl(35 50% 30%)', color: 'hsl(35 80% 65%)' }}
            >
              <Check className="h-3 w-3" />
              Use this
            </button>
            <button
              onClick={handleDismiss}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-sm transition-colors"
              style={{ color: 'hsl(35 10% 45%)' }}
            >
              <X className="h-3 w-3" />
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [brainDrawerOpen, setBrainDrawerOpen] = useState(false);

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

  const handleBrainSuggest = useCallback((section: BrainSectionKey, text: string) => {
    const id = `brain-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    switch (section) {
      case 'strong-start':
        setPrepData((p) => ({ ...p, strongStart: p.strongStart ? `${p.strongStart}\n${text}` : text }));
        break;
      case 'characters':
        setPrepData((p) => ({ ...p, strongStart: p.strongStart ? `${p.strongStart}\n${text}` : text }));
        break;
      case 'secrets':
        setPrepData((p) => ({ ...p, secretsAndClues: [...p.secretsAndClues, { id, text }] }));
        break;
      case 'scenes':
        setPrepData((p) => ({ ...p, scenes: [...p.scenes, SceneSchema.parse({ id, title: text.slice(0, 60), description: text })] }));
        break;
      case 'npcs':
        setPrepData((p) => ({ ...p, npcs: [...p.npcs, PrepNpcSchema.parse({ name: text.slice(0, 60), motivation: text, isNew: true })] }));
        break;
      case 'monsters':
        setPrepData((p) => ({ ...p, monsters: [...p.monsters, { name: text.slice(0, 60), source: 'custom', count: 1 }] }));
        break;
      case 'rewards':
        setPrepData((p) => ({ ...p, rewards: [...p.rewards, { name: text.slice(0, 60), source: 'custom', notes: text }] }));
        break;
      case 'threads':
        setPrepData((p) => ({ ...p, looseThreads: [...p.looseThreads, { id, text }] }));
        break;
    }
  }, []);

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
        sessionId={sessionId}
        brainDrawerOpen={brainDrawerOpen}
        onBrainDrawerToggle={() => setBrainDrawerOpen((v) => !v)}
      />

      <PrepBrainDrawer
        campaignId={campaignId}
        open={brainDrawerOpen}
        onClose={() => setBrainDrawerOpen(false)}
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
            <PrepBrainContextCard campaignId={campaignId} />

            <PrepImportZone
              sessionId={sessionId}
              campaignId={campaignId}
              onExtracted={handleExtracted}
              lastImportedAt={lastImport?.extractedAt}
            />

            <PrepSectionCard id="characters" title="Review Characters" description={SECTION_DESCRIPTIONS['characters']}
              defaultOpen={completedSections.has('characters')} onExpand={() => setActiveSection('characters')}
              headerAction={<BrainSuggestButton section="characters" campaignId={campaignId} onSuggest={handleBrainSuggest} />}>
              <StepCharacters characterNotes={prepData.characterNotes}
                onChange={(notes) => setPrepData((p) => ({ ...p, characterNotes: notes }))} />
            </PrepSectionCard>

            <PrepSectionCard id="strong-start" title="Strong Start" description={SECTION_DESCRIPTIONS['strong-start']}
              suggestedCount={suggestedCounts['strong-start']} defaultOpen={!!prepData.strongStart}
              onExpand={() => setActiveSection('strong-start')}
              headerAction={<BrainSuggestButton section="strong-start" campaignId={campaignId} currentContent={prepData.strongStart} onSuggest={handleBrainSuggest} />}>
              <StepStrongStart sessionId={sessionId} value={prepData.strongStart}
                onChange={(v) => setPrepData((p) => ({ ...p, strongStart: v }))} />
            </PrepSectionCard>

            <PrepSectionCard id="scenes" title="Potential Scenes" description={SECTION_DESCRIPTIONS['scenes']}
              suggestedCount={suggestedCounts['scenes']} defaultOpen={prepData.scenes.length > 0}
              onExpand={() => setActiveSection('scenes')}
              headerAction={<BrainSuggestButton section="scenes" campaignId={campaignId} onSuggest={handleBrainSuggest} />}>
              <StepScenes sessionId={sessionId} scenes={prepData.scenes} strongStart={prepData.strongStart}
                onChange={(scenes) => setPrepData((p) => ({ ...p, scenes }))} />
            </PrepSectionCard>

            <PrepSectionCard id="secrets" title="Secrets & Clues" description={SECTION_DESCRIPTIONS['secrets']}
              suggestedCount={suggestedCounts['secrets']} defaultOpen={prepData.secretsAndClues.length > 0}
              onExpand={() => setActiveSection('secrets')}
              headerAction={<BrainSuggestButton section="secrets" campaignId={campaignId} onSuggest={handleBrainSuggest} />}>
              <StepSecrets sessionId={sessionId} secrets={prepData.secretsAndClues}
                onChange={(secretsAndClues) => setPrepData((p) => ({ ...p, secretsAndClues }))} />
            </PrepSectionCard>

            <PrepSectionCard id="npcs" title="Featured NPCs" description={SECTION_DESCRIPTIONS['npcs']}
              suggestedCount={suggestedCounts['npcs']} defaultOpen={prepData.npcs.length > 0}
              onExpand={() => setActiveSection('npcs')}
              headerAction={<BrainSuggestButton section="npcs" campaignId={campaignId} onSuggest={handleBrainSuggest} />}>
              <StepNpcs npcs={prepData.npcs} campaignNpcs={campaignContext.npcs}
                onChange={(npcs) => setPrepData((p) => ({ ...p, npcs }))} />
            </PrepSectionCard>

            <PrepSectionCard id="monsters" title="Monsters" description={SECTION_DESCRIPTIONS['monsters']}
              suggestedCount={suggestedCounts['monsters']} defaultOpen={prepData.monsters.length > 0}
              onExpand={() => setActiveSection('monsters')}
              headerAction={<BrainSuggestButton section="monsters" campaignId={campaignId} onSuggest={handleBrainSuggest} />}>
              <StepMonsters monsters={prepData.monsters}
                onChange={(monsters) => setPrepData((p) => ({ ...p, monsters }))} />
            </PrepSectionCard>

            <PrepSectionCard id="rewards" title="Rewards" description={SECTION_DESCRIPTIONS['rewards']}
              suggestedCount={suggestedCounts['rewards']} defaultOpen={prepData.rewards.length > 0}
              onExpand={() => setActiveSection('rewards')}
              headerAction={<BrainSuggestButton section="rewards" campaignId={campaignId} onSuggest={handleBrainSuggest} />}>
              <StepRewards rewards={prepData.rewards}
                onChange={(rewards) => setPrepData((p) => ({ ...p, rewards }))} />
            </PrepSectionCard>

            <PrepSectionCard id="threads" title="Loose Threads" description={SECTION_DESCRIPTIONS['threads']}
              suggestedCount={suggestedCounts['threads']} defaultOpen={prepData.looseThreads.length > 0}
              onExpand={() => setActiveSection('threads')}
              headerAction={<BrainSuggestButton section="threads" campaignId={campaignId} onSuggest={handleBrainSuggest} />}>
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
