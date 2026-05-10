'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2, ChevronRight, CheckSquare } from 'lucide-react'
import { Card, Section } from '@/components/primitives'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import type { PrepReminder } from '@/lib/prep-types'

interface PrepRemindersProps {
  sessionId: string | null
  reminders: PrepReminder[]
}

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function PrepReminders({ sessionId, reminders: initial }: PrepRemindersProps) {
  const utils = trpc.useUtils()
  const [optimistic, setOptimistic] = useState<PrepReminder[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')

  const reminders = optimistic ?? initial

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
    <Section
      label="Prep Reminders"
      action={
        sessionId && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[2px] text-[var(--q-amber-dim)] hover:text-[var(--q-amber)] transition-colors"
          >
            <Plus size={11} />
            {adding ? 'Cancel' : 'Add'}
          </button>
        )
      }
    >
      <Card variant="detail" className="!p-3 space-y-1">
        {!sessionId ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <CheckSquare size={18} className="text-[var(--q-text-faint)]" />
            <p className="max-w-[220px] text-xs leading-relaxed text-[var(--q-text-faint)]">
              Schedule a planning session to start tracking what still needs doing before play.
            </p>
          </div>
        ) : (
          <>
            {visible.length === 0 && !adding && (
              <p className="py-4 text-center text-xs text-[var(--q-text-faint)]">
                No reminders yet — add what you still need to prep.
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {visible.map((r) => (
                <li key={r.id} className="group flex items-start gap-2 rounded-sm px-2 py-2 hover:bg-white/[0.03]">
                  <Checkbox
                    id={`reminder-${r.id}`}
                    checked={r.completed}
                    onCheckedChange={() => toggle(r.id)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`reminder-${r.id}`}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <span
                      className={cn(
                        'block text-sm leading-tight',
                        r.completed
                          ? 'text-[var(--q-text-faint)] line-through'
                          : 'text-[var(--q-text)]',
                      )}
                    >
                      {r.title}
                    </span>
                    {r.description && (
                      <span className="mt-0.5 block text-[11px] text-[var(--q-text-faint)]">
                        {r.description}
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    aria-label={`Remove reminder: ${r.title}`}
                    className="opacity-0 group-hover:opacity-100 text-[var(--q-text-faint)] hover:text-[var(--q-text-danger)] transition-opacity"
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
                  className="h-8 text-sm bg-transparent border-white/5"
                />
                <Button size="sm" onClick={submitDraft} disabled={!draftTitle.trim()}>
                  Add
                </Button>
              </div>
            )}

            {overflow > 0 && (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1 px-2 py-1.5 text-[10px] uppercase tracking-[2px] text-[var(--q-amber-dim)] hover:text-[var(--q-amber)] transition-colors"
              >
                +{overflow} more
                <ChevronRight size={11} />
              </button>
            )}
          </>
        )}
      </Card>
    </Section>
  )
}
