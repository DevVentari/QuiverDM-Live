'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { useHeaderStore } from '@/store/header-store'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { HomeHero } from '@/components/home/HomeHero'
import { HomePartyStrip } from '@/components/home/HomePartyStrip'
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
  const { data: characters } = trpc.characters.getCampaignCharacters.useQuery(
    { campaignId: active?.id ?? '' },
    { enabled: !!active?.id, staleTime: 60_000 },
  )

  const completedSessions = sessions?.filter((s) => s.status !== 'planning') ?? []
  const recentSessions = completedSessions.slice(0, 5)
  const planningFromList = sessions?.find((s) => s.status === 'planning') ?? null
  const charactersList = (characters ?? []) as Array<{
    id: string
    status: string
    character: {
      id: string
      name: string
      portraitUrl: string | null
      level: number | null
    }
  }>
  const activeParty = charactersList
    .filter((cc) => cc.status === 'ACTIVE')
    .map((cc) => ({
      id: cc.id,
      characterId: cc.character.id,
      name: cc.character.name,
      portraitUrl: cc.character.portraitUrl,
      level: cc.character.level,
    }))
  const pendingPartyCount = charactersList.filter((cc) => cc.status === 'PENDING').length
  const levelValues = activeParty
    .map((p) => p.level)
    .filter((lvl): lvl is number => typeof lvl === 'number' && lvl > 0)
  const partyLevel =
    levelValues.length > 0
      ? Math.round(levelValues.reduce((a, b) => a + b, 0) / levelValues.length)
      : undefined
  const isDM = active?.role === 'OWNER' || active?.role === 'CO_DM'

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
        return parsed.success ? parsed.data : null
      })()
    : null
  const prepItems = prepReminders?.prepItems ?? []
  const reminders = prepReminders?.reminders ?? []

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
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.83fr)]">
        <div className="space-y-6">
          <div className="space-y-6">
            <HomeHero
              campaignName={active.name}
              campaignSlug={active.slug}
              campaignId={active.id}
              bannerUrl={active.bannerUrl}
              nextSession={active.nextSession}
              planningSession={planningSession}
              playerCount={activeParty.length}
              partyLevel={partyLevel}
            />
            <HomePartyStrip
              slug={active.slug}
              party={activeParty}
              pendingPartyCount={pendingPartyCount}
              partyLevel={partyLevel}
              isDM={isDM}
            />
          </div>
          <div className="grid grid-cols-1 items-start gap-6">
            <RecentSessionsList sessions={recentSessions} />
          </div>
        </div>
        <div className="space-y-5">
          <WorldActivityFeed campaignId={active.id} />
          <PrepReminders
            sessionId={planningSession?.id ?? null}
            campaignSlug={active.slug}
            reminders={reminders}
            prepItems={prepItems}
          />
        </div>
      </div>
    </div>
  )
}
