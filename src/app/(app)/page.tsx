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

  // Exclude Session 0 from all display logic — it's handled by the hero CTA
  const realSessions = sessions?.filter((s) => (s as any).sessionNumber !== 0) ?? []
  const session0 = sessions?.find((s) => (s as any).sessionNumber === 0) ?? null
  const isNewCampaign = !!session0 && realSessions.length === 0

  const completedSessions = realSessions.filter((s) => s.status !== 'planning')
  const recentSessions = completedSessions.slice(0, 5)
  const planningFromList = realSessions.find((s) => s.status === 'planning') ?? null
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
    <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-6">
      {/* Hero spans full width so the map gets maximum real estate */}
      <HomeHero
        campaignName={active.name}
        campaignSlug={active.slug}
        campaignId={active.id}
        bannerUrl={active.bannerUrl}
        nextSession={active.nextSession}
        planningSession={planningSession}
        party={activeParty}
        playerCount={activeParty.length}
        partyLevel={partyLevel}
        isNewCampaign={isNewCampaign}
        session0Id={(session0 as any)?.id ?? null}
      />

      {/* Two-column grid: main content left, activity right */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.7fr)]">
        <div className="space-y-6">
          <HomePartyStrip
            slug={active.slug}
            party={activeParty}
            pendingPartyCount={pendingPartyCount}
            partyLevel={partyLevel}
            isDM={isDM}
          />
          {!isNewCampaign && <RecentSessionsList sessions={recentSessions} />}
        </div>
        <div className="space-y-5">
          <WorldActivityFeed
            campaignId={active.id}
            isNewCampaign={isNewCampaign}
            campaignSlug={active.slug}
          />
          {!isNewCampaign && (
            <PrepReminders
              sessionId={planningSession?.id ?? null}
              campaignSlug={active.slug}
              reminders={reminders}
              prepItems={prepItems}
            />
          )}
        </div>
      </div>
    </div>
  )
}
