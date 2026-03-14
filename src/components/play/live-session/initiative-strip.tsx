import { cn } from '@/lib/utils';
import type { InitiativeParticipant } from '@/hooks/use-player-session';

export function InitiativeStrip({ participants, currentTurnId, round }: {
  participants: InitiativeParticipant[];
  currentTurnId: string | null;
  round: number;
}) {
  return (
    <div className="bg-black/40 border-b border-white/8 px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs text-amber-400/70 font-mono">Round {round}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {participants.filter(p => p.isAlive).map(p => (
          <div
            key={p.id}
            className={cn(
              'flex flex-col items-center min-w-[52px] px-1.5 py-1 rounded text-center transition-colors',
              currentTurnId === p.id
                ? 'bg-amber-500/20 ring-1 ring-amber-500/50'
                : 'bg-white/5'
            )}
          >
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">{p.name.split(' ')[0]}</span>
            <span className={cn('text-xs font-mono font-bold', p.hp / p.maxHp < 0.3 ? 'text-red-400' : 'text-foreground')}>
              {p.hp}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
