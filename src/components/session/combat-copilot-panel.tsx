'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Swords } from 'lucide-react';

interface CombatCopiloterPanelProps {
  sessionId: string;
  data: any;
  status: string;
  onGenerate: () => void;
  isGenerating: boolean;
}

interface Participant {
  name?: string;
  hpChanges?: Array<{ amount?: number; cause?: string; round?: number }>;
  conditions?: Array<{ name?: string; applied?: boolean; round?: number }>;
  concentration?: Array<{ spell?: string; started?: boolean; round?: number }>;
}

export function CombatCopiloterPanel({
  data,
  status,
  onGenerate,
  isGenerating,
}: CombatCopiloterPanelProps) {
  if (status === 'none') {
    return (
      <Card>
        <CardContent className="py-4">
          <Button size="sm" variant="outline" onClick={onGenerate} disabled={isGenerating}>
            <Swords className="mr-2 h-3 w-3" />
            Analyze Combat
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === 'pending') {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Analyzing...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-destructive">Analysis failed</p>
        </CardContent>
      </Card>
    );
  }

  if (status === 'done' && data) {
    const participants = ((data as { participants?: Participant[] }).participants ?? []) as Participant[];

    return (
      <div className="space-y-3">
        {participants.length === 0 && (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">No combat events found.</p>
            </CardContent>
          </Card>
        )}
        {participants.map((participant, idx) => (
          <Card key={`${participant.name ?? 'participant'}-${idx}`}>
            <CardContent className="py-4 space-y-3">
              <p className="font-semibold">{participant.name ?? 'Unknown participant'}</p>

              {Array.isArray(participant.hpChanges) && participant.hpChanges.length > 0 && (
                <div className="space-y-1">
                  {participant.hpChanges.map((change, changeIdx) => {
                    const amount = Number(change.amount ?? 0);
                    const isHealing = amount > 0;
                    return (
                      <p
                        key={`hp-${changeIdx}`}
                        className={`text-sm ${isHealing ? 'text-emerald-500' : 'text-red-500'}`}
                      >
                        {isHealing ? `+${amount}` : amount}{' '}
                        {change.cause ? `(${change.cause})` : ''}
                        {typeof change.round === 'number' ? ` - Round ${change.round}` : ''}
                      </p>
                    );
                  })}
                </div>
              )}

              {Array.isArray(participant.conditions) && participant.conditions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {participant.conditions.map((condition, conditionIdx) => (
                    <Badge
                      key={`condition-${conditionIdx}`}
                      variant="outline"
                      className={
                        condition.applied
                          ? 'border-red-500 text-red-500'
                          : 'opacity-60 line-through'
                      }
                    >
                      {condition.name ?? 'Condition'}
                      {typeof condition.round === 'number' ? ` (R${condition.round})` : ''}
                    </Badge>
                  ))}
                </div>
              )}

              {Array.isArray(participant.concentration) &&
                participant.concentration.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {participant.concentration.map((entry, concentrationIdx) => (
                      <Badge
                        key={`concentration-${concentrationIdx}`}
                        variant="outline"
                        className="border-amber-500 text-amber-600"
                      >
                        {entry.started ? 'Started' : 'Ended'} {entry.spell ?? 'Concentration'}
                        {typeof entry.round === 'number' ? ` (R${entry.round})` : ''}
                      </Badge>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return null;
}
