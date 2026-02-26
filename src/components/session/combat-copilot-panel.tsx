'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Swords } from 'lucide-react';

interface CombatCopilotPanelProps {
  sessionId: string;
  data: any;
  status: string;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function CombatCopiloterPanel({
  sessionId: _sessionId,
  data,
  status,
  onGenerate,
  isGenerating,
}: CombatCopilotPanelProps) {
  const participants = Array.isArray(data?.participants) ? data.participants : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Swords className="h-4 w-4" />
          Combat Co-pilot
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === 'none' && (
          <Button size="sm" variant="outline" onClick={onGenerate} disabled={isGenerating}>
            <Swords className="mr-1 h-3.5 w-3.5" />
            Analyze Combat
          </Button>
        )}

        {status === 'pending' && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Analyzing...
          </div>
        )}

        {status === 'error' && (
          <p className="text-sm text-destructive">Analysis failed</p>
        )}

        {status === 'done' && data && (
          <div className="space-y-4">
            {participants.length === 0 && (
              <p className="text-sm text-muted-foreground">No combat events found.</p>
            )}

            {participants.map((participant: any, participantIndex: number) => (
              <div key={`${participant?.name ?? 'participant'}-${participantIndex}`} className="space-y-2 border border-border rounded-md p-3">
                <h4 className="text-sm font-semibold">{participant?.name ?? 'Unknown participant'}</h4>

                {Array.isArray(participant?.hpChanges) && participant.hpChanges.length > 0 && (
                  <div className="space-y-1">
                    {participant.hpChanges.map((change: any, index: number) => {
                      const amount = Number(change?.amount ?? 0);
                      const isHeal = amount > 0;
                      return (
                        <p
                          key={`hp-${index}`}
                          className={`text-xs ${isHeal ? 'text-emerald-600' : 'text-red-600'}`}
                        >
                          {isHeal ? '+' : ''}
                          {amount} {change?.cause ? `(${change.cause})` : ''}{' '}
                          {change?.round ? `- round ${change.round}` : ''}
                        </p>
                      );
                    })}
                  </div>
                )}

                {Array.isArray(participant?.conditions) && participant.conditions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {participant.conditions.map((condition: any, index: number) => {
                      const applied = !!condition?.applied;
                      return (
                        <Badge
                          key={`condition-${index}`}
                          variant="outline"
                          className={applied ? 'border-red-300 bg-red-100 text-red-800' : 'opacity-60 line-through'}
                        >
                          {condition?.name ?? 'Unknown condition'}
                          {condition?.round ? ` (r${condition.round})` : ''}
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {Array.isArray(participant?.concentration) && participant.concentration.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {participant.concentration.map((entry: any, index: number) => (
                      <Badge key={`concentration-${index}`} variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                        {entry?.spell ?? 'Unknown spell'}
                        {entry?.round ? ` (r${entry.round})` : ''}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
