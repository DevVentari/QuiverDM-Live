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
  utility: 'bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] text-[var(--q-text)]',
  feature: 'border border-[var(--q-border-feature)] text-[var(--q-text)] backdrop-blur-md [background:var(--q-stone-feature-bg)] [box-shadow:var(--q-stone-feature-shadow)]',
  hero: 'border border-[var(--q-border-hero)] text-[var(--q-text)] backdrop-blur-lg [background:var(--q-stone-hero-bg)] [box-shadow:var(--q-stone-hero-shadow)]',
  signature: 'border border-[var(--q-border-signature)] text-[var(--q-text)] backdrop-blur-xl [background:var(--q-stone-signature-bg)] [box-shadow:var(--q-stone-signature-shadow)]',
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
          // Tighter 3px radius matches the design system's "stone card" spec.
          // Utility surfaces keep the default to preserve toolbar/command-bar shape.
          variant === 'utility' ? 'rounded-[var(--radius)]' : 'rounded-[3px]',
          'transition-colors',
          variants[variant],
          grain && 'q-panel-grain',
          glow && 'q-hero-glow',
          ornament && '[clip-path:polygon(0_0,calc(100%_-_12px)_0,100%_12px,100%_100%,12px_100%,0_calc(100%_-_12px))]',
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
