'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { useCampaign } from '@/components/campaign/campaign-context'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/primitives'
import { Sparkles } from 'lucide-react'
import { MechanicCard } from '@/components/mechanics/mechanic-card'
import { MechanicFilterRail, type MechanicKindFilter } from '@/components/mechanics/mechanic-filter-rail'
import { MechanicInspector } from '@/components/mechanics/mechanic-inspector'
import { MechanicCreateSheet } from '@/components/mechanics/mechanic-create-sheet'

export default function MechanicsPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-220px)] animate-pulse rounded-sm bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)]" />}>
      <MechanicsPageInner />
    </Suspense>
  )
}

function MechanicsPageInner() {
  const { campaignId, isDM } = useCampaign()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<MechanicKindFilter>('all')
  const [sourcebookFilter, setSourcebookFilter] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === 'true')
  const selectedId = searchParams.get('mechanic')

  useEffect(() => {
    if (searchParams.get('create') === 'true') setCreateOpen(true)
  }, [searchParams])

  function setUrlParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    const q = params.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }

  const list = trpc.mechanics.list.useQuery({ campaignId }, { staleTime: 60_000 })
  const rows = (list.data ?? []) as Array<{
    id: string; kind: string; name: string; description: string | null;
    sourcebook: string | null; playerVisible: boolean;
    assignedToCharacterId: string | null; content: Record<string, unknown>;
  }>

  const sourcebooks = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.sourcebook) set.add(r.sourcebook)
    return Array.from(set).sort()
  }, [rows])

  const counts = useMemo(() => ({
    all: rows.length,
    secret: rows.filter((r) => r.kind === 'secret').length,
    tarot: rows.filter((r) => r.kind === 'tarot').length,
  }), [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (kindFilter !== 'all' && r.kind !== kindFilter) return false
      if (sourcebookFilter && r.sourcebook !== sourcebookFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const flavor = String(r.content?.flavorText ?? r.content?.interpretation ?? '').toLowerCase()
        if (!r.name.toLowerCase().includes(q) && !flavor.includes(q)) return false
      }
      return true
    })
  }, [rows, kindFilter, sourcebookFilter, search])

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <p className="font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase">Campaign</p>
          <h1 className="font-[var(--q-font-display)] text-3xl md:text-4xl text-[var(--q-text)] mt-1">Mechanics</h1>
        </div>
        <div className="text-right">
          <div className="font-[var(--q-font-display)] text-2xl text-[var(--q-text)] tabular-nums">{filtered.length}</div>
          <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
            {filtered.length === rows.length ? 'in campaign' : `of ${rows.length}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <MechanicFilterRail
          kindFilter={kindFilter}
          onKindFilterChange={setKindFilter}
          sourcebookFilter={sourcebookFilter}
          onSourcebookFilterChange={setSourcebookFilter}
          sourcebooks={sourcebooks}
          search={search}
          onSearchChange={setSearch}
          counts={counts}
          isDM={isDM}
          onCreate={() => setCreateOpen(true)}
        />

        <div className="min-w-0">
          {list.isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            rows.length === 0 ? (
              <Card variant="detail" className="flex flex-col items-center justify-center gap-6 py-28 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--q-amber-border)] bg-[var(--q-amber-trace)]">
                  <Sparkles size={22} className="text-[var(--q-amber)]" />
                </div>
                <div className="space-y-2 max-w-xs">
                  <p className="font-[var(--q-font-display)] text-[10px] uppercase tracking-[2.5px] text-[var(--q-amber-dim)]">
                    Nothing here yet
                  </p>
                  <p className="font-[var(--q-font-display)] text-xl text-[var(--q-text-dim)]">
                    The veil holds no secrets
                  </p>
                  <p className="text-sm leading-relaxed text-[var(--q-text-faint)]">
                    Mechanics let you track campaign secrets, Tarokka readings, and hidden truths the world carries — visible only when you choose to reveal them.
                  </p>
                </div>
                {isDM && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="rounded-sm border border-[var(--q-amber-border)] bg-[var(--q-amber-trace)] px-5 py-2.5 font-[var(--q-font-display)] text-[11px] uppercase tracking-[2px] text-[var(--q-amber)] transition-colors hover:bg-[color-mix(in_oklab,var(--q-amber-trace)_150%,transparent)]"
                  >
                    Add first mechanic
                  </button>
                )}
              </Card>
            ) : (
              <Card variant="detail" className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <p className="font-[var(--q-font-display)] text-[10px] uppercase tracking-[2.5px] text-[var(--q-text-faint)]">
                  No results
                </p>
                <p className="text-sm text-[var(--q-text-dim)]">No mechanics match those filters</p>
                <button
                  type="button"
                  onClick={() => { setSearch(''); setKindFilter('all'); setSourcebookFilter(null); }}
                  className="mt-1 text-[11px] uppercase tracking-[2px] text-[var(--q-text-faint)] underline-offset-2 hover:text-[var(--q-text-dim)] hover:underline"
                >
                  Clear filters
                </button>
              </Card>
            )
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
              {filtered.map((m) => (
                <MechanicCard key={m.id} mechanic={m} onClick={() => setUrlParam('mechanic', m.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setUrlParam('mechanic', null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto" data-testid="mechanic-inspector-sheet">
          {selectedId && <MechanicInspector mechanicId={selectedId} campaignId={campaignId} isDM={isDM} />}
        </SheetContent>
      </Sheet>

      <MechanicCreateSheet
        campaignId={campaignId}
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setUrlParam('create', null)
        }}
        onCreated={(id) => setUrlParam('mechanic', id)}
      />
    </div>
  )
}
