'use client'

import { useMemo } from 'react'
import { Swords, Skull } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'

interface InitiativePanelProps {
  campaignId: string
  sessionId: string
}

interface CombatantRow {
  actorId: string
  actorName: string
  initiative: number | null
  defeated: boolean
  hp?: number
  hpMax?: number
}

export function InitiativePanel({ campaignId, sessionId }: InitiativePanelProps) {
  const { data } = trpc.foundry.getEvents.useQuery(
    { campaignId, sessionId, limit: 100 },
    { refetchInterval: 3000 },
  )

  const { combatants, round } = useMemo(() => {
    const items = data?.items ?? []

    // Find the most recent initiative_set event (items ordered desc — first match wins)
    const initiativeEvent = items.find((e) => e.type === 'initiative_set')
    let combatants: CombatantRow[] = initiativeEvent
      ? ((initiativeEvent.payload as any).order ?? [])
      : []

    // Overlay latest HP from hp_change events
    const hpByActor: Record<string, { hp: number; hpMax: number }> = {}
    for (const event of items) {
      if (event.type === 'hp_change') {
        const p = event.payload as any
        if (!(p.actorId in hpByActor)) {
          hpByActor[p.actorId] = { hp: p.hp, hpMax: p.hpMax }
        }
      }
    }

    combatants = combatants.map((c) => ({
      ...c,
      ...(hpByActor[c.actorId] ?? {}),
    }))

    const round = initiativeEvent
      ? ((initiativeEvent.payload as any).round ?? 0)
      : 0

    return { combatants, round }
  }, [data])

  if (combatants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <Swords className="h-8 w-8 text-[var(--q-text-faint)]" />
        <p className="text-xs text-[var(--q-text-faint)]">
          No active combat. Sync to Foundry and start a combat encounter there.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0">
      {round > 0 && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-[9px] uppercase tracking-[2px] text-[var(--q-amber-dim)]">
            Round {round}
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-[var(--q-border-feature)] to-transparent" />
        </div>
      )}
      <ul className="flex flex-col gap-0.5">
        {[...combatants]
          .sort((a, b) => (b.initiative ?? -1) - (a.initiative ?? -1))
          .map((c, i) => {
            const hpPct = c.hpMax ? (c.hp ?? 0) / c.hpMax : null
            const barColor =
              hpPct === null ? ''
              : hpPct > 0.5 ? 'bg-emerald-500'
              : hpPct > 0.25 ? 'bg-amber-500'
              : 'bg-red-500'

            return (
              <li
                key={c.actorId}
                className={cn(
                  'flex items-center gap-2 rounded-sm px-2 py-2',
                  i === 0 && 'bg-white/[0.04]',
                  c.defeated && 'opacity-40',
                )}
              >
                <span className="w-5 shrink-0 text-right font-[var(--q-font-display)] text-[11px] text-[var(--q-amber)]">
                  {c.initiative ?? '—'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--q-text)]">
                  {c.actorName}
                </span>
                {c.defeated ? (
                  <Skull className="h-3 w-3 shrink-0 text-red-400" />
                ) : hpPct !== null ? (
                  <div className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--q-border-subtle)]">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor)}
                      style={{ width: `${Math.max(0, Math.min(100, hpPct * 100))}%` }}
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
      </ul>
    </div>
  )
}
