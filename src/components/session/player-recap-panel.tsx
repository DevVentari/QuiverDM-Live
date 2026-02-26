'use client';

import { BookOpen, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PlayerRecapPanelProps {
  sessionId: string;
  recap: string | null;
  status: string;
  playerVisibility: string;
  isDM: boolean;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function PlayerRecapPanel({
  recap,
  status,
  playerVisibility,
  isDM,
  onGenerate,
  isGenerating,
}: PlayerRecapPanelProps) {
  if (status === 'none' && !isDM) {
    return null;
  }

  const isPending = status === 'pending';
  const isVisibleToPlayers = playerVisibility === 'summary-only' || playerVisibility === 'public';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Player Recap
        </CardTitle>
        {isDM && (
          <Button
            size="sm"
            variant="outline"
            onClick={onGenerate}
            disabled={isPending || isGenerating}
          >
            Generate Player Recap
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isPending && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Generating...
          </p>
        )}

        {status === 'done' && recap && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{recap}</p>
            {isVisibleToPlayers ? (
              <Badge className="bg-emerald-100 text-emerald-800" variant="outline">
                Visible to players
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800" variant="outline">
                Not visible to players
              </Badge>
            )}
          </div>
        )}

        {status === 'error' && (
          <p className="text-sm text-destructive">Generation failed</p>
        )}
      </CardContent>
    </Card>
  );
}