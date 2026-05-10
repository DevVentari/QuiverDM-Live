'use client'

import { useState } from 'react'
import { Sparkles, Sun, Bell } from 'lucide-react'
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
  icon: React.ComponentType<{ size?: number; className?: string }>
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
        'inline-flex h-8 w-8 items-center justify-center rounded-sm',
        'text-[var(--q-text-faint)] transition-colors',
        'hover:text-[var(--q-text)] hover:bg-white/[0.04]',
      )}
    >
      <Icon size={16} />
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
        'hidden h-[var(--q-command-bar-h,56px)] shrink-0 items-center gap-3 rounded-none border-x-0 border-t-0 px-4 md:flex',
        'bg-[var(--q-shell-bar)] backdrop-blur-md',
      )}
    >
      <header>
        <div className="flex flex-1 items-center">
          <SearchTrigger />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setBrainOpen(true)}
            aria-label="Open Brain (Ctrl+B)"
            data-testid="brain-trigger"
            className={cn(
              'inline-flex items-center gap-2 rounded-sm border border-[var(--q-amber-dim)]',
              'bg-[var(--q-amber-trace)] px-3 py-1.5 text-xs',
              'text-[var(--q-amber)] transition-colors hover:bg-[var(--q-amber-trace)]/70',
            )}
          >
            <Sparkles size={13} className="shrink-0" />
            <span className="hidden lg:inline">Ask the Brain</span>
          </button>

          <QuickActionButtons />

          <div className="ml-2 flex items-center gap-1 border-l border-[var(--q-border-subtle)] pl-3">
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
