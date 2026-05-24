'use client';

import { Badge } from '@/components/ui/badge';

interface IntentBrief {
  toneKeywords: string[];
  playerGoals: string[];
  dmOnlyTruths: string[];
}

interface BriefPanelProps {
  intentBrief?: IntentBrief | null;
}

export function BriefPanel({ intentBrief }: BriefPanelProps) {
  if (!intentBrief) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No intent brief set. Add one in session prep.
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
    </div>
  );
}
