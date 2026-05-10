'use client'

import { useState } from 'react'
import { PlusCircle, Dices, Calendar, Wand2, type LucideIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Surface } from '@/components/primitives'
import { QuickAddSheet } from './QuickAddSheet'
import { CalendarSheet } from './CalendarSheet'
import { DMToolsSheet } from './DMToolsSheet'
import { cn } from '@/lib/utils'

type QuickAction = {
  id: string
  label: string
  icon: LucideIcon
  description: string
}

const PLACEHOLDER_ACTIONS: QuickAction[] = [
  {
    id: 'randomizer',
    label: 'Randomizer',
    icon: Dices,
    description: 'Roll on tables, generate names, fates, and oracles — coming in Slice D5.',
  },
]

const TOOLBAR_BUTTON_CLASS = cn(
  'inline-flex items-center gap-2 rounded-sm border border-[var(--q-border-subtle)]',
  'px-3 py-1.5 text-xs text-[var(--q-text-dim)]',
  'transition-colors hover:border-[var(--q-amber-dim)] hover:text-[var(--q-text)]',
)

export function QuickActionButtons() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [dmToolsOpen, setDmToolsOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = PLACEHOLDER_ACTIONS.find((a) => a.id === activeId) ?? null

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          data-testid="quick-action-quick-add"
          className={TOOLBAR_BUTTON_CLASS}
        >
          <PlusCircle size={13} className="shrink-0" />
          <span className="hidden md:inline">Quick Add</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveId('randomizer')}
          data-testid="quick-action-randomizer"
          className={TOOLBAR_BUTTON_CLASS}
        >
          <Dices size={13} className="shrink-0" />
          <span className="hidden md:inline">Randomizer</span>
        </button>

        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          data-testid="quick-action-calendar"
          className={TOOLBAR_BUTTON_CLASS}
        >
          <Calendar size={13} className="shrink-0" />
          <span className="hidden md:inline">Calendar</span>
        </button>

        <button
          type="button"
          onClick={() => setDmToolsOpen(true)}
          data-testid="quick-action-dm-tools"
          className={TOOLBAR_BUTTON_CLASS}
        >
          <Wand2 size={13} className="shrink-0" />
          <span className="hidden md:inline">DM Tools</span>
        </button>
      </div>

      <QuickAddSheet open={quickAddOpen} onOpenChange={setQuickAddOpen} />
      <CalendarSheet open={calendarOpen} onOpenChange={setCalendarOpen} />
      <DMToolsSheet open={dmToolsOpen} onOpenChange={setDmToolsOpen} />

      <Dialog open={!!active} onOpenChange={(o) => !o && setActiveId(null)}>
        <DialogContent className="border-[var(--q-border-feature)] bg-[var(--q-surface-feature)] text-[var(--q-text)]">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="font-[var(--q-font-display)] tracking-wide">
                  {active.label}
                </DialogTitle>
                <DialogDescription className="text-[var(--q-text-dim)]">
                  {active.description}
                </DialogDescription>
              </DialogHeader>
              <Surface variant="utility" className="p-4 text-xs text-[var(--q-text-faint)]">
                <p>Press <span className="font-mono">Esc</span> to close.</p>
              </Surface>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
