import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PHASE_LABELS, type SessionPhase } from '@/lib/session-lifecycle';
import { PHASE_ICONS } from '@/lib/session-phase-icons';

interface PhaseCompleteRowProps {
  phase: SessionPhase;
  detail: string;
  editHref?: string;
}

export function PhaseCompleteRow({ phase, detail, editHref }: PhaseCompleteRowProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
        {(() => {
          const Icon = PHASE_ICONS[phase];
          return <Icon className="h-3 w-3 text-emerald-400" strokeWidth={1.5} />;
        })()}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-emerald-400/80">{PHASE_LABELS[phase]}</span>
        <span className="text-xs text-muted-foreground/50 ml-2">{detail}</span>
      </div>
      {editHref && (
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-6 px-2 text-[10px] text-muted-foreground/50 hover:text-foreground"
        >
          <Link href={editHref}>
            <Pencil className="h-3 w-3" />
          </Link>
        </Button>
      )}
    </div>
  );
}
