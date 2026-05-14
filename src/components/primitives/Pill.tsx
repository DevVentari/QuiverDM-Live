import { cn } from '@/lib/utils'
import { type SemanticAccentKey } from '@/lib/semantic-tokens'

type PillVariant = 'neutral' | 'info' | 'warning' | 'danger' | 'primary' | 'phase' | 'success' | 'quest' | 'arcane'

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant
}

const semanticVariantMap: Record<SemanticAccentKey, string> = {
  primary: 'bg-[color-mix(in_oklab,var(--q-accent-primary-trace)_72%,transparent)] border border-[var(--q-accent-primary-border)] text-[var(--q-accent-primary)] font-medium',
  quest: 'bg-[color-mix(in_oklab,var(--q-accent-quest-trace)_72%,transparent)] border border-[var(--q-accent-quest-border)] text-[var(--q-accent-quest)]',
  success: 'bg-[color-mix(in_oklab,var(--q-accent-success-trace)_72%,transparent)] border border-[var(--q-accent-success-border)] text-[var(--q-accent-success)]',
  danger: 'bg-[color-mix(in_oklab,var(--q-accent-danger-trace)_72%,transparent)] border border-[var(--q-accent-danger-border)] text-[var(--q-accent-danger)]',
  arcane: 'bg-[color-mix(in_oklab,var(--q-accent-arcane-trace)_72%,transparent)] border border-[var(--q-accent-arcane-border)] text-[var(--q-accent-arcane)]',
  neutral: 'bg-[color-mix(in_oklab,var(--q-surface-utility)_76%,transparent)] border border-[var(--q-border-subtle)] text-[var(--q-text-dim)]',
}

const variants: Record<PillVariant, string> = {
  neutral: semanticVariantMap.neutral,
  info: semanticVariantMap.quest,
  warning: semanticVariantMap.primary,
  danger: semanticVariantMap.danger,
  primary: semanticVariantMap.primary,
  phase: 'bg-[var(--q-surface-feature)] border border-[var(--q-border-feature)] text-[var(--q-text)]',
  success: semanticVariantMap.success,
  quest: semanticVariantMap.quest,
  arcane: semanticVariantMap.arcane,
}

export function Pill({ variant = 'info', className, children, ...props }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
