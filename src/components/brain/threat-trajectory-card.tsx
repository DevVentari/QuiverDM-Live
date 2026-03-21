'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThreatTrajectory {
  delta_per_session: number;
  sessions_to_critical?: number;
  computed_at: string;
}

interface ThreatEntity {
  id: string;
  name: string;
  properties: Record<string, unknown>;
}

function getInfluenceValue(properties: Record<string, unknown>): number | null {
  const stress = properties['stress'];
  const influence = properties['influence'];
  if (typeof influence === 'number') return influence;
  if (typeof stress === 'number') return stress;
  return null;
}

export function ThreatTrajectoryCard({ entity }: { entity: ThreatEntity }) {
  const trajectory = entity.properties['trajectory'] as ThreatTrajectory | undefined;
  if (!trajectory) return null;

  const currentValue = getInfluenceValue(entity.properties);
  const { delta_per_session, sessions_to_critical } = trajectory;
  const isCritical = sessions_to_critical !== undefined && sessions_to_critical <= 2;
  const pct = currentValue !== null ? Math.round(currentValue * 100) : null;
  const filledPct = pct ?? 0;

  return (
    <div
      className={cn(
        'rounded-lg border p-3 space-y-2',
        isCritical
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-amber-500/40 bg-amber-500/5'
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle
          className={cn('h-4 w-4 shrink-0', isCritical ? 'text-destructive' : 'text-amber-500')}
        />
        <span className="text-sm font-medium truncate">{entity.name}</span>
      </div>

      {pct !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Influence</span>
            <span className="font-mono tabular-nums">{(currentValue! * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/40">
            <div
              className={cn('h-full rounded-full', isCritical ? 'bg-destructive' : 'bg-amber-500')}
              style={{ width: `${filledPct}%` }}
            />
          </div>
        </div>
      )}

      <p className={cn('text-xs', isCritical ? 'text-destructive/80' : 'text-amber-500/80')}>
        {delta_per_session > 0 ? '+' : ''}{delta_per_session.toFixed(2)}/session
        {sessions_to_critical !== undefined && (
          <> · critical in ~{sessions_to_critical} session{sessions_to_critical !== 1 ? 's' : ''}</>
        )}
      </p>
    </div>
  );
}
