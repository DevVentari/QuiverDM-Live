'use client'

import { Card, Section } from '@/components/primitives'
import { CheckSquare } from 'lucide-react'

export function PrepRemindersStub() {
  return (
    <Section label="Prep Reminders">
      <Card variant="detail" className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckSquare size={20} className="text-[var(--q-amber-dim)]" />
        <p className="font-[var(--q-font-display)] text-sm tracking-wide text-[var(--q-text-dim)]">
          Coming soon
        </p>
        <p className="max-w-[220px] text-xs leading-relaxed text-[var(--q-text-faint)]">
          Quick checklist of what still needs doing before your next session — NPC motivations, encounters, hooks.
        </p>
      </Card>
    </Section>
  )
}
