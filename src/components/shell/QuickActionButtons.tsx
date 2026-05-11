'use client'

import { useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  CirclePlus,
  Dices,
  Map,
} from 'lucide-react'
import { QuickAddSheet } from './QuickAddSheet'
import { CalendarSheet } from './CalendarSheet'
import { DMToolsSheet } from './DMToolsSheet'
import { RandomizerSheet } from './RandomizerSheet'
import { cn } from '@/lib/utils'

const TOOLBAR_BUTTON_CLASS = cn(
  'inline-flex h-11 items-center gap-2.5 rounded-xl border border-[var(--q-border-subtle)]',
  'bg-[var(--q-surface-utility)]/80 px-4 text-[13px] text-[var(--q-text-dim)]',
  'shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.03)] transition-colors',
  'hover:border-[var(--q-amber-border)] hover:bg-[var(--q-amber-trace)]/60 hover:text-[var(--q-text)]',
)

export function QuickActionButtons() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [randomizerOpen, setRandomizerOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [dmToolsOpen, setDmToolsOpen] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          data-testid="quick-action-quick-add"
          className={TOOLBAR_BUTTON_CLASS}
        >
          <CirclePlus size={16} className="shrink-0 text-[var(--q-text-faint)]" strokeWidth={1.8} />
          <span className="hidden lg:inline">Quick Add</span>
        </button>

        <button
          type="button"
          onClick={() => setRandomizerOpen(true)}
          data-testid="quick-action-randomizer"
          className={TOOLBAR_BUTTON_CLASS}
        >
          <Dices size={16} className="shrink-0 text-[var(--q-text-faint)]" strokeWidth={1.8} />
          <span className="hidden lg:inline">Randomizer</span>
        </button>

        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          data-testid="quick-action-calendar"
          className={TOOLBAR_BUTTON_CLASS}
        >
          <CalendarDays size={16} className="shrink-0 text-[var(--q-text-faint)]" strokeWidth={1.8} />
          <span className="hidden lg:inline">Calendar</span>
        </button>

        <button
          type="button"
          onClick={() => setDmToolsOpen(true)}
          data-testid="quick-action-dm-tools"
          className={TOOLBAR_BUTTON_CLASS}
        >
          <Map size={16} className="shrink-0 text-[var(--q-text-faint)]" strokeWidth={1.8} />
          <span className="hidden lg:inline">DM Tools</span>
          <ChevronDown
            size={14}
            className="hidden lg:inline shrink-0 text-[var(--q-text-faint)]"
            strokeWidth={1.8}
          />
        </button>
      </div>

      <QuickAddSheet open={quickAddOpen} onOpenChange={setQuickAddOpen} />
      <RandomizerSheet open={randomizerOpen} onOpenChange={setRandomizerOpen} />
      <CalendarSheet open={calendarOpen} onOpenChange={setCalendarOpen} />
      <DMToolsSheet open={dmToolsOpen} onOpenChange={setDmToolsOpen} />
    </>
  )
}
