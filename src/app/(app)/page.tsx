'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { useHeaderStore } from '@/store/header-store'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { HomeHero } from '@/components/home/HomeHero'
import { ActiveCampaignSummary } from '@/components/home/ActiveCampaignSummary'
import { RecentSessionsList } from '@/components/home/RecentSessionsList'
import { WorldActivityFeed } from '@/components/home/WorldActivityFeed'
import { PrepReminders } from '@/components/home/PrepReminders'
import { SessionPrepDataSchema } from '@/lib/prep-types'

export default function HomePage() {
  const { setSlot } = useHeaderStore()

  const { data: active, isLoading } = trpc.campaigns.getActive.useQuery(undefined, {
    staleTime: 120_000,
  })

  const { data: sessions } = trpc.sessions.getAll.useQuery(
    { campaignId: active?.id ?? '' },
    { enabled: !!active?.id, staleTime: 60_000 },
  )

  const completedSessions = sessions?.filter((s) => s.status !== 'planning') ?? []
  const recentSessions = completedSessions.slice(0, 5)
  const planningFromList = sessions?.find((s) => s.status === 'planning') ?? null

  useEffect(() => {
    if (!active) return
    setSlot({
      label: active.name,
      title: active.name,
      campaignSlug: active.slug ?? undefined,
      campaignId: active.id,
      isDM: active.role === 'OWNER' || active.role === 'CO_DM',
    })
    return () => setSlot(null)
  }, [active, setSlot])

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!active) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-24">
        <p className="font-[var(--q-font-display)] text-sm tracking-[2px] text-[var(--q-text-faint)] uppercase">
          No campaigns yet
        </p>
        <Button asChild>
          <Link href="/campaigns/new">Create your first campaign</Link>
        </Button>
      </div>
    )
  }

  const planningSession = planningFromList ?? recentSessions[0] ?? null

  const prepReminders = planningSession
    ? (() => {
        const parsed = SessionPrepDataSchema.safeParse(
          (planningSession as { prepData?: unknown }).prepData,
        )
        return parsed.success ? parsed.data.reminders ?? [] : []
      })()
    : []

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      {/*
        2D grid (rows × cols) so each row's top/bottom y is shared across
        columns. Row 1 = Hero (left, span 8) + WorldActivity (right, span 4).
        Row 2 = Recent+ActiveCampaign (left, span 8) + PrepReminders (right, span 4).
        Row heights auto-equalize to the tallest item per row, so the
        Row-2 overlines start at the same y on both sides.

        The lg:pt-8 on the WorldActivity wrapper mirrors the Hero card's
        internal p-8 so the WORLD ACTIVITY overline aligns vertically with
        the NEXT SESSION overline inside the hero card.
      */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <HomeHero
            campaignName={active.name}
            campaignSlug={active.slug}
            bannerUrl={active.bannerUrl}
            nextSession={active.nextSession}
            planningSession={planningSession}
          />
        </div>
        <div className="lg:col-span-4 lg:pt-8">
          <WorldActivityFeed campaignId={active.id} />
        </div>

        <div className="lg:col-span-8">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
            <RecentSessionsList sessions={recentSessions} />
            <ActiveCampaignSummary
              name={active.name}
              slug={active.slug}
              ongoingSince={active.createdAt}
              sessionCount={active.sessionCount}
              npcCount={active.npcCount}
              locationCount={active.locationCount}
              itemCount={active.itemCount}
            />
          </div>
        </div>
        <div className="lg:col-span-4">
          <PrepReminders sessionId={planningSession?.id ?? null} reminders={prepReminders} />
        </div>
      </div>
    </div>
  )
}
