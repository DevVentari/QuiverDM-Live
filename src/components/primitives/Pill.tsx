import { cn } from '@/lib/utils'

type PillVariant = 'info' | 'warning' | 'danger' | 'primary'

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant
}

const variants: Record<PillVariant, string> = {
  info:    'bg-[var(--q-amber-trace)] border border-[oklch(0.7_0.16_55_/_0.25)] text-[oklch(0.8_0.1_55)]',
  warning: 'bg-[oklch(0.65_0.16_55_/_0.15)] border border-[oklch(0.65_0.16_55_/_0.4)] text-[oklch(0.8_0.14_55)]',
  danger:  'bg-[oklch(0.55_0.2_25_/_0.15)] border border-[oklch(0.55_0.2_25_/_0.4)] text-[oklch(0.75_0.15_25)]',
  primary: 'bg-[var(--q-amber)] border border-[var(--q-amber)] text-[var(--q-bg)] font-semibold',
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
