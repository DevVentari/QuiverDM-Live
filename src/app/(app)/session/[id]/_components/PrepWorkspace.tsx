'use client'

import { PhasePrep } from '@/components/session/phase-prep'
import { Surface } from '@/components/primitives'

interface PrepWorkspaceProps {
  session: Record<string, unknown>
  slug: string
  campaignId: string
  onStatusChange: () => void
}

export function PrepWorkspace({ session, slug, campaignId, onStatusChange }: PrepWorkspaceProps) {
  return (
    <Surface variant="utility" className="rounded-none border-0 flex-1 flex flex-col min-h-0">
      <PhasePrep
        session={session}
        slug={slug}
        campaignId={campaignId}
        onStatusChange={onStatusChange}
      />
    </Surface>
  )
}
