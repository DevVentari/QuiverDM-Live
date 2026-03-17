import { PLAN_LABELS } from '@/lib/platform';
import { cn } from '@/lib/utils';
import { Compass, FlaskConical, Swords, Users } from 'lucide-react';

const PLAN_STYLES: Record<string, { className: string; icon: typeof Compass }> = {
  free: {
    className: 'border-stone-500/50 bg-stone-500/10 text-stone-400',
    icon: Compass,
  },
  pro: {
    className: 'border-amber-500/50 bg-amber-500/10 text-amber-300 shadow-amber-500/20 shadow-sm',
    icon: Swords,
  },
  alpha: {
    className: 'border-amber-400/70 bg-amber-400/15 text-amber-200 shadow-amber-400/40 shadow-md ring-1 ring-amber-400/30',
    icon: FlaskConical,
  },
  team: {
    className: 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300 shadow-indigo-500/20 shadow-sm',
    icon: Users,
  },
};

export function PlanBadge({ tier, className }: { tier: string; className?: string }) {
  const style = PLAN_STYLES[tier] ?? PLAN_STYLES.free;
  const Icon = style.icon;
  const label = PLAN_LABELS[tier] ?? tier;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        style.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
