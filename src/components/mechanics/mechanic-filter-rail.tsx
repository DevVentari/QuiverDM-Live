'use client'

import { Eye, Sparkles, Plus, Search, Layers } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type MechanicKindFilter = 'all' | 'secret' | 'tarot'

interface MechanicFilterRailProps {
  kindFilter: MechanicKindFilter
  onKindFilterChange: (k: MechanicKindFilter) => void
  sourcebookFilter: string | null
  onSourcebookFilterChange: (s: string | null) => void
  sourcebooks: string[]
  search: string
  onSearchChange: (s: string) => void
  counts: { all: number; secret: number; tarot: number }
  isDM: boolean
  onCreate: () => void
}

const KIND_OPTIONS: Array<{ id: MechanicKindFilter; label: string; icon: typeof Layers; countKey: keyof MechanicFilterRailProps['counts'] }> = [
  { id: 'all',    label: 'All mechanics', icon: Layers,   countKey: 'all' },
  { id: 'secret', label: 'Secrets',       icon: Eye,      countKey: 'secret' },
  { id: 'tarot',  label: 'Tarokka',       icon: Sparkles, countKey: 'tarot' },
]

export function MechanicFilterRail({
  kindFilter, onKindFilterChange,
  sourcebookFilter, onSourcebookFilterChange, sourcebooks,
  search, onSearchChange, counts, isDM, onCreate,
}: MechanicFilterRailProps) {
  return (
    <aside className="flex flex-col gap-5 w-full">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--q-text-faint)]" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search mechanics"
          className="h-9 pl-9 text-sm"
          data-testid="mechanic-filter-search"
        />
      </div>

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)] mb-2">Filter by kind</p>
        {KIND_OPTIONS.map(({ id, label, icon: Icon, countKey }) => {
          const active = kindFilter === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onKindFilterChange(id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                  : 'text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)]',
              )}
              data-testid={`mechanic-filter-${id}`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              <span className={cn('tabular-nums text-[10px]', active ? 'text-[var(--q-amber)]' : 'text-[var(--q-text-faint)]')}>
                {counts[countKey]}
              </span>
            </button>
          )
        })}
      </div>

      {sourcebooks.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)] mb-2">Filter by sourcebook</p>
          <button
            type="button"
            onClick={() => onSourcebookFilterChange(null)}
            className={cn(
              'flex w-full items-center rounded-sm px-3 py-1.5 text-sm transition-colors',
              sourcebookFilter === null
                ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                : 'text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)]',
            )}
          >
            <span className="flex-1 text-left">All sourcebooks</span>
          </button>
          {sourcebooks.map((s) => {
            const active = sourcebookFilter === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSourcebookFilterChange(active ? null : s)}
                className={cn(
                  'flex w-full items-center rounded-sm px-3 py-1.5 text-sm transition-colors uppercase tracking-[1.5px] text-[10px]',
                  active
                    ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                    : 'text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)]',
                )}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}

      {isDM && (
        <div className="pt-2 border-t border-[var(--q-border-subtle)]">
          <Button onClick={onCreate} size="sm" className="w-full justify-start" data-testid="mechanic-create-trigger">
            <Plus size={14} className="mr-2" />
            New Mechanic
          </Button>
        </div>
      )}
    </aside>
  )
}
