'use client'

import { Sparkles, Book, Eye, Users, Search, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type NpcSourceFilter = 'all' | 'dm' | 'imported' | 'seen'

interface NpcFilterRailProps {
  sourceFilter: NpcSourceFilter
  onSourceFilterChange: (f: NpcSourceFilter) => void
  factionFilter: string | null
  onFactionFilterChange: (f: string | null) => void
  factions: string[]
  search: string
  onSearchChange: (s: string) => void
  counts: { all: number; dm: number; imported: number; seen: number }
  isDM: boolean
  onCreate: () => void
}

const SOURCE_OPTIONS: Array<{
  id: NpcSourceFilter
  label: string
  icon: typeof Users
  countKey: keyof NpcFilterRailProps['counts']
}> = [
  { id: 'all',      label: 'All NPCs',      icon: Users,    countKey: 'all' },
  { id: 'dm',       label: 'DM-created',    icon: Sparkles, countKey: 'dm' },
  { id: 'imported', label: 'From sourcebook', icon: Book,   countKey: 'imported' },
  { id: 'seen',     label: 'Encountered',   icon: Eye,      countKey: 'seen' },
]

export function NpcFilterRail({
  sourceFilter,
  onSourceFilterChange,
  factionFilter,
  onFactionFilterChange,
  factions,
  search,
  onSearchChange,
  counts,
  isDM,
  onCreate,
}: NpcFilterRailProps) {
  return (
    <aside className="flex flex-col gap-5 w-full">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--q-text-faint)]"
        />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search NPCs"
          className="h-9 pl-9 text-sm"
          data-testid="npc-filter-search"
        />
      </div>

      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)] mb-2">
          Filter by source
        </p>
        {SOURCE_OPTIONS.map(({ id, label, icon: Icon, countKey }) => {
          const active = sourceFilter === id
          const count = counts[countKey]
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSourceFilterChange(id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                  : 'text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)]',
              )}
              data-testid={`npc-filter-source-${id}`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              <span
                className={cn(
                  'tabular-nums text-[10px]',
                  active ? 'text-[var(--q-amber)]' : 'text-[var(--q-text-faint)]',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {factions.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)] mb-2">
            Filter by faction
          </p>
          <button
            type="button"
            onClick={() => onFactionFilterChange(null)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-sm px-3 py-1.5 text-sm transition-colors',
              factionFilter === null
                ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                : 'text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)]',
            )}
          >
            <span className="flex-1 text-left">All factions</span>
          </button>
          <div className="max-h-64 overflow-y-auto">
            {factions.map((f) => {
              const active = factionFilter === f
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFactionFilterChange(active ? null : f)}
                  className={cn(
                    'flex w-full items-center rounded-sm px-3 py-1.5 text-sm transition-colors text-left truncate',
                    active
                      ? 'bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
                      : 'text-[var(--q-text-dim)] hover:bg-white/[0.03] hover:text-[var(--q-text)]',
                  )}
                >
                  {f}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {isDM && (
        <div className="pt-2 border-t border-[var(--q-border-subtle)]">
          <Button
            onClick={onCreate}
            variant="default"
            size="sm"
            className="w-full justify-start"
            data-testid="npc-filter-new"
          >
            <Plus size={14} className="mr-2" />
            New NPC
          </Button>
        </div>
      )}
    </aside>
  )
}
