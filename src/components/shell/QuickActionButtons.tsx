'use client'

import { useState } from 'react'
import { PlusCircle, Dices, Calendar, Wand2 } from 'lucide-react'
import { QuickAddSheet } from './QuickAddSheet'
import { CalendarSheet } from './CalendarSheet'
import { DMToolsSheet } from './DMToolsSheet'
import { RandomizerSheet } from './RandomizerSheet'
import { cn } from '@/lib/utils'

const TOOLBAR_BUTTON_CLASS = cn(
  'inline-flex items-center gap-2 rounded-sm border border-[var(--q-border-subtle)]',
  'px-3 py-1.5 text-xs text-[var(--q-text-dim)]',
  'transition-colors hover:border-[var(--q-amber-dim)] hover:text-[var(--q-text)]',
)

export function QuickActionButtons() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [randomizerOpen, setRandomizerOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [dmToolsOpen, setDmToolsOpen] = useState(false)

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
          onClick={() => setRandomizerOpen(true)}
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
      <RandomizerSheet open={randomizerOpen} onOpenChange={setRandomizerOpen} />
      <CalendarSheet open={calendarOpen} onOpenChange={setCalendarOpen} />
      <DMToolsSheet open={dmToolsOpen} onOpenChange={setDmToolsOpen} />
    </>
  )
}
