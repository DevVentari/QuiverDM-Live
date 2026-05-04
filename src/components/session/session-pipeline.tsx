'use client';

import { cn } from '@/lib/utils';
import { PHASE_ICONS } from '@/lib/session-phase-icons';
import { PHASE_ORDER, PHASE_LABELS, type SessionPhase } from '@/lib/session-lifecycle';

interface SessionPipelineProps {
  currentPhase: SessionPhase;
  onPhaseClick?: (phase: SessionPhase) => void;
}

export function SessionPipeline({ currentPhase, onPhaseClick }: SessionPipelineProps) {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  return (
    <div className="flex items-center gap-0 rounded-lg overflow-hidden border border-border/60 bg-card/40">
      {PHASE_ORDER.map((phase, i) => {
        const isDone    = currentIndex > i;
        const isActive  = currentIndex === i;
        const isLocked  = currentIndex < i;

        return (
          <button
            key={phase}
            onClick={() => isDone && onPhaseClick?.(phase)}
            disabled={!isDone}
            className={cn(
              'relative flex-1 min-w-[44px] flex flex-col items-center gap-1 py-2.5 px-1 text-center transition-colors',
              isDone   && 'cursor-pointer hover:bg-white/5',
              isActive && 'bg-amber-500/[0.08]',
              isLocked && 'opacity-40 cursor-default',
              i > 0 && 'border-l border-border/40'
            )}
          >
            {(() => {
              const Icon = PHASE_ICONS[phase];
              return (
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 transition-all',
                    isDone   && 'text-emerald-400/70',
                    isActive && 'text-amber-400 drop-shadow-[0_0_4px_hsl(35_80%_55%/0.5)]',
                    isLocked && 'text-muted-foreground/30'
                  )}
                />
              );
            })()}
            <span className={cn(
              'text-[9px] font-semibold uppercase tracking-[0.1em]',
              isDone   && 'text-emerald-400/70',
              isActive && 'text-amber-400',
              isLocked && 'text-muted-foreground/40'
            )}>
              {PHASE_LABELS[phase]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
