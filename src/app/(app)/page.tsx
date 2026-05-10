'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc'
import { useHeaderStore } from '@/store/header-store'
import { Section, Card, Pill } from '@/components/primitives'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { format, isToday, isTomorrow } from 'date-fns'

export default function HomePage() {
  const { setSlot } = useHeaderStore()

  const { data: campaigns, isLoading } = trpc.campaigns.getMyMemberships.useQuery(undefined, {
    staleTime: 120_000,
  })

  // Derive active campaign: most recent session date, fall back to most recently updated
  const active =
    campaigns
      ?.slice()
      .sort((a, b) => {
        const aDate = a.lastSessionDate ?? a.updatedAt
        const bDate = b.lastSessionDate ?? b.updatedAt
        return new Date(bDate).getTime() - new Date(aDate).getTime()
      })[0] ?? null

  const { data: sessions } = trpc.sessions.getAll.useQuery(
    { campaignId: active?.id ?? '' },
    { enabled: !!active?.id, staleTime: 60_000 },
  )

  const recentSessions = sessions?.slice(0, 3) ?? []

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

  const nextSession = active.nextSession
  const nextDate = nextSession?.date ? new Date(nextSession.date) : null
  const nextLabel = nextDate
    ? isToday(nextDate)
      ? 'Tonight'
      : isTomorrow(nextDate)
      ? 'Tomorrow'
      : format(nextDate, 'EEE d MMM')
    : 'No session scheduled'

  const planningSession = recentSessions.find((s) => s.status === 'planning') ?? recentSessions[0]

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <Card
        variant="hero"
        data-testid="next-session-hero"
        className="mb-8 [clip-path:polygon(0_0,calc(100%_-_14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%_-_14px))]"
      >
        <div className="font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase mb-2">
          {nextLabel}
        </div>

        <h1 className="font-[var(--q-font-display)] text-2xl text-[var(--q-text)] mb-4">
          {planningSession?.title ?? nextSession?.title ?? `${active.name} — next session`}
        </h1>

        <div className="flex flex-wrap gap-3">
          {planningSession ? (
            <>
              <Button asChild variant="default" size="sm" data-testid="hero-cta-prep">
                <Link href={`/session/${planningSession.id}`}>▣ Continue prep</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/world">⌖ Open the world</Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="default" size="sm">
              <Link href={`/campaigns/${active.slug}/sessions/new`}>+ Schedule session</Link>
            </Button>
          )}
        </div>
      </Card>

      {/* Recent sessions */}
      <Section label="Recent sessions">
        <div className="flex flex-col gap-2">
          {recentSessions.length === 0 && (
            <p className="text-[var(--q-text-faint)] text-sm">No sessions yet.</p>
          )}
          {recentSessions.map((s, i) => (
            <Link key={s.id} href={`/session/${s.id}`} data-testid={`recent-session-${i}`}>
              <Card
                variant="list"
                className="flex items-center justify-between hover:border-[var(--q-amber-border)] transition-colors cursor-pointer"
              >
                <div>
                  <span className="text-sm text-[var(--q-text)]">
                    {s.title ?? `Session ${s.sessionNumber}`}
                  </span>
                  {s.date && (
                    <span className="text-xs text-[var(--q-text-faint)] ml-2">
                      {format(new Date(s.date), 'd MMM yyyy')}
                    </span>
                  )}
                </div>
                <Pill variant="info">{s.status}</Pill>
              </Card>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  )
}
