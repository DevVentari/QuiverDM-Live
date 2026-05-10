'use client'

import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type SummonVariant = 'dialog' | 'sheet' | 'overlay' | 'grimoire-overlay'

interface SummonProps {
  variant?: SummonVariant
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  grimoire?: boolean
  children: React.ReactNode
  className?: string
}

const panelClasses: Record<SummonVariant, string> = {
  dialog: 'border-[var(--q-border-feature)] bg-[var(--q-surface-feature)] text-[var(--q-text)]',
  sheet: 'border-[var(--q-border-feature)] bg-[var(--q-surface-feature)] text-[var(--q-text)]',
  overlay:
    'top-[8vh] translate-y-0 max-w-4xl border-[var(--q-border-hero)] bg-[var(--q-surface-hero)] text-[var(--q-text)] shadow-2xl shadow-black/45',
  'grimoire-overlay':
    'top-[8vh] translate-y-0 max-w-[960px] border-[var(--q-border-signature)] bg-[var(--q-surface-signature)] text-[var(--q-text)] shadow-2xl shadow-black/55',
}

export function Summon({
  variant = 'dialog',
  open,
  onOpenChange,
  title,
  grimoire = false,
  children,
  className,
}: SummonProps) {
  if (variant === 'sheet') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className={cn(panelClasses.sheet, grimoire && 'q-hero-glow', className)}>
          {title && (
            <SheetHeader>
              <SheetTitle className="font-[var(--q-font-display)] tracking-wider text-[var(--q-text)]">
                {title}
              </SheetTitle>
            </SheetHeader>
          )}
          {children}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          panelClasses[variant],
          (variant === 'grimoire-overlay' || grimoire) && 'q-hero-glow',
          className,
        )}
      >
        {title && (
          <DialogHeader>
            <DialogTitle className="font-[var(--q-font-display)] tracking-wider text-[var(--q-text)]">
              {title}
            </DialogTitle>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  )
}
