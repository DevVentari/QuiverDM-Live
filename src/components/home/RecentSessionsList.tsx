'use client'

import Link from 'next/link'
import { Card, Section } from '@/components/primitives'
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
  return trimmed.length > 80 ? trimmed.slice(0, 77) + '…' : trimmed
}

function durationLabel(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null
  const hours = minutes / 60
  if (hours < 1) return `${minutes}m`
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} hrs`
}

export function RecentSessionsList({ sessions }: RecentSessionsListProps) {
  return (
    <Section
      label="Recent Sessions"
      action={
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[2px] text-[var(--q-amber-dim)] hover:text-[var(--q-amber)] transition-colors"
        >
          View All Sessions
          <ChevronRight size={12} />
        </Link>
      }
    >
      <div className="flex flex-col gap-1.5">
        {sessions.length === 0 && (
          <p className="text-[var(--q-text-faint)] text-sm py-2">No sessions yet.</p>
        )}
        {sessions.map((s, i) => {
          const summary = summarize(s)
          const date = s.date ? format(new Date(s.date), 'MMM d, yyyy') : null
          const duration = durationLabel(s.durationMinutes)
          return (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              data-testid={`recent-session-${i}`}
              className="block group"
            >
              <Card
                variant="list"
                className="grid grid-cols-[40px_1fr_auto_auto_auto] items-center gap-4 group-hover:border-[var(--q-amber-dim)] transition-colors"
              >
                <span className="font-[var(--q-font-display)] text-2xl text-[var(--q-text-faint)] tabular-nums">
                  {s.sessionNumber}
                </span>
                <span className="text-sm text-[var(--q-text)] truncate">
                  {s.title ?? `Session ${s.sessionNumber}`}
                </span>
                <span className="text-xs text-[var(--q-text-faint)] tabular-nums whitespace-nowrap">
                  {date ?? '—'}
                </span>
                <span className="text-xs text-[var(--q-text-faint)] tabular-nums whitespace-nowrap">
                  {duration ?? ''}
                </span>
                <span className="hidden lg:block max-w-[280px] truncate text-xs text-[var(--q-text-dim)]">
                  {summary}
                </span>
              </Card>
            </Link>
          )
        })}
      </div>
    </Section>
  )
}
