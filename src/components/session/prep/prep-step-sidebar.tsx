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
  { id: 0, label: 'Characters',   icon: Users,       hint: 'Know your players',    numeral: 'I'    },
  { id: 1, label: 'Strong Start', icon: Zap,         hint: 'Open with a bang',     numeral: 'II'   },
  { id: 2, label: 'Scenes',       icon: Map,         hint: 'Potential beats',      numeral: 'III'  },
  { id: 3, label: 'Secrets',      icon: Eye,         hint: 'Hidden truths',        numeral: 'IV'   },
  { id: 4, label: 'NPCs',         icon: UserCircle2, hint: "Who they'll meet",     numeral: 'V'    },
  { id: 5, label: 'Monsters',     icon: Swords,      hint: 'Encounters',           numeral: 'VI'   },
  { id: 6, label: 'Rewards',      icon: Gift,        hint: 'Treasure and XP',      numeral: 'VII'  },
  { id: 7, label: 'Threads',      icon: GitBranch,   hint: 'Loose ends',           numeral: 'VIII' },
] as const;

export function PrepStepSidebar({
  currentStep,
  completedSteps,
  onStepClick,
  isFullscreen = false,
}: {
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (step: number) => void;
  isFullscreen?: boolean;
}) {
  if (!isFullscreen) {
    // Standard sidebar
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
                !isActive && isDone && 'text-foreground/80 hover:bg-foreground/5 cursor-pointer',
                !isActive && !isDone && isAccessible && 'text-muted-foreground hover:bg-foreground/5 cursor-pointer',
                !isAccessible && 'text-muted-foreground/40 cursor-not-allowed'
              )}
              title={STEPS[id]?.hint}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                  isActive && 'border-primary bg-primary text-primary-foreground',
                  isDone && !isActive && 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
                  !isActive && !isDone && 'border-border text-muted-foreground'
                )}
              >
                {isDone && !isActive ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              </span>
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  // Fullscreen immersive sidebar
  return (
    <nav className="flex flex-col gap-0.5 px-4 py-8">
      {/* Decorative header */}
      <div className="mb-6 px-2">
        <p
          className="text-[10px] font-medium tracking-[0.25em] uppercase"
          style={{ color: 'rgba(212,168,83,0.35)' }}
        >
          Session Prep
        </p>
        <div
          className="mt-2 h-px"
          style={{ background: 'linear-gradient(90deg, rgba(212,168,83,0.3), transparent)' }}
        />
      </div>

      {STEPS.map(({ id, label, icon: Icon, hint, numeral }) => {
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
              'group relative flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-all duration-200',
              isActive && 'bg-amber-900/20',
              !isActive && isAccessible && 'hover:bg-amber-900/10 cursor-pointer',
              !isAccessible && 'cursor-not-allowed opacity-30'
            )}
          >
            {/* Active indicator bar */}
            {isActive && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full"
                style={{ background: 'rgba(212,168,83,0.8)' }}
              />
            )}

            {/* Step indicator */}
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium font-display transition-all duration-200"
              style={{
                borderColor: isActive
                  ? 'rgba(212,168,83,0.7)'
                  : isDone
                  ? 'rgba(212,168,83,0.25)'
                  : 'rgba(255,255,255,0.08)',
                background: isActive
                  ? 'rgba(212,168,83,0.15)'
                  : isDone
                  ? 'rgba(212,168,83,0.06)'
                  : 'transparent',
                color: isActive
                  ? 'rgba(212,168,83,1)'
                  : isDone
                  ? 'rgba(212,168,83,0.6)'
                  : 'rgba(255,255,255,0.25)',
                boxShadow: isActive ? '0 0 12px rgba(212,168,83,0.15)' : 'none',
              }}
            >
              {isDone && !isActive ? (
                <Check className="h-3 w-3" style={{ color: 'rgba(212,168,83,0.7)' }} />
              ) : (
                numeral
              )}
            </span>

            {/* Label + hint */}
            <div className="min-w-0 flex-1">
              <div
                className="text-sm font-medium transition-colors duration-200"
                style={{
                  color: isActive
                    ? 'rgba(232,213,176,1)'
                    : isDone
                    ? 'rgba(232,213,176,0.55)'
                    : 'rgba(255,255,255,0.25)',
                }}
              >
                {label}
              </div>
              {isActive && (
                <div
                  className="text-[11px] mt-0.5 truncate"
                  style={{ color: 'rgba(212,168,83,0.4)' }}
                >
                  {hint}
                </div>
              )}
            </div>

            {/* Icon (right side, faint) */}
            <Icon
              className="h-3.5 w-3.5 shrink-0 transition-opacity duration-200"
              style={{
                color: isActive ? 'rgba(212,168,83,0.4)' : 'rgba(255,255,255,0.08)',
                opacity: isActive || isDone ? 1 : 0.4,
              }}
            />
          </button>
        );
      })}

      {/* Bottom decoration */}
      <div className="mt-6 px-2">
        <div
          className="h-px"
          style={{ background: 'linear-gradient(90deg, rgba(212,168,83,0.15), transparent)' }}
        />
        <p
          className="mt-3 text-[10px] font-medium tracking-[0.15em] uppercase"
          style={{ color: 'rgba(212,168,83,0.2)' }}
        >
          Lazy DM Method
        </p>
      </div>
    </nav>
  );
}
