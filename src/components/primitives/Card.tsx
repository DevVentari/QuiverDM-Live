import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Surface } from './Surface'

type CardVariant = 'list' | 'detail' | 'feature' | 'hero' | 'grimoire'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

const variants: Record<CardVariant, string> = {
  list: 'px-4 py-3',
  detail: 'px-5 py-4',
  feature: 'px-5 py-4',
  hero: 'px-6 py-5',
  grimoire: 'px-5 py-4',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'list', className, children, ...props }, ref) => {
    const surfaceVariant =
      variant === 'list'
        ? 'utility'
        : variant === 'detail' || variant === 'feature'
        ? 'feature'
        : variant === 'hero'
        ? 'hero'
        : 'signature'

    return (
      <Surface
        ref={ref}
        variant={surfaceVariant}
        grain={variant !== 'list'}
        glow={false}
        ornament={variant === 'grimoire'}
        inset={variant === 'detail'}
        className={cn(
          variant === 'grimoire' &&
            'bg-[linear-gradient(160deg,var(--q-amber-trace),transparent_42%),linear-gradient(180deg,var(--q-surface-signature),var(--q-bg))]',
          variants[variant],
          className,
        )}
        {...props}
      >
        {children}
      </Surface>
    )
  },
)
Card.displayName = 'Card'
