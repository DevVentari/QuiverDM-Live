'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Surface } from '@/components/primitives'
import { cn } from '@/lib/utils'

export function SearchTrigger() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search everything (Ctrl+K)"
        data-testid="search-trigger"
        className={cn(
          'group inline-flex w-full max-w-md items-center gap-3 rounded-sm',
          'border border-[var(--q-border-subtle)] bg-[var(--q-amber-trace)]/30',
          'px-3 py-1.5 text-sm text-[var(--q-text-faint)]',
          'transition-colors hover:border-[var(--q-amber-dim)] hover:text-[var(--q-text-dim)]',
        )}
      >
        <Search size={14} className="shrink-0" />
        <span className="flex-1 text-left">Search everything…</span>
        <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-utility)]/50 px-1.5 py-0.5 text-[10px] tracking-wide text-[var(--q-text-faint)]">
          &#x2318;K
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[var(--q-border-feature)] bg-[var(--q-surface-feature)] text-[var(--q-text)]">
          <DialogHeader>
            <DialogTitle className="font-[var(--q-font-display)] tracking-wide">
              Global Search
            </DialogTitle>
            <DialogDescription className="text-[var(--q-text-dim)]">
              Coming in Slice D — search will span campaigns, sessions, NPCs, items, locations, lore, monsters, and more.
            </DialogDescription>
          </DialogHeader>
          <Surface variant="utility" className="p-4 text-xs text-[var(--q-text-faint)]">
            <p>For now, navigate via the rail or the home page. Press <span className="font-mono">Esc</span> to close.</p>
          </Surface>
        </DialogContent>
      </Dialog>
    </>
  )
}
