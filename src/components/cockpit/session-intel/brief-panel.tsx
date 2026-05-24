'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

interface IntentBrief {
  toneKeywords: string[];
  playerGoals: string[];
  dmOnlyTruths: string[];
}

interface BriefPanelProps {
  campaignId: string;
  sessionId: string;
  intentBrief?: IntentBrief | null;
}

export function BriefPanel({ campaignId, sessionId, intentBrief }: BriefPanelProps) {
  const [prepBrief, setPrepBrief] = useState<string | null>(null);
  const [postSummary, setPostSummary] = useState<string | null>(null);

  const generatePrep = trpc.sessions.generatePrepBrief.useMutation({
    onSuccess: (data) => setPrepBrief(data.brief),
  });

  const generatePost = trpc.sessions.generatePostSessionSummary.useMutation({
    onSuccess: (data) => setPostSummary(data.summary),
  });

  return (
    <div className="space-y-3 p-3">
      {intentBrief ? (
        <>
          {intentBrief.toneKeywords.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tone</p>
              <div className="flex flex-wrap gap-1">
                {intentBrief.toneKeywords.map((kw, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] h-4 px-1.5">
                    {kw}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {intentBrief.playerGoals.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Players leave with</p>
              <ul className="space-y-0.5">
                {intentBrief.playerGoals.map((goal, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                    {goal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {intentBrief.dmOnlyTruths.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">DM only</p>
              <ul className="space-y-0.5">
                {intentBrief.dmOnlyTruths.map((truth, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-400/50 shrink-0" />
                    {truth}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No intent brief set. Add one in session prep.</p>
      )}

      <div className="pt-1 border-t border-border space-y-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-7"
          disabled={generatePrep.isPending}
          onClick={() => generatePrep.mutate({ campaignId, sessionId })}
        >
          {generatePrep.isPending ? 'Generating...' : 'Generate prep brief'}
        </Button>

        {prepBrief && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {prepBrief}
          </p>
        )}

        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-7"
          disabled={generatePost.isPending}
          onClick={() => generatePost.mutate({ campaignId, sessionId })}
        >
          {generatePost.isPending ? 'Generating...' : 'Post-session summary'}
        </Button>

        {postSummary && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {postSummary}
          </p>
        )}
      </div>
    </div>
  );
}
