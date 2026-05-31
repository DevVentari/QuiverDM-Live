'use client'

import { useState } from 'react'
import { Sparkles, Sun, Bell, type LucideIcon } from 'lucide-react'
import { Surface } from '@/components/primitives'
import { UserMenu } from '@/components/user-menu'
import { useHeaderStore } from '@/store/header-store'
import { SearchTrigger } from './SearchTrigger'
import { QuickActionButtons } from './QuickActionButtons'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

function ToolbarIconButton({
  label,
  icon: Icon,
  onClick,
  testId,
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  testId?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full',
        'bg-[var(--q-surface-utility)]/80 text-[var(--q-text-faint)]',
        'shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.03)] transition-colors',
        'hover:text-[var(--q-text)]',
      )}
    >
      <Icon size={18} strokeWidth={1.8} />
    </button>
  )
}

export function CommandBar() {
  const setBrainOpen = useHeaderStore((s) => s.setBrainOpen)
  const [placeholderOpen, setPlaceholderOpen] = useState<null | 'theme' | 'notifications'>(null)

  return (
    <Surface
      asChild
      variant="utility"
      className={cn(
        'hidden h-[72px] shrink-0 items-center rounded-none border-x-0 border-t-0 px-8 md:flex',
        'bg-[var(--q-shell-bar)]/95 backdrop-blur-md',
      )}
    >
      <header>
        <div className="flex min-w-0 flex-1 items-center">
          <SearchTrigger />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden">
          <QuickActionButtons />
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setBrainOpen(true)}
            aria-label="Open Brain (Ctrl+B)"
            data-testid="brain-trigger"
            className={cn(
              'inline-flex h-11 items-center gap-2 rounded-xl',
              'bg-[var(--q-amber-trace)] px-4 text-[13px] text-[var(--q-amber)]',
              'shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.04)] transition-colors hover:bg-[var(--q-amber-trace)]/80',
            )}
          >
            <Sparkles size={15} className="shrink-0" strokeWidth={1.8} />
            <span className="hidden xl:inline">Ask the Brain</span>
          </button>

          <div className="ml-1 flex items-center gap-2 pl-2">
            <ToolbarIconButton
              label="Toggle theme"
              icon={Sun}
              onClick={() => setPlaceholderOpen('theme')}
              testId="toolbar-theme"
            />
            <ToolbarIconButton
              label="Notifications"
              icon={Bell}
              onClick={() => setPlaceholderOpen('notifications')}
              testId="toolbar-notifications"
            />
            <UserMenu />
          </div>
        </div>

        <Dialog open={placeholderOpen !== null} onOpenChange={(o) => !o && setPlaceholderOpen(null)}>
          <DialogContent className="border-[var(--q-border-feature)] bg-[var(--q-surface-feature)] text-[var(--q-text)]">
            <DialogHeader>
              <DialogTitle className="font-[var(--q-font-display)] tracking-wide">
                {placeholderOpen === 'theme' ? 'Theme' : 'Notifications'}
              </DialogTitle>
              <DialogDescription className="text-[var(--q-text-dim)]">
                {placeholderOpen === 'theme'
                  ? 'QuiverDM is dark-first by design. A light/sepia option may arrive in a later slice.'
                  : 'No new notifications. A real notifications feed lands with Slice D.'}
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </header>
    </Surface>
  )
}
