'use client'

import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type SummonVariant = 'dialog' | 'sheet' | 'overlay'

interface SummonProps {
  variant?: SummonVariant
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  grimoire?: boolean
  children: React.ReactNode
  className?: string
}

const grimoireClass =
  'bg-gradient-to-br from-[var(--q-surface-flat)] to-[var(--q-bg)] border-[var(--q-amber-border)]'

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
        <SheetContent className={cn(grimoire && grimoireClass, className)}>
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
      <DialogContent className={cn(grimoire && grimoireClass, className)}>
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
