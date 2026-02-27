'use client';

import {
  Check,
  Eye,
  Gift,
  GitBranch,
  Map,
  Swords,
  UserCircle2,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 0, label: 'Characters', icon: Users, hint: 'Know your players' },
  { id: 1, label: 'Strong Start', icon: Zap, hint: 'Open with a bang' },
  { id: 2, label: 'Scenes', icon: Map, hint: 'Potential beats' },
  { id: 3, label: 'Secrets', icon: Eye, hint: 'Hidden truths' },
  { id: 4, label: 'NPCs', icon: UserCircle2, hint: "Who they'll meet" },
  { id: 5, label: 'Monsters', icon: Swords, hint: 'Encounters' },
  { id: 6, label: 'Rewards', icon: Gift, hint: 'Treasure and XP' },
  { id: 7, label: 'Threads', icon: GitBranch, hint: 'Loose ends' },
] as const;

export function PrepStepSidebar({
  currentStep,
  completedSteps,
  onStepClick,
}: {
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (step: number) => void;
}) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {STEPS.map(({ id, label, icon: Icon }) => {
        const isActive = currentStep === id;
        const isDone = completedSteps.has(id);
        const maxCompleted = Math.max(...Array.from(completedSteps), -1);
        const isAccessible = isDone || id <= maxCompleted + 1;

        return (
          <button
            key={id}
            onClick={() => isAccessible && onStepClick(id)}
            disabled={!isAccessible}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all',
              isActive && 'bg-primary/15 text-primary font-medium',
              !isActive &&
                isDone &&
                'text-foreground/80 hover:bg-foreground/5 cursor-pointer',
              !isActive &&
                !isDone &&
                isAccessible &&
                'text-muted-foreground hover:bg-foreground/5 cursor-pointer',
              !isAccessible && 'text-muted-foreground/40 cursor-not-allowed'
            )}
            title={STEPS[id]?.hint}
          >
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                isActive && 'border-primary bg-primary text-primary-foreground',
                isDone &&
                  !isActive &&
                  'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
                !isActive && !isDone && 'border-border text-muted-foreground'
              )}
            >
              {isDone && !isActive ? (
                <Check className="h-3 w-3" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
            </span>
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

