'use client';

import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAutoSave } from '@/hooks/use-auto-save';
import { trpc } from '@/lib/trpc';
import { emptyPrepData, type SessionPrepData } from '@/lib/prep-types';
import { PrepHeader } from './prep-header';
import { PrepStepSidebar } from './prep-step-sidebar';
import { StepCharacters } from './steps/step-characters';
import { StepStrongStart } from './steps/step-strong-start';
import { StepScenes } from './steps/step-scenes';
import { StepSecrets } from './steps/step-secrets';
import { StepNpcs } from './steps/step-npcs';
import { StepMonsters } from './steps/step-monsters';
import { StepRewards } from './steps/step-rewards';
import { StepLooseThreads } from './steps/step-loose-threads';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';

const STEP_TITLES = [
  'Review Characters',
  'Strong Start',
  'Potential Scenes',
  'Secrets & Clues',
  'Featured NPCs',
  'Monsters',
  'Rewards',
  'Loose Threads',
];

const STEP_QUESTIONS = [
  'Who are your players, and what do they want?',
  'How does tonight begin?',
  'What scenes might unfold?',
  'What secrets can be discovered?',
  'Who will the party encounter?',
  'What dangers lurk ahead?',
  'What spoils await the brave?',
  'What threads remain unresolved?',
];

type CampaignContext = {
  characters: any[];
  npcs: any[];
  recentSessions: any[];
  homebrew: any[];
};

