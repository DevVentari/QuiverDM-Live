'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, Plus, Trash2, ChevronRight, CheckSquare } from 'lucide-react'
import { Card, Pill } from '@/components/primitives'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import type { PrepItem, PrepReminder } from '@/lib/prep-types'

interface PrepRemindersProps {
  sessionId: string | null
  campaignSlug?: string | null
  reminders: PrepReminder[]
  prepItems?: PrepItem[]
}

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const PREP_STATUS_TONE: Record<PrepItem['status'], 'quest' | 'primary' | 'success' | 'neutral' | 'danger'> = {
  planned: 'quest',
  prepping: 'primary',
  prepped: 'success',
  used: 'neutral',
  dropped: 'danger',
}

const PREP_STATUS_LABEL: Record<PrepItem['status'], string> = {
  planned: 'Planned',
  prepping: 'Prepping',
  prepped: 'Prepped',
  used: 'Used',
  dropped: 'Dropped',
}

export function PrepReminders({ sessionId, campaignSlug, reminders: initial, prepItems = [] }: PrepRemindersProps) {
  const utils = trpc.useUtils()
  const [optimistic, setOptimistic] = useState<PrepReminder[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')

  const reminders = optimistic ?? initial
  const activePrepItems = useMemo(
    () =>
      [...prepItems]
        .filter((item) => item.status !== 'used' && item.status !== 'dropped')
        .sort((a, b) => a.title.localeCompare(b.title))
        .slice(0, 4),
    [prepItems],
  )

  const updatePrep = trpc.sessions.updatePrep.useMutation({
    onSettled: () => {
      void utils.sessions.getAll.invalidate()
    },
  })

  const persist = (next: PrepReminder[]) => {
    if (!sessionId) return
    setOptimistic(next)
    updatePrep.mutate(
      { id: sessionId, prepData: { reminders: next } },
      {
        onSettled: () => setOptimistic(null),
      },
    )
  }

  const toggle = (id: string) => {
    persist(reminders.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r)))
  }

  const remove = (id: string) => {
    persist(reminders.filter((r) => r.id !== id))
  }

  const submitDraft = () => {
    const title = draftTitle.trim()
    if (!title) {
      setAdding(false)
      return
    }
    const next: PrepReminder[] = [
      ...reminders,
      {
        id: newId(),
        title,
        description: '',
        completed: false,
        createdAt: new Date().toISOString(),
      },
    ]
    persist(next)
    setDraftTitle('')
    setAdding(false)
  }

  const visible = useMemo(() => reminders.slice(0, 5), [reminders])
  const overflow = reminders.length - visible.length

  return (
    <Card variant="detail" className="relative overflow-hidden !p-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 84% 10%, var(--q-accent-quest-trace), transparent 30%), linear-gradient(180deg, color-mix(in oklab, var(--q-surface-raised) 92%, transparent), color-mix(in oklab, var(--q-bg) 96%, transparent) 48%, transparent 100%)',
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-3 border-b border-[var(--q-border-subtle)] px-5 py-4">
          <span className="font-[var(--q-font-display)] text-[10px] font-medium uppercase tracking-[2.8px] text-[var(--q-accent-quest-dim)]">
            Prep Reminders
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-[var(--q-border-feature)] to-transparent" />
          {sessionId && (
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[2px] text-[var(--q-accent-quest-dim)] transition-colors hover:text-[var(--q-accent-quest)]"
            >
              <Plus size={11} />
              {adding ? 'Cancel' : 'Add'}
            </button>
          )}
        </div>

        <div className="space-y-1 px-3 py-3">
          {!sessionId ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckSquare size={18} className="text-[var(--q-text-faint)]" />
              <p className="max-w-[220px] text-xs leading-relaxed text-[var(--q-text-faint)]">
                Schedule a planning session to start tracking what still needs doing before play.
              </p>
            </div>
          ) : (
            <>
              {activePrepItems.length > 0 && (
                <div className="space-y-1.5 px-2 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-[2.5px] text-[var(--q-accent-quest-dim)]">
                      Prep Items
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-r from-[color-mix(in_oklab,var(--q-border-feature)_60%,transparent)] to-transparent" />
                    <span className="text-[9px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                      {activePrepItems.length}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {activePrepItems.map((item) => (
                      <li key={item.id} className="rounded-sm border border-[var(--q-border-subtle)] bg-white/[0.02] px-2.5 py-2">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            {campaignSlug ? (
                              <Link
                                href={`/campaigns/${campaignSlug}/sessions/prep?sessionId=${sessionId}`}
                                className="truncate text-[13px] text-[var(--q-text)] transition-colors hover:text-[var(--q-accent-primary)]"
                              >
                                {item.title}
                              </Link>
                            ) : (
                              <span className="truncate text-[13px] text-[var(--q-text)]">{item.title}</span>
                            )}
                            {item.objective && (
                              <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-[var(--q-text-faint)]">
                                {item.objective}
                              </p>
                            )}
                          </div>
                          <Pill variant={PREP_STATUS_TONE[item.status]}>
                            {PREP_STATUS_LABEL[item.status]}
                          </Pill>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Divider between prep items and reminders checklist */}
              {activePrepItems.length > 0 && (visible.length > 0 || adding) && (
                <div className="flex items-center gap-2 px-2 pb-1.5 pt-0.5">
                  <span className="text-[9px] uppercase tracking-[2.5px] text-[var(--q-text-faint)]">
                    Checklist
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-[color-mix(in_oklab,var(--q-border-subtle)_50%,transparent)] to-transparent" />
                </div>
              )}

              {visible.length === 0 && !adding && (
                <p className="py-4 text-center text-xs text-[var(--q-text-faint)]">
                  No reminders yet - add what you still need to prep.
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {visible.map((r) => (
                  <li
                    key={r.id}
                    className="group flex items-start gap-2 rounded-sm px-2 py-2 hover:bg-white/[0.03]"
                  >
                    <Checkbox
                      id={`reminder-${r.id}`}
                      checked={r.completed}
                      onCheckedChange={() => toggle(r.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      {campaignSlug && sessionId ? (
                        <Link
                          href={`/campaigns/${campaignSlug}/sessions/prep?sessionId=${sessionId}`}
                          className={cn(
                            'block text-sm leading-tight transition-colors hover:text-[var(--q-accent-primary)]',
                            r.completed ? 'text-[var(--q-text-faint)] line-through' : 'text-[var(--q-text)]',
                          )}
                        >
                          {r.title}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            'block text-sm leading-tight',
                            r.completed ? 'text-[var(--q-text-faint)] line-through' : 'text-[var(--q-text)]',
                          )}
                        >
                          {r.title}
                        </span>
                      )}
                      <div className="mt-0.5 flex items-center gap-2">
                        {r.description && (
                          <span className="block min-w-0 flex-1 text-[11px] text-[var(--q-text-faint)]">
                            {r.description}
                          </span>
                        )}
                        {campaignSlug && sessionId && (
                          <Link
                            href={`/campaigns/${campaignSlug}/sessions/prep?sessionId=${sessionId}`}
                            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[2px] text-[var(--q-accent-quest-dim)] transition-colors hover:text-[var(--q-accent-primary)]"
                          >
                            Open
                            <ArrowRight size={11} />
                          </Link>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      aria-label={`Remove reminder: ${r.title}`}
                      className="text-[var(--q-text-faint)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--q-text-danger)]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>

              {adding && (
                <div className="flex items-center gap-2 px-2 py-2">
                  <Input
                    autoFocus
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        submitDraft()
                      }
                      if (e.key === 'Escape') {
                        setDraftTitle('')
                        setAdding(false)
                      }
                    }}
                    placeholder="What still needs prep?"
                    className="h-8 border-[var(--q-border-subtle)] bg-transparent text-sm"
                  />
                  <Button size="sm" onClick={submitDraft} disabled={!draftTitle.trim()}>
                    Add
                  </Button>
                </div>
              )}

              {overflow > 0 && (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1 px-2 py-1.5 text-[10px] uppercase tracking-[2px] text-[var(--q-accent-quest-dim)] transition-colors hover:text-[var(--q-accent-quest)]"
                >
                  +{overflow} more
                  <ChevronRight size={11} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
