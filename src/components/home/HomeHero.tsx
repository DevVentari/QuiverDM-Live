'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Clock, Users } from 'lucide-react'
import { Card } from '@/components/primitives'
import { Button } from '@/components/ui/button'
import { format, isToday, isTomorrow } from 'date-fns'

interface HomeHeroProps {
  campaignName: string
  campaignSlug?: string | null
  bannerUrl?: string | null
  nextSession: { id: string; title: string | null; date: Date | string } | null
  planningSession?: { id: string; title: string | null } | null
  playerCount?: number
  partyLevel?: number
}

function formatNextDate(date: Date | string | null | undefined) {
  if (!date) return 'No session scheduled'
  const d = new Date(date)
  if (isToday(d)) return 'Tonight'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'EEEE, MMMM d')
}

export function HomeHero({
  campaignName,
  campaignSlug,
  bannerUrl,
  nextSession,
  planningSession,
  playerCount,
  partyLevel,
}: HomeHeroProps) {
  const dateLabel = formatNextDate(nextSession?.date)
  const heroTitle =
    planningSession?.title ?? nextSession?.title ?? `${campaignName} — next session`
  const sessionDate = nextSession?.date ? new Date(nextSession.date) : null
  const sessionTime = sessionDate ? format(sessionDate, 'h:mm a') : null
  const sessionNumber = nextSession ? `Session ${(nextSession as { sessionNumber?: number }).sessionNumber ?? ''}`.trim() : null

  return (
    <Card
      variant="hero"
      data-testid="next-session-hero"
      className="!p-0 relative overflow-hidden [clip-path:polygon(0_0,calc(100%_-_14px)_0,100%_14px,100%_100%,14px_100%,0_calc(100%_-_14px))]"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-0 min-h-[280px]">
        <div className="p-6 md:p-8 flex flex-col justify-between gap-6 z-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2 font-[var(--q-font-display)] text-[10px] tracking-[2.5px] text-[var(--q-amber)] uppercase">
              <span>Next Session</span>
              <span className="text-[var(--q-text-faint)]">·</span>
              <span className="text-[var(--q-text-dim)]">{campaignName}</span>
            </div>
            <h1 className="font-[var(--q-font-display)] text-3xl md:text-4xl leading-tight text-[var(--q-text)]">
              {heroTitle}
            </h1>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--q-text-dim)]">
              {sessionDate && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={13} className="text-[var(--q-text-faint)]" />
                  {dateLabel}
                  {sessionTime && (
                    <span className="text-[var(--q-text-faint)]"> · {sessionTime}</span>
                  )}
                </span>
              )}
              {sessionNumber && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={13} className="text-[var(--q-text-faint)]" />
                  {sessionNumber}
                </span>
              )}
              {playerCount !== undefined && (
                <span className="inline-flex items-center gap-1.5">
                  <Users size={13} className="text-[var(--q-text-faint)]" />
                  {playerCount} Players
                  {partyLevel !== undefined && (
                    <span className="text-[var(--q-text-faint)]"> · Level {partyLevel}</span>
                  )}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {planningSession ? (
              <>
                <Button asChild variant="default" size="sm" data-testid="hero-cta-prep">
                  <Link href={`/session/${planningSession.id}`}>Continue Prep</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/session/${planningSession.id}`}>Session Overview</Link>
                </Button>
                {campaignSlug && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/campaigns/${campaignSlug}/world`}>Open the World</Link>
                  </Button>
                )}
              </>
            ) : (
              <Button asChild variant="default" size="sm">
                <Link href={`/campaigns/${campaignSlug ?? ''}/sessions/new`}>+ Schedule Session</Link>
              </Button>
            )}
          </div>
        </div>
        <div className="relative hidden md:block min-h-full">
          {bannerUrl ? (
            <Image
              src={bannerUrl}
              alt=""
              fill
              sizes="(min-width: 768px) 45vw, 0px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center_right,oklch(0.35_0.08_55_/_0.5),transparent_60%),linear-gradient(135deg,oklch(0.18_0.04_265),oklch(0.12_0.02_265))]" />
          )}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-[var(--q-surface-hero)] via-transparent to-transparent"
          />
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[var(--q-surface-hero)] to-transparent"
          />
        </div>
      </div>
    </Card>
  )
}
