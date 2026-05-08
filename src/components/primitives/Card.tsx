import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type CardVariant = 'list' | 'feature' | 'grimoire'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

const variants: Record<CardVariant, string> = {
  list: 'bg-[var(--q-card-bg)] border border-[var(--q-border)] px-4 py-3',
  feature: 'bg-[var(--q-surface-raised)] border border-[var(--q-amber-border)] px-5 py-4 shadow-lg shadow-black/30',
  grimoire: cn(
    'relative bg-gradient-to-br from-[var(--q-amber-trace)] to-[oklch(0.14_0.01_265_/_0.4)]',
    'border border-[var(--q-amber-border)] px-5 py-4',
    '[clip-path:polygon(0_0,calc(100%_-_14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%_-_14px))]',
  ),
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'list', className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-[var(--radius)]', variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  ),
)
Card.displayName = 'Card'
