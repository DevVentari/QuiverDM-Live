'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAutoSave } from '@/hooks/use-auto-save';
import { trpc } from '@/lib/trpc';
import {
  emptyPrepData,
  type SessionPrepData,
} from '@/lib/prep-types';
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

const STEP_HINTS = [
  'Capture each character’s current goals and what spotlight they might need.',
  'Write a compelling opening that puts immediate pressure on the party.',
  'Outline likely scene beats so you can pivot smoothly at the table.',
  'Prepare discoverable truths and clues you can drop in naturally.',
  'Pick the NPCs that matter tonight and what they want.',
  'List likely monsters or hazards and rough challenge expectations.',
  'Plan treasure, story rewards, and advancement opportunities.',
  'Track unresolved hooks so continuity stays strong across sessions.',
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

  const [prepData, setPrepData] = useState<SessionPrepData>(
    initialData ?? emptyPrepData()
  );
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
      await updateSession.mutateAsync({
        id: sessionId,
        title: payload.title,
      });
    },
    [sessionId, updatePrep, updateSession]
  );

  const { status: saveStatus } = useAutoSave(savePayload, onSave, 2000);

  const handleNext = () => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(currentStep);
      return next;
    });
    setCurrentStep((prev) => Math.min(7, prev + 1));
  };

  const handlePrev = () => setCurrentStep((prev) => Math.max(0, prev - 1));

  const handleJump = (step: number) => {
    const maxCompleted = Math.max(...Array.from(completedSteps), -1);
    if (completedSteps.has(step) || step <= maxCompleted + 1) {
      setCurrentStep(step);
    }
  };

  const handleComplete = () => {
    completePrep.mutate({ id: sessionId });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepCharacters
            characterNotes={prepData.characterNotes}
            onChange={(notes) => setPrepData((prev) => ({ ...prev, characterNotes: notes }))}
          />
        );
      case 1:
        return (
          <StepStrongStart
            sessionId={sessionId}
            value={prepData.strongStart}
            onChange={(value) => setPrepData((prev) => ({ ...prev, strongStart: value }))}
          />
        );
      case 2:
        return (
          <StepScenes
            sessionId={sessionId}
            scenes={prepData.scenes}
            strongStart={prepData.strongStart}
            onChange={(scenes) => setPrepData((prev) => ({ ...prev, scenes }))}
          />
        );
      case 3:
        return (
          <StepSecrets
            sessionId={sessionId}
            secrets={prepData.secretsAndClues}
            onChange={(secretsAndClues) =>
              setPrepData((prev) => ({ ...prev, secretsAndClues }))
            }
          />
        );
      case 4:
        return (
          <StepNpcs
            npcs={prepData.npcs}
            campaignNpcs={campaignContext.npcs}
            onChange={(npcs) => setPrepData((prev) => ({ ...prev, npcs }))}
          />
        );
      case 5:
        return (
          <StepMonsters
            monsters={prepData.monsters}
            onChange={(monsters) => setPrepData((prev) => ({ ...prev, monsters }))}
          />
        );
      case 6:
        return (
          <StepRewards
            rewards={prepData.rewards}
            onChange={(rewards) => setPrepData((prev) => ({ ...prev, rewards }))}
          />
        );
      case 7:
      default:
        return (
          <StepLooseThreads
            sessionId={sessionId}
            threads={prepData.looseThreads}
            onChange={(looseThreads) => setPrepData((prev) => ({ ...prev, looseThreads }))}
          />
        );
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <PrepHeader
        title={title}
        onTitleChange={setTitle}
        saveStatus={saveStatus}
        slug={slug}
        onComplete={handleComplete}
        isCompleting={completePrep.isPending}
        prepStatus={prepStatus}
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border/50 bg-card/30 md:block">
          <PrepStepSidebar
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={handleJump}
          />
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
            <div>
              <h2 className="font-display text-2xl font-bold">{STEP_TITLES[currentStep]}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{STEP_HINTS[currentStep]}</p>
            </div>

            {renderStep()}

            <div className="flex justify-between border-t border-border/50 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={currentStep === 0}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleNext}>
                  Skip
                </Button>
                {currentStep < 7 ? (
                  <Button size="sm" onClick={handleNext}>
                    Next
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleComplete}
                    disabled={completePrep.isPending}
                  >
                    Complete Prep
                  </Button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

