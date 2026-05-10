import { cn } from '@/lib/utils'

type PillVariant = 'neutral' | 'info' | 'warning' | 'danger' | 'primary' | 'phase'

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant
}

const variants: Record<PillVariant, string> = {
  neutral: 'bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] text-[var(--q-text-dim)]',
  info:    'bg-[var(--q-amber-trace)] border border-[var(--q-border-hero)] text-[var(--q-text-info)]',
  warning: 'bg-[oklch(0.65_0.16_55_/_0.15)] border border-[oklch(0.65_0.16_55_/_0.4)] text-[var(--q-text-warning)]',
  danger:  'bg-[oklch(0.55_0.2_25_/_0.15)] border border-[oklch(0.55_0.2_25_/_0.4)] text-[var(--q-text-danger)]',
  primary: 'bg-[var(--q-amber)] border border-[var(--q-amber)] text-[var(--q-bg)] font-semibold',
  phase:   'bg-[var(--q-surface-feature)] border border-[var(--q-border-feature)] text-[var(--q-text)]',
}

export function Pill({ variant = 'info', className, children, ...props }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-sm text-[11px] tracking-wide',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
