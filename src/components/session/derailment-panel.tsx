'use client';

import { Navigation, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface DerailmentPanelData {
  isDerailed?: boolean;
  driftScore?: number;
  driftDescription?: string;
  recoveryOptions?: string[];
}

interface DerailmentPanelProps {
  sessionId: string;
  data: any;
  status: string;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

function getScoreColor(score: number): string {
  if (score <= 3) return 'bg-emerald-500';
  if (score <= 6) return 'bg-amber-500';
  return 'bg-red-500';
}

export function DerailmentPanel({
  data,
  status,
  onAnalyze,
  isAnalyzing,
}: DerailmentPanelProps) {
  const derailmentData = (data ?? {}) as DerailmentPanelData;
  const driftScore = Math.max(
    0,
    Math.min(10, typeof derailmentData.driftScore === 'number' ? derailmentData.driftScore : 0)
  );
  const recoveryOptions = Array.isArray(derailmentData.recoveryOptions)
    ? derailmentData.recoveryOptions
    : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Navigation className="h-4 w-4" />
          Derailment Detector
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === 'none' && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAnalyze}
            disabled={isAnalyzing}
          >
            Analyze Session
          </Button>
        )}

        {status === 'pending' && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Analyzing...
          </p>
        )}

        {status === 'done' && derailmentData && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Drift Score</span>
                <span>{driftScore.toFixed(1)} / 10</span>
              </div>
              <Progress value={driftScore * 10} indicatorClassName={getScoreColor(driftScore)} />
            </div>

            <p className="text-sm text-muted-foreground italic">
              {derailmentData.driftDescription ?? 'Session stayed on track.'}
            </p>

            {derailmentData.isDerailed && recoveryOptions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recovery Options
                </h4>
                <ol className="space-y-2">
                  {recoveryOptions.map((option, index) => (
                    <li key={`${option}-${index}`} className="text-sm rounded-md border border-border p-2.5">
                      <span className="font-medium mr-2">{index + 1}.</span>
                      <span>{option}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <p className="text-sm text-destructive">Analysis failed</p>
        )}
      </CardContent>
    </Card>
  );
}