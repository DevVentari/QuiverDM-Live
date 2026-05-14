'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Clock, Users } from 'lucide-react'
import { Card } from '@/components/primitives'
import { Button } from '@/components/ui/button'
import { RegenerateAssetButton } from './RegenerateAssetButton'
import { format, isToday, isTomorrow } from 'date-fns'
import { cn } from '@/lib/utils'

interface HomeHeroProps {
  campaignName: string
  campaignSlug?: string | null
  campaignId?: string
  bannerUrl?: string | null
  nextSession: { id: string; title: string | null; date: Date | string } | null
  planningSession?: { id: string; title: string | null } | null
  playerCount?: number
  partyLevel?: number
  className?: string
}

function formatNextDate(date: Date | string | null | undefined) {
  if (!date) return 'No session scheduled'
  const d = new Date(date)
  if (isToday(d)) return 'Tonight'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'EEEE, MMMM d')
}

function splitSessionTitle(title: string | null | undefined) {
  const raw = title?.trim() ?? ''
  const match = raw.match(/^session\s+(\d+)\s*[:\-–]\s*(.+)$/i)
  if (!match) return { sessionNumberLabel: null, sessionTitle: raw }
  return {
    sessionNumberLabel: `Session ${match[1]}`,
    sessionTitle: match[2].trim(),
  }
}

export function HomeHero({
  campaignName,
  campaignSlug,
  campaignId,
  bannerUrl,
  nextSession,
  planningSession,
  playerCount,
  partyLevel,
  className,
}: HomeHeroProps) {
  const dateLabel = formatNextDate(nextSession?.date)
  const titleSource = planningSession?.title ?? nextSession?.title ?? `${campaignName} - next session`
  const { sessionNumberLabel, sessionTitle } = splitSessionTitle(titleSource)
  const sessionDate = nextSession?.date ? new Date(nextSession.date) : null
  const sessionTime = sessionDate ? format(sessionDate, 'h:mm a') : null
  const sessionNumber = nextSession
    ? `Session ${(nextSession as { sessionNumber?: number }).sessionNumber ?? ''}`.trim()
    : null

  return (
    <Card
      variant="hero"
      data-testid="next-session-hero"
      className={cn('relative overflow-hidden rounded-[22px] !p-0', className)}
    >
      <div className="grid min-h-[320px] grid-cols-1 gap-0 md:grid-cols-[1.08fr_0.92fr]">
        <div className="relative z-10 flex flex-col justify-between gap-7 p-6 md:p-8 lg:p-9">
          <div className="space-y-4">
            <div className="flex items-center gap-2 font-[var(--q-font-display)] text-[10px] uppercase tracking-[2.5px] text-[var(--q-accent-primary-dim)]">
              <span>Next Session</span>
              <span className="text-[var(--q-text-faint)]">-</span>
              <span className="text-[var(--q-text-dim)]">{campaignName}</span>
            </div>
            <div className="space-y-2">
              {sessionNumberLabel && (
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[var(--q-text-faint)]">
                  <span className="text-[var(--q-accent-primary-dim)]">{sessionNumberLabel}</span>
                  <span className="h-px w-8 bg-[var(--q-border-subtle)]" />
                </div>
              )}
              <h1 className="max-w-[12ch] font-[var(--q-font-display)] text-[2.15rem] leading-[0.98] text-[var(--q-text)] md:text-[2.9rem]">
                {sessionTitle}
              </h1>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--q-text-dim)]">
              {sessionDate && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={13} className="text-[var(--q-text-faint)]" />
                  {dateLabel}
                  {sessionTime && <span className="text-[var(--q-text-faint)]">- {sessionTime}</span>}
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
                    <span className="text-[var(--q-text-faint)]">- Level {partyLevel}</span>
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
                <Link href={`/campaigns/${campaignSlug ?? ''}/sessions/new`}>
                  + Schedule Session
                </Link>
              </Button>
            )}
          </div>
        </div>
        <div className="relative hidden min-h-full md:block">
          {bannerUrl ? (
            <Image
              src={bannerUrl}
              alt=""
              fill
              sizes="(min-width: 768px) 45vw, 0px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--q-surface-raised)_74%,black),color-mix(in_oklab,var(--q-bg)_92%,black))]" />
          )}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[var(--q-surface-hero)]/90 via-transparent to-transparent" />
          <div aria-hidden className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[var(--q-surface-hero)]/85 to-transparent" />
          {campaignId && (
            <div className="absolute right-2 top-2 z-10">
              <RegenerateAssetButton kind="banner" campaignId={campaignId} />
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
