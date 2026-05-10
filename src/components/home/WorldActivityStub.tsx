'use client'

import { Card, Section } from '@/components/primitives'
import { Sparkles } from 'lucide-react'

export function WorldActivityStub() {
  return (
    <Section label="World Activity">
      <Card variant="detail" className="flex flex-col items-center gap-3 py-8 text-center">
        <Sparkles size={20} className="text-[var(--q-amber-dim)]" />
        <p className="font-[var(--q-font-display)] text-sm tracking-wide text-[var(--q-text-dim)]">
          Coming soon
        </p>
        <p className="max-w-[220px] text-xs leading-relaxed text-[var(--q-text-faint)]">
          A live feed of recent changes across your world — entities revamped, locations updated, lore added.
        </p>
      </Card>
    </Section>
  )
}
