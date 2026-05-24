'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PhasesPanelProps {
  campaignId: string;
  sessionId: string;
}

export function PhasesPanel({ campaignId, sessionId }: PhasesPanelProps) {
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);
  const [phaseStartTimes, setPhaseStartTimes] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(interval);
  }, []);

  const phasesQuery = trpc.sessionPhases.list.useQuery({ campaignId, sessionId });

  if (phasesQuery.isLoading) {
    return <div className="p-3 text-xs text-muted-foreground">Loading phases...</div>;
  }

  const phases = phasesQuery.data ?? [];

  if (phases.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No phases prepared for this session.
      </div>
    );
  }

  const handleToggle = (phaseId: string) => {
    if (activePhaseId === phaseId) {
      setActivePhaseId(null);
    } else {
      setActivePhaseId(phaseId);
      setPhaseStartTimes((prev) => ({ ...prev, [phaseId]: Date.now() }));
    }
  };

  const sorted = [...phases].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="space-y-2">
      {sorted.map((phase) => {
        const isActive = activePhaseId === phase.id;
        const startTime = phaseStartTimes[phase.id];
        const elapsedMin = startTime ? Math.floor((now - startTime) / 60_000) : null;
        const isOver = elapsedMin !== null && phase.targetMinutes !== null && elapsedMin > phase.targetMinutes;

        return (
          <div
            key={phase.id}
            className={cn(
              'rounded-md border border-border/40 bg-card/40 p-2.5 space-y-1.5 transition-colors',
              isActive && 'border-amber-500/60 bg-amber-950/20'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{phase.name}</p>
                {phase.targetMinutes !== null && (
                  <p className={cn('text-[10px]', isOver ? 'text-red-400' : 'text-muted-foreground')}>
                    {elapsedMin !== null
                      ? `${elapsedMin}m / ${phase.targetMinutes}m`
                      : `${phase.targetMinutes}m`}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant={isActive ? 'default' : 'outline'}
                className="h-6 text-[10px] px-2 shrink-0"
                onClick={() => handleToggle(phase.id)}
              >
                {isActive ? 'Running' : 'Start'}
              </Button>
            </div>

            {phase.notes && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">{phase.notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
