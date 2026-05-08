import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

type SurfaceVariant = 'flat' | 'raised' | 'sunken'

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant
}

const variants: Record<SurfaceVariant, string> = {
  flat:   'bg-[var(--q-surface-flat)] border border-[var(--q-border)]',
  raised: 'bg-[var(--q-surface-raised)] border border-[var(--q-amber-border)] shadow-md shadow-black/30',
  sunken: 'bg-[var(--q-surface-sunken)] border border-[var(--q-border-subtle)]',
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ variant = 'flat', className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-[var(--radius)]', variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  ),
)
Surface.displayName = 'Surface'
