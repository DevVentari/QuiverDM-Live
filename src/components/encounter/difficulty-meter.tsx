'use client';

import { cn } from '@/lib/utils';
import { calculateDifficulty, getXpBudget } from '@/lib/dnd5e/encounter-calculator';

interface DifficultyMeterProps {
  creatures: Array<{ xp: number; count: number }>;
  partySize: number;
  partyLevel: number;
  className?: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  trivial:    'bg-muted-foreground/40',
  easy:       'bg-green-500',
  medium:     'bg-yellow-500',
  hard:       'bg-orange-500',
  deadly:     'bg-red-500',
  'over-budget': 'bg-red-700',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  trivial:    'Trivial',
  easy:       'Easy',
  medium:     'Medium',
  hard:       'Hard',
  deadly:     'Deadly',
  'over-budget': 'Overwhelming',
};

export function DifficultyMeter({ creatures, partySize, partyLevel, className }: DifficultyMeterProps) {
  const hasCreatures = creatures.length > 0 && creatures.some((c) => c.count > 0);

  const result = hasCreatures
    ? calculateDifficulty(creatures, partySize, partyLevel)
    : null;

  const budget = getXpBudget(partySize, partyLevel, 'deadly');

  const barPercent = result
    ? Math.min(100, result.budgetUsedPercent)
    : 0;

  const difficulty = result?.difficulty ?? 'trivial';
  const barColor = DIFFICULTY_COLORS[difficulty] ?? 'bg-muted-foreground/40';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Encounter Difficulty</span>
        <span
          className={cn(
            'font-bold text-sm',
            difficulty === 'easy' && 'text-green-500',
            difficulty === 'medium' && 'text-yellow-500',
            difficulty === 'hard' && 'text-orange-500',
            (difficulty === 'deadly' || difficulty === 'over-budget') && 'text-red-500',
            difficulty === 'trivial' && 'text-muted-foreground'
          )}
        >
          {DIFFICULTY_LABELS[difficulty]}
        </span>
      </div>

      {/* Progress bar with threshold markers */}
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        {/* Colored fill */}
        <div
          className={cn('h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${barPercent}%` }}
        />
        {/* Threshold markers */}
        {[
          { key: 'easy', label: 'E' },
          { key: 'medium', label: 'M' },
          { key: 'hard', label: 'H' },
        ].map(({ key }) => {
          const threshold = budget[key as keyof typeof budget] as number;
          const deadlyBudget = budget.deadly;
          if (!deadlyBudget) return null;
          const pct = Math.min(100, (threshold / deadlyBudget) * 100);
          return (
            <div
              key={key}
              className="absolute top-0 bottom-0 w-0.5 bg-background/50"
              style={{ left: `${pct}%` }}
            />
          );
        })}
      </div>

      {/* XP Stats */}
      {result && (
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div>
            <div className="font-medium text-foreground">{result.rawXp.toLocaleString()}</div>
            <div>Raw XP</div>
          </div>
          <div>
            <div className="font-medium text-foreground">×{result.multiplier}</div>
            <div>Multiplier</div>
          </div>
          <div>
            <div className="font-medium text-foreground">{result.adjustedXp.toLocaleString()}</div>
            <div>Adjusted XP</div>
          </div>
        </div>
      )}

      {/* Thresholds reference */}
      <div className="grid grid-cols-4 gap-1 text-xs">
        {(['easy', 'medium', 'hard', 'deadly'] as const).map((d) => (
          <div key={d} className="text-center">
            <div className="text-muted-foreground capitalize">{d}</div>
            <div className="font-medium">{budget[d].toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
