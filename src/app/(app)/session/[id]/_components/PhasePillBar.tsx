'use client'

import { cn } from '@/lib/utils'
import type { SessionPhase } from '@/lib/session-lifecycle'

const PHASES: { id: SessionPhase; label: string }[] = [
  { id: 'prep',       label: 'Prep' },
  { id: 'ran',        label: 'Run' },
  { id: 'processing', label: 'Process' },
  { id: 'summary',    label: 'Summary' },
  { id: 'recap',      label: 'Recap' },
  { id: 'complete',   label: 'Complete' },
]

interface PhasePillBarProps {
  current: SessionPhase
}

export function PhasePillBar({ current }: PhasePillBarProps) {
  const currentIdx = PHASES.findIndex((p) => p.id === current)

  return (
    <div
      data-testid="phase-pill-bar"
      className="flex items-center gap-1 px-5 py-3 border-b border-[var(--q-border-subtle)] overflow-x-auto"
    >
      {PHASES.map(({ id, label }, idx) => {
        const isActive = id === current
        const isDone = idx < currentIdx

        return (
          <div
            key={id}
            data-testid={`phase-pill-${id}`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs shrink-0',
              isActive && 'bg-[var(--q-amber)] text-[var(--q-bg)] font-semibold',
              isDone && 'text-[var(--q-text-dim)]',
              !isActive && !isDone && 'text-[var(--q-text-faint)]',
            )}
          >
            {isDone && <span className="text-[var(--q-amber)] text-[10px]">✓</span>}
            <span className="font-[var(--q-font-display)] tracking-wide">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
