'use client'

import { use, useEffect, useCallback } from 'react'
import { trpc } from '@/lib/trpc'
import { useHeaderStore } from '@/store/header-store'
import { deriveSessionPhase } from '@/lib/session-lifecycle'
import { PhasePillBar } from './_components/PhasePillBar'
import { PrepWorkspace } from './_components/PrepWorkspace'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

// getById returns a union (DM full view | player restricted view).
// Hub page is DM-facing — cast to a loose shared shape.
type SessionView = {
  id: string
  title: string | null
  status: string
  campaignId?: string
  campaign?: { id: string; name: string; slug: string } | null
  aiSummaryStatus?: string | null
  aiSummary?: string | null
  recordings?: unknown[]
  _count?: { recaps: number }
}

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { setSlot } = useHeaderStore()
  const utils = trpc.useUtils()

  const { data: session, isLoading } = trpc.sessions.getById.useQuery(
    { id },
    { staleTime: 30_000 },
  )

  const invalidate = useCallback(() => {
    void utils.sessions.getById.invalidate({ id })
  }, [utils, id])

  const backToPrep = trpc.sessions.update.useMutation({
    onSuccess: invalidate,
  })

  useEffect(() => {
    if (!session) return
    const s = session as unknown as SessionView
    const campaign = s.campaign ?? null
    setSlot({
      label: campaign?.name ?? '',
      title: s.title ?? campaign?.name ?? '',
      campaignSlug: campaign?.slug ?? undefined,
      campaignId: campaign?.id ?? s.campaignId,
      isDM: true,
    })
    return () => setSlot(null)
  }, [session, setSlot])

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--q-text-faint)] text-sm font-[var(--q-font-display)] tracking-wider">
          Session not found
        </p>
      </div>
    )
  }

  const s = session as unknown as SessionView

  const phase = deriveSessionPhase({
    status: s.status,
    aiSummaryStatus: s.aiSummaryStatus ?? 'none',
    aiSummary: s.aiSummary ?? null,
    recordingCount: s.recordings?.length ?? 0,
    hasApprovedRecap: s._count?.recaps ? s._count.recaps > 0 : false,
  })

  const campaign = s.campaign ?? null

  return (
    <div className="flex flex-col h-full">
      <PhasePillBar current={phase} />
      <div className="flex-1 overflow-y-auto">
        {phase === 'prep' && campaign && (
          <PrepWorkspace
            session={session as unknown as Record<string, unknown>}
            slug={campaign.slug}
            campaignId={campaign.id}
            onStatusChange={invalidate}
          />
        )}
        {phase !== 'prep' && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="font-[var(--q-font-display)] text-xs tracking-[2px] text-[var(--q-amber)] uppercase">
              {phase === 'ran' && 'Run phase'}
              {phase === 'processing' && 'Processing'}
              {phase === 'summary' && 'Summary'}
              {phase === 'recap' && 'Recap'}
              {phase === 'complete' && 'Complete'}
            </p>
            <p className="text-sm text-[var(--q-text-faint)]">
              Coming in a future slice
            </p>
            {phase === 'ran' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => backToPrep.mutate({ id, status: 'planning' })}
                disabled={backToPrep.isPending}
                className="text-[var(--q-text-faint)] hover:text-[var(--q-text)]"
              >
                ← Back to prep
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
