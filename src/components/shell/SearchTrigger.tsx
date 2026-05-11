'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  BookMarked,
  CalendarDays,
  Users,
  Globe,
  Library,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'

const RECENT_KEY = 'qd:search:recent'
const RECENT_MAX = 5
const DEBOUNCE_MS = 200

const TYPE_ORDER = [
  'campaign',
  'session',
  'npc',
  'world_entity',
  'world_entry',
  'homebrew',
] as const

type GlobalType = (typeof TYPE_ORDER)[number]

const TYPE_LABEL: Record<GlobalType, string> = {
  campaign: 'Campaigns',
  session: 'Sessions',
  npc: 'NPCs',
  world_entity: 'World',
  world_entry: 'World Notes',
  homebrew: 'Homebrew',
}

const TYPE_ICON: Record<GlobalType, LucideIcon> = {
  campaign: BookMarked,
  session: CalendarDays,
  npc: Users,
  world_entity: Globe,
  world_entry: Library,
  homebrew: Wand2,
}

interface ResultItem {
  type: GlobalType
  id: string
  title: string
  subtitle: string | null
  campaignId: string | null
  href: string
}

interface RecentEntry extends ResultItem {
  q: string
}

function loadRecent(): RecentEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, RECENT_MAX) as RecentEntry[]
  } catch {
    return []
  }
}

function saveRecent(item: RecentEntry) {
  if (typeof window === 'undefined') return
  try {
    const current = loadRecent()
    const filtered = current.filter(
      (r) => !(r.type === item.type && r.id === item.id)
    )
    const next = [item, ...filtered].slice(0, RECENT_MAX)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // localStorage quota / SecurityError — non-fatal
  }
}

export function SearchTrigger() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [recent, setRecent] = useState<RecentEntry[]>([])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) setRecent(loadRecent())
  }, [open])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const enabled = open && debouncedQ.length > 0
  const { data, isFetching } = trpc.search.global.useQuery(
    { q: debouncedQ, limitPerType: 5 },
    { enabled, staleTime: 30_000, refetchOnWindowFocus: false }
  )

  const grouped = useMemo(() => {
    const map = new Map<GlobalType, ResultItem[]>()
    if (!data?.results) return map
    for (const r of data.results as ResultItem[]) {
      const list = map.get(r.type) ?? []
      list.push(r)
      map.set(r.type, list)
    }
    return map
  }, [data])

  function handleSelect(item: ResultItem) {
    saveRecent({ ...item, q: debouncedQ })
    setOpen(false)
    setQuery('')
    setDebouncedQ('')
    router.push(item.href)
  }

  const showRecent = !debouncedQ && recent.length > 0
  const totalResults = data?.results.length ?? 0
  const showEmpty = !!debouncedQ && !isFetching && totalResults === 0
  const showLoading = !!debouncedQ && isFetching && totalResults === 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search everything (Ctrl+K)"
        data-testid="search-trigger"
        className={cn(
          'group inline-flex h-11 w-full max-w-[25rem] items-center gap-3 rounded-xl',
          'border border-[var(--q-border-subtle)] bg-[var(--q-surface-utility)]/80 px-4',
          'text-[15px] text-[var(--q-text-faint)] shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.03)]',
          'transition-colors hover:border-[var(--q-amber-border)] hover:text-[var(--q-text-dim)]',
        )}
      >
        <Search size={17} className="shrink-0 text-[var(--q-text-faint)]" strokeWidth={1.8} />
        <span className="flex-1 text-left">Search everything…</span>
        <span className="hidden shrink-0 items-center gap-1 rounded-lg border border-[var(--q-border-subtle)] bg-black/10 px-2.5 py-1 text-[11px] text-[var(--q-text-faint)] sm:inline-flex">
          <span className="text-[10px]">⌘</span>
          <span>K</span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="overflow-hidden p-0 border-[var(--q-border-feature)] bg-[var(--q-surface-feature)] text-[var(--q-text)] sm:max-w-2xl"
          data-testid="search-dialog"
        >
          <Command
            shouldFilter={false}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--q-text-faint)] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-4 [&_[cmdk-input-wrapper]_svg]:w-4 bg-transparent text-[var(--q-text)]"
          >
            <CommandInput
              placeholder="Search campaigns, sessions, NPCs, world…"
              value={query}
              onValueChange={setQuery}
              data-testid="search-input"
            />
            <CommandList className="max-h-[420px]">
              {showRecent && (
                <CommandGroup heading="Recent">
                  {recent.map((r) => {
                    const Icon = TYPE_ICON[r.type] ?? Search
                    return (
                      <CommandItem
                        key={`recent-${r.type}-${r.id}`}
                        value={`recent-${r.type}-${r.id}`}
                        onSelect={() => handleSelect(r)}
                      >
                        <Icon className="text-[var(--q-text-faint)]" />
                        <span className="flex-1 truncate">{r.title}</span>
                        <span className="text-[10px] uppercase tracking-wider text-[var(--q-text-faint)]">
                          {TYPE_LABEL[r.type]}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )}

              {showLoading && (
                <CommandEmpty>Searching…</CommandEmpty>
              )}
              {showEmpty && (
                <CommandEmpty>
                  Nothing found for &ldquo;{debouncedQ}&rdquo;
                </CommandEmpty>
              )}

              {TYPE_ORDER.map((type) => {
                const items = grouped.get(type)
                if (!items || items.length === 0) return null
                const Icon = TYPE_ICON[type]
                return (
                  <CommandGroup key={type} heading={TYPE_LABEL[type]}>
                    {items.map((r) => (
                      <CommandItem
                        key={`${type}-${r.id}`}
                        value={`${type}-${r.id}-${r.title}`}
                        onSelect={() => handleSelect(r)}
                      >
                        <Icon className="text-[var(--q-amber-dim)]" />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{r.title}</span>
                          {r.subtitle && (
                            <span className="truncate text-xs text-[var(--q-text-faint)]">
                              {r.subtitle}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })}

              {!debouncedQ && !showRecent && (
                <div className="px-4 py-8 text-center text-xs text-[var(--q-text-faint)]">
                  Start typing to search across campaigns, sessions, NPCs, world notes, and homebrew.
                </div>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
