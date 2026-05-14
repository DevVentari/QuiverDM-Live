import { forwardRef, type HTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

type SurfaceVariant = 'utility' | 'feature' | 'hero' | 'signature'

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant
  asChild?: boolean
  grain?: boolean
  glow?: boolean
  ornament?: boolean
  inset?: boolean
}

const variants: Record<SurfaceVariant, string> = {
  utility:
    'bg-[color-mix(in_oklab,var(--q-surface-utility)_68%,transparent)] border border-[color-mix(in_oklab,var(--q-border-subtle)_72%,transparent)] text-[var(--q-text)] backdrop-blur-sm shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.03)]',
  feature:
    'border border-[color-mix(in_oklab,var(--q-border-subtle)_76%,transparent)] text-[var(--q-text)] backdrop-blur-xl [background:linear-gradient(180deg,color-mix(in_oklab,var(--q-surface-feature)_60%,transparent)_0%,color-mix(in_oklab,var(--q-surface-raised)_46%,transparent)_100%)] [box-shadow:inset_0_1px_0_hsl(0_0%_100%_/_0.035),inset_0_-1px_0_hsl(0_0%_0%_/_0.18),0_20px_40px_-28px_hsl(0_0%_0%_/_0.4)]',
  hero:
    'border border-[color-mix(in_oklab,var(--q-border-subtle)_64%,var(--q-border-feature))] text-[var(--q-text)] backdrop-blur-2xl [background:linear-gradient(180deg,color-mix(in_oklab,var(--q-surface-hero)_64%,transparent)_0%,color-mix(in_oklab,var(--q-surface-signature)_50%,transparent)_100%)] [box-shadow:inset_0_1px_0_hsl(0_0%_100%_/_0.045),inset_0_-1px_0_hsl(0_0%_0%_/_0.24),0_22px_48px_-32px_hsl(0_0%_0%_/_0.46)]',
  signature:
    'border border-[color-mix(in_oklab,var(--q-border-subtle)_60%,var(--q-border-feature))] text-[var(--q-text)] backdrop-blur-2xl [background:linear-gradient(180deg,color-mix(in_oklab,var(--q-surface-signature)_64%,transparent)_0%,color-mix(in_oklab,var(--q-surface-raised)_48%,transparent)_100%)] [box-shadow:inset_0_1px_0_hsl(0_0%_100%_/_0.045),inset_0_-1px_0_hsl(0_0%_0%_/_0.28),0_22px_48px_-32px_hsl(0_0%_0%_/_0.46)]',
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  (
    {
      variant = 'utility',
      asChild = false,
      grain = false,
      glow = false,
      ornament = false,
      inset = false,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div'

    return (
      <Comp
        ref={ref}
      className={cn(
          // Tight radius keeps the cards grounded and avoids soft enterprise-style rounding.
          variant === 'utility' ? 'rounded-[14px]' : 'rounded-[20px]',
          'relative isolate overflow-hidden transition-colors',
          variants[variant],
          grain && 'q-panel-grain',
          ornament && 'rounded-[22px]',
          'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.05)_18%,rgba(255,255,255,0.025)_82%,transparent)] before:content-[""]',
          // Legacy `inset` prop still adds an extra top-highlight on top of variant shadow.
          // Kept for backwards compatibility with Card variant="detail" callers.
          inset && 'shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.04)]',
          className,
        )}
        {...props}
      >
        {children}
      </Comp>
    )
  },
)
Surface.displayName = 'Surface'
