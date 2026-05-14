'use client'

import { trpc } from '@/lib/trpc'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/primitives'

interface MechanicInspectorProps {
  mechanicId: string
  campaignId: string
  isDM: boolean
}

export function MechanicInspector({ mechanicId, campaignId, isDM }: MechanicInspectorProps) {
  const utils = trpc.useUtils()
  const mechanic = trpc.mechanics.getById.useQuery({ id: mechanicId }, { staleTime: 60_000 })

  const charactersQuery = trpc.characters.getCampaignCharacters.useQuery(
    { campaignId },
    { staleTime: 120_000, enabled: isDM },
  )
  const characters: Array<{ id: string; name: string }> = (charactersQuery.data ?? [])
    .map((cc: any) => {
      const id = cc?.character?.id ?? cc?.characterId
      const name = cc?.character?.name ?? cc?.name
      return id && name ? { id, name } : null
    })
    .filter((x: { id: string; name: string } | null): x is { id: string; name: string } => x !== null)

  const assign = trpc.mechanics.assignToCharacter.useMutation({
    onSuccess: () => {
      void utils.mechanics.getById.invalidate({ id: mechanicId })
      void utils.mechanics.list.invalidate({ campaignId })
    },
  })

  const togglePlayerVisible = trpc.mechanics.update.useMutation({
    onSuccess: () => {
      void utils.mechanics.getById.invalidate({ id: mechanicId })
      void utils.mechanics.list.invalidate({ campaignId })
    },
  })

  if (mechanic.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }
  if (mechanic.isError || !mechanic.data) {
    return <div className="p-6 text-sm text-[var(--q-text-dim)]">Failed to load mechanic.</div>
  }

  const m = mechanic.data
  const content = (m.content ?? {}) as Record<string, unknown>

  return (
    <div className="flex h-full flex-col">
      <header className="p-6 border-b border-[var(--q-border-subtle)] space-y-3">
        <p className="font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase">
          {m.kind === 'secret' ? 'Secret' : m.kind === 'tarot' ? 'Tarokka card' : m.kind}
          {m.sourcebook ? ` · ${m.sourcebook.toUpperCase()}` : ''}
        </p>
        <h2 className="font-[var(--q-font-display)] text-2xl text-[var(--q-text)]">{m.name}</h2>
        <div className="flex flex-wrap gap-2">
          <Pill variant={m.playerVisible ? 'success' : 'neutral'}>
            {m.playerVisible ? 'Visible to players' : 'DM only'}
          </Pill>
          {m.assignedToCharacterId && <Pill variant="neutral">Assigned</Pill>}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {m.kind === 'secret' && <SecretBody content={content} isDM={isDM} />}
        {m.kind === 'tarot' && <TarotBody content={content} />}

        {isDM && (
          <div className="space-y-3 pt-4 border-t border-[var(--q-border-subtle)]">
            <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">DM controls</p>
            <div className="flex flex-col gap-2">
              <select
                value={m.assignedToCharacterId ?? ''}
                onChange={(e) => assign.mutate({ id: m.id, characterId: e.target.value || null })}
                className="rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-sunken)] px-3 py-2 text-sm text-[var(--q-text)]"
                data-testid="mechanic-assign-select"
              >
                <option value="">Unassigned</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => togglePlayerVisible.mutate({ id: m.id, playerVisible: !m.playerVisible })}
                data-testid="mechanic-toggle-visible"
              >
                {m.playerVisible ? 'Hide from players' : 'Reveal to players'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SecretBody({ content, isDM }: { content: Record<string, unknown>; isDM: boolean }) {
  return (
    <>
      <section className="space-y-2">
        <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">Flavor</p>
        <p className="text-sm text-[var(--q-text)] leading-relaxed">{String(content.flavorText ?? '')}</p>
      </section>
      {isDM && typeof content.hiddenTruth === 'string' && (
        <section className="space-y-2">
          <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-amber)]">DM-only · Hidden truth</p>
          <p className="text-sm text-[var(--q-text)] leading-relaxed">{content.hiddenTruth}</p>
        </section>
      )}
      {typeof content.mechanicalEffect === 'string' && (
        <section className="space-y-2">
          <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">Mechanical effect</p>
          <p className="text-sm text-[var(--q-text-dim)]">{content.mechanicalEffect}</p>
        </section>
      )}
    </>
  )
}

function TarotBody({ content }: { content: Record<string, unknown> }) {
  return (
    <>
      <section className="space-y-2">
        <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
          {String(content.cardName ?? '')} · {String(content.suit ?? '')}
        </p>
        <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
          Position: {String(content.divinationPosition ?? '')}
        </p>
      </section>
      <section className="space-y-2">
        <p className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">Interpretation</p>
        <p className="text-sm text-[var(--q-text)] leading-relaxed">{String(content.interpretation ?? '')}</p>
      </section>
    </>
  )
}
