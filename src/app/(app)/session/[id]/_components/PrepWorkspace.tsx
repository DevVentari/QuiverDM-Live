'use client'

import { PhasePrep } from '@/components/session/phase-prep'
import { Surface } from '@/components/primitives'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { IntentBriefSection } from '@/components/session/prep/intent-brief-section'
import { SecretsWebSection } from '@/components/session/prep/secrets-web-section'
import { PhasePacingSection } from '@/components/session/prep/phase-pacing-section'
import { RouteBuilderSection } from '@/components/session/prep/route-builder-section'

interface PrepWorkspaceProps {
  session: Record<string, unknown>
  slug: string
  campaignId: string
  onStatusChange: () => void
}

export function PrepWorkspace({ session, slug, campaignId, onStatusChange }: PrepWorkspaceProps) {
  const sessionId = session.id as string
  const intentBrief = session.intentBrief as {
    toneKeywords: string[]
    playerGoals: string[]
    dmOnlyTruths: string[]
  } | null | undefined

  return (
    <Surface variant="utility" className="rounded-none border-0 flex-1 flex flex-col min-h-0 overflow-y-auto">
      <PhasePrep
        session={session}
        slug={slug}
        campaignId={campaignId}
        onStatusChange={onStatusChange}
      />
      <div className="px-4 pb-6">
        <Accordion type="multiple" className="space-y-2 mt-6">
          <AccordionItem value="intent-brief" className="border border-[var(--q-border-subtle)] rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
              Session Intent
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <IntentBriefSection
                sessionId={sessionId}
                campaignId={campaignId}
                initial={intentBrief ?? null}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="secrets-web" className="border border-[var(--q-border-subtle)] rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
              Secrets Web
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <SecretsWebSection campaignId={campaignId} sessionId={sessionId} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="phase-pacing" className="border border-[var(--q-border-subtle)] rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
              Phase Pacing
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <PhasePacingSection campaignId={campaignId} sessionId={sessionId} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="escape-routes" className="border border-[var(--q-border-subtle)] rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
              Escape Routes
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <RouteBuilderSection campaignId={campaignId} sessionId={sessionId} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </Surface>
  )
}
