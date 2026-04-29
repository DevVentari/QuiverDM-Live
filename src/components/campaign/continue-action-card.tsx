'use client';

import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SessionPhase } from '@/lib/session-lifecycle';

export interface ContinueAction {
  sessionId: string;
  sessionNumber: number;
  sessionTitle: string | null;
  phase: SessionPhase;
  label: string;
  description: string;
  href: string;
  icon: string;
  loading?: boolean;
}

interface ContinueActionCardProps {
  action: ContinueAction | null;
  slug: string;
}

export function ContinueActionCard({ action, slug }: ContinueActionCardProps) {
  if (!action) {
    return (
      <div className="stone-card glass-panel">
        <div className="stone-card-body flex flex-col items-center py-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">No active sessions — start your first!</p>
          <Button size="sm" asChild>
            <Link href={`/campaigns/${slug}/sessions/prep`}>Create Session</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="stone-card glass-panel flex items-center gap-4 px-4 py-3"
      style={{ borderColor: 'hsl(35 60% 28%)', background: 'linear-gradient(120deg, hsl(35 80% 55% / 0.06) 0%, transparent 60%)' }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
        style={{ background: 'hsl(35 80% 55% / 0.12)', border: '1px solid hsl(35 80% 55% / 0.25)' }}
      >
        {action.loading ? <Loader2 className="h-4 w-4 animate-spin text-amber-400/60" /> : action.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="label-overline mb-0.5">Continue where you left off</p>
        <p className="text-sm font-semibold truncate">
          Session {action.sessionNumber}{action.sessionTitle ? ` · ${action.sessionTitle}` : ''}
        </p>
        <p className="text-xs text-muted-foreground">{action.description}</p>
      </div>
      <Button size="sm" asChild className="shrink-0">
        <Link href={action.href}>
          {action.label} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
