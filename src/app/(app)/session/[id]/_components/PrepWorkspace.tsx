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
    <Surface variant="flat" className="rounded-none border-0 min-h-full">
      <PhasePrep
        session={session}
        slug={slug}
        campaignId={campaignId}
        onStatusChange={onStatusChange}
      />
    </Surface>
  )
}