export function PrepWizard({
  sessionId,
  initialData,
  campaignContext,
  slug,
  initialTitle,
  prepStatus = 'draft',
}: {
  sessionId: string;
  initialData: SessionPrepData;
  campaignContext: CampaignContext;
  slug: string;
  initialTitle: string;
  prepStatus?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [prepData, setPrepData] = useState<SessionPrepData>(initialData ?? emptyPrepData());
  const [currentStep, setCurrentStep] = useState<number>(initialData.currentStep ?? 0);
  const [title, setTitle] = useState<string>(initialTitle);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set(Array.from({ length: initialData.currentStep ?? 0 }, (_, i) => i))
  );

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

  const savePayload = useMemo(
    () => ({ prepData, currentStep, title }),
    [prepData, currentStep, title]
  );

  const onSave = useCallback(
    async (payload: typeof savePayload) => {
      await updatePrep.mutateAsync({
        id: sessionId,
        prepData: { ...payload.prepData, currentStep: payload.currentStep },
      });
      await updateSession.mutateAsync({ id: sessionId, title: payload.title });
    },
    [sessionId, updatePrep, updateSession]
  );

  const { status: saveStatus } = useAutoSave(savePayload, onSave, 2000);

  const handleNext = () => {
    setCompletedSteps((prev) => { const n = new Set(prev); n.add(currentStep); return n; });
    setCurrentStep((prev) => Math.min(7, prev + 1));
  };
  const handlePrev = () => setCurrentStep((prev) => Math.max(0, prev - 1));
  const handleJump = (step: number) => {
    const maxCompleted = Math.max(...Array.from(completedSteps), -1);
    if (completedSteps.has(step) || step <= maxCompleted + 1) setCurrentStep(step);
  };
  const handleComplete = () => completePrep.mutate({ id: sessionId });

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <StepCharacters characterNotes={prepData.characterNotes} onChange={(notes) => setPrepData((p) => ({ ...p, characterNotes: notes }))} />;
      case 1: return <StepStrongStart sessionId={sessionId} value={prepData.strongStart} onChange={(v) => setPrepData((p) => ({ ...p, strongStart: v }))} />;
      case 2: return <StepScenes sessionId={sessionId} scenes={prepData.scenes} strongStart={prepData.strongStart} onChange={(scenes) => setPrepData((p) => ({ ...p, scenes }))} />;
      case 3: return <StepSecrets sessionId={sessionId} secrets={prepData.secretsAndClues} onChange={(secretsAndClues) => setPrepData((p) => ({ ...p, secretsAndClues }))} />;
      case 4: return <StepNpcs npcs={prepData.npcs} campaignNpcs={campaignContext.npcs} onChange={(npcs) => setPrepData((p) => ({ ...p, npcs }))} />;
      case 5: return <StepMonsters monsters={prepData.monsters} onChange={(monsters) => setPrepData((p) => ({ ...p, monsters }))} />;
      case 6: return <StepRewards rewards={prepData.rewards} onChange={(rewards) => setPrepData((p) => ({ ...p, rewards }))} />;
      case 7: default: return <StepLooseThreads sessionId={sessionId} threads={prepData.looseThreads} onChange={(looseThreads) => setPrepData((p) => ({ ...p, looseThreads }))} />;
    }
  };

  const wizardContent = (
    <div
      className={cn(
        'prep-wizard-root flex flex-col',
        isFullscreen
          ? 'fixed inset-0 z-[9999]'
          : 'flex h-screen flex-col'
      )}
      style={{
        background: isFullscreen
          ? 'radial-gradient(ellipse 80% 60% at 50% 0%, #1a1008 0%, #0d0b08 40%, #080608 100%)'
          : undefined,
      }}
    >
      {/* Ambient layers (fullscreen only) */}
      {isFullscreen && (
        <>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* Candlelight vignette */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 60% 50% at 50% 20%, rgba(212,168,83,0.07) 0%, transparent 70%), radial-gradient(ellipse 100% 100% at 50% 100%, rgba(0,0,0,0.6) 0%, transparent 60%)',
              }}
            />
            {/* Noise grain overlay */}
            <div
              className="absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                backgroundSize: '256px 256px',
              }}
            />
          </div>
        </>
      )}

      {/* Header */}
      <PrepHeader
        title={title}
        onTitleChange={setTitle}
        saveStatus={saveStatus}
        slug={slug}
        onComplete={handleComplete}
        isCompleting={completePrep.isPending}
        prepStatus={prepStatus}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((f) => !f)}
      />

      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'hidden shrink-0 overflow-y-auto md:flex md:flex-col',
            isFullscreen
              ? 'w-64 border-r border-amber-900/20 bg-black/20 backdrop-blur-sm'
              : 'w-56 border-r border-border/50 bg-card/30'
          )}
        >
          <PrepStepSidebar
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={handleJump}
            isFullscreen={isFullscreen}
          />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div
            className={cn(
              'mx-auto space-y-6 px-6 py-8',
              isFullscreen ? 'max-w-3xl py-12 px-10' : 'max-w-2xl'
            )}
          >
            {/* Step header */}
            <div className={cn('space-y-1', isFullscreen && 'space-y-2')}>
              {isFullscreen && (
                <p
                  className="text-xs font-medium tracking-[0.2em] uppercase"
                  style={{ color: 'rgba(212,168,83,0.5)' }}
                >
                  Step {currentStep + 1} of 8
                </p>
              )}
              <h2
                className={cn(
                  'font-display font-bold tracking-wide',
                  isFullscreen ? 'text-3xl' : 'text-2xl'
                )}
                style={isFullscreen ? { color: '#e8d5b0' } : undefined}
              >
                {STEP_TITLES[currentStep]}
              </h2>
              <p
                className={cn(
                  'text-sm',
                  isFullscreen ? 'text-base font-light italic' : 'text-muted-foreground'
                )}
                style={isFullscreen ? { color: 'rgba(232,213,176,0.5)' } : undefined}
              >
                {isFullscreen ? STEP_QUESTIONS[currentStep] : STEP_TITLES[currentStep] === STEP_TITLES[currentStep] && (
                  <>
                    {currentStep === 0 && 'Capture each character\'s current goals and what spotlight they might need.'}
                    {currentStep === 1 && 'Write a compelling opening that puts immediate pressure on the party.'}
                    {currentStep === 2 && 'Outline likely scene beats so you can pivot smoothly at the table.'}
                    {currentStep === 3 && 'Prepare discoverable truths and clues you can drop in naturally.'}
                    {currentStep === 4 && 'Pick the NPCs that matter tonight and what they want.'}
                    {currentStep === 5 && 'List likely monsters or hazards and rough challenge expectations.'}
                    {currentStep === 6 && 'Plan treasure, story rewards, and advancement opportunities.'}
                    {currentStep === 7 && 'Track unresolved hooks so continuity stays strong across sessions.'}
                  </>
                )}
              </p>
              {isFullscreen && (
                <div
                  className="mt-3 h-px w-16"
                  style={{ background: 'linear-gradient(90deg, rgba(212,168,83,0.6), transparent)' }}
                />
              )}
            </div>

            {/* Step content */}
            <div className={cn(isFullscreen && 'prep-fullscreen-content')}>
              {renderStep()}
            </div>

            {/* Navigation */}
            <div
              className={cn(
                'flex items-center justify-between pt-4',
                isFullscreen
                  ? 'border-t border-amber-900/20 mt-8'
                  : 'border-t border-border/50'
              )}
            >
              <Button
                variant={isFullscreen ? 'ghost' : 'outline'}
                size="sm"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className={cn(
                  'gap-1.5',
                  isFullscreen && 'text-amber-200/50 hover:text-amber-200/80 hover:bg-amber-900/20 disabled:opacity-20'
                )}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>

              <div className="flex items-center gap-3">
                {/* Step dots (fullscreen only) */}
                {isFullscreen && (
                  <div className="flex gap-1.5">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div
                        key={i}
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{
                          width: i === currentStep ? 20 : 6,
                          background:
                            i === currentStep
                              ? 'rgba(212,168,83,0.9)'
                              : completedSteps.has(i)
                              ? 'rgba(212,168,83,0.35)'
                              : 'rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNext}
                  className={cn(
                    'gap-1.5',
                    isFullscreen && 'text-amber-200/40 hover:text-amber-200/70 hover:bg-amber-900/20'
                  )}
                >
                  <SkipForward className="h-3 w-3" />
                  Skip
                </Button>
                {currentStep < 7 ? (
                  <Button
                    size="sm"
                    onClick={handleNext}
                    className={cn(
                      'gap-1.5',
                      isFullscreen &&
                        'bg-amber-600 hover:bg-amber-500 text-black font-semibold shadow-[0_0_20px_rgba(212,168,83,0.3)]'
                    )}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleComplete}
                    disabled={completePrep.isPending}
                    className={cn(
                      isFullscreen &&
                        'bg-amber-600 hover:bg-amber-500 text-black font-semibold shadow-[0_0_20px_rgba(212,168,83,0.3)]'
                    )}
                  >
                    {completePrep.isPending ? 'Saving...' : 'Complete Prep'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(wizardContent, document.body);
  }

  return wizardContent;
}
