'use client'

import Link from 'next/link'
import { Compass, Plus, Scroll } from 'lucide-react'
import { useCampaign } from '@/components/campaign/campaign-context'
import { Button } from '@/components/ui/button'
import { Card, Section } from '@/components/primitives'

export default function QuestsPage() {
  const { campaignId, slug } = useCampaign()

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <p className="font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase">
            Campaign
          </p>
          <h1 className="font-[var(--q-font-display)] text-3xl md:text-4xl text-[var(--q-text)] mt-1">
            Quests
          </h1>
        </div>
        <Button size="sm" disabled title="Quest authoring is coming soon">
          <Plus size={14} className="mr-2" />
          New Quest
        </Button>
      </div>

      <Section label="Active quests">
        <Card variant="detail" className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-[var(--q-amber-dim)] bg-[linear-gradient(160deg,var(--q-amber-trace),transparent)]">
            <Compass size={24} className="text-[var(--q-amber)]" />
          </div>
          <div className="space-y-2 max-w-md">
            <p className="font-[var(--q-font-display)] text-lg text-[var(--q-text)]">
              No quests tracked yet
            </p>
            <p className="text-sm text-[var(--q-text-dim)]">
              Quest authoring is on the roadmap. In the meantime, capture quest hooks and
              objectives inside Lore entries or session prep notes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button asChild variant="outline" size="sm" data-testid="quests-fallback-lore">
              <Link href={`/campaigns/${slug}/world?filter=lore`}>
                <Scroll size={14} className="mr-2" />
                Open Lore
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/campaigns/${slug}/sessions`}>
                Session Prep
              </Link>
            </Button>
          </div>
          <p
            className="mt-2 text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]"
            data-campaign-id={campaignId}
          >
            Coming soon
          </p>
        </Card>
      </Section>
    </div>
  )
}
