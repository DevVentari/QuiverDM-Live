'use client'

import Link from 'next/link'
import { Card } from '@/components/primitives'
import { format } from 'date-fns'
import { ChevronRight } from 'lucide-react'

type Session = {
  id: string
  sessionNumber: number
  title: string | null
  date: Date | string | null
  status: string
  recap?: string | null
  quickNotes?: string | null
  durationMinutes?: number | null
}

interface RecentSessionsListProps {
  sessions: Session[]
}

function summarize(session: Session): string {
  const text = session.recap ?? session.quickNotes ?? ''
  const trimmed = text.trim()
  if (!trimmed) return ''
  return trimmed.length > 110 ? `${trimmed.slice(0, 107)}...` : trimmed
}

function durationLabel(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null
  const hours = minutes / 60
  if (hours < 1) return `${minutes}m`
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} hrs`
}

export function RecentSessionsList({ sessions }: RecentSessionsListProps) {
  return (
    <Card variant="list" className="relative overflow-hidden !p-0">
      <div className="relative">
        <div className="flex items-center gap-3 border-b border-[color-mix(in_oklab,var(--q-border-subtle)_66%,transparent)] px-4 py-3.5">
          <span className="font-[var(--q-font-display)] text-[9px] font-medium uppercase tracking-[3px] text-[var(--q-accent-primary-dim)]">
            Recent Sessions
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-[color-mix(in_oklab,var(--q-border-feature)_72%,transparent)] to-transparent" />
          <Link
            href="/sessions"
            className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[2px] text-[var(--q-accent-primary-dim)] transition-colors hover:text-[var(--q-accent-primary)]"
          >
            View All Sessions
            <ChevronRight size={12} />
          </Link>
        </div>

        <div className="px-4 py-3.5">
          {sessions.length === 0 ? (
            <p className="py-5 text-sm text-[var(--q-text-faint)]">No sessions yet.</p>
          ) : (
            <div className="flex flex-col">
              {sessions.map((s, i) => {
                const summary = summarize(s)
                const date = s.date ? format(new Date(s.date), 'MMM d, yyyy') : null
                const duration = durationLabel(s.durationMinutes)

                return (
                  <Link
                    key={s.id}
                  href={`/session/${s.id}`}
                  data-testid={`recent-session-${i}`}
                  className="group block border-t border-[color-mix(in_oklab,var(--q-border-subtle)_62%,transparent)] first:border-t-0"
                >
                    <div className="grid min-h-[76px] grid-cols-[50px_minmax(0,1fr)_18px] gap-3.5 py-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--q-border-subtle)_62%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--q-surface-raised)_66%,transparent),color-mix(in_oklab,var(--q-bg)_44%,transparent))] font-[var(--q-font-display)] text-[1.3rem] text-[var(--q-text-faint)] tabular-nums shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.03)]">
                        {s.sessionNumber}
                      </span>
                      <div className="min-w-0 self-center">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <div className="truncate font-[var(--q-font-display)] text-[1rem] text-[var(--q-text)]">
                            {s.title ?? `Session ${s.sessionNumber}`}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] uppercase tracking-[1.6px] text-[var(--q-text-faint)]">
                            <span className="whitespace-nowrap tabular-nums">{date ?? '-'}</span>
                            {duration && <span className="whitespace-nowrap tabular-nums">{duration}</span>}
                          </div>
                        </div>
                        <div className="mt-1.5 max-w-[52ch] text-[13px] leading-6 text-[var(--q-text-dim)]">
                          {summary || <span className="text-[var(--q-text-faint)]">No recap recorded yet.</span>}
                        </div>
                      </div>
                      <ChevronRight
                        size={14}
                        className="shrink-0 self-center text-[var(--q-text-faint)] transition-colors group-hover:text-[var(--q-accent-primary-dim)]"
                      />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
