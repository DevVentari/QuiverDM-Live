'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Clock, Users } from 'lucide-react'
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
  isNewCampaign?: boolean
  session0Id?: string | null
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
  isNewCampaign,
  session0Id,
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
    <div
      data-testid="next-session-hero"
      className={cn(
        'relative overflow-hidden rounded-[22px] min-h-[480px] flex flex-col justify-end',
        'border border-[color-mix(in_oklab,var(--q-border-subtle)_64%,var(--q-border-feature))]',
        className,
      )}
    >
      {/* Full-bleed background */}
      {bannerUrl ? (
        <Image
          src={bannerUrl}
          alt=""
          fill
          sizes="(min-width: 1280px) 66vw, 100vw"
          className="object-cover object-center"
          priority
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--q-surface-raised)_60%,black),color-mix(in_oklab,var(--q-bg)_80%,black))]" />
      )}

      {/* Gradient overlays — left-heavy so text is readable */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-black/10" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Regenerate button top-right */}
      {campaignId && (
        <div className="absolute right-3 top-3 z-20">
          <RegenerateAssetButton kind="banner" campaignId={campaignId} />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-end gap-6 p-8 md:p-10 max-w-[600px]">
        {isNewCampaign ? (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-[var(--q-font-display)] text-[10px] uppercase tracking-[2.5px] text-[var(--q-accent-primary-dim)]">
                <span>Campaign Ready</span>
                <span className="text-white/30">—</span>
                <span className="text-white/50">{campaignName}</span>
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/40">
                  <span className="text-[var(--q-accent-primary-dim)]">Session 0</span>
                  <span className="h-px w-8 bg-white/20" />
                </div>
                <h1 className="font-[var(--q-font-display)] text-[2.6rem] leading-[0.96] text-white md:text-[3.4rem]">
                  Your adventure begins
                </h1>
              </div>
              <p className="max-w-[36ch] text-sm leading-relaxed text-white/60">
                Session 0 prep is ready — review opening hooks, key NPCs, and DM secrets before your first session.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {session0Id && campaignSlug ? (
                <>
                  <Button asChild variant="default" size="sm" data-testid="hero-cta-session0">
                    <Link href={`/campaigns/${campaignSlug}/sessions/${session0Id}`}>
                      Review Session 0 Prep
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="border-white/20 bg-white/5 hover:bg-white/10 text-white">
                    <Link href={`/campaigns/${campaignSlug}/sessions/prep`}>
                      + Schedule Session 1
                    </Link>
                  </Button>
                </>
              ) : (
                <Button asChild variant="default" size="sm">
                  <Link href={`/campaigns/${campaignSlug ?? ''}/sessions`}>View Sessions</Link>
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-[var(--q-font-display)] text-[10px] uppercase tracking-[2.5px] text-[var(--q-accent-primary-dim)]">
                <span>Next Session</span>
                <span className="text-white/30">—</span>
                <span className="text-white/50">{campaignName}</span>
              </div>
              <div className="space-y-2">
                {sessionNumberLabel && (
                  <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/40">
                    <span className="text-[var(--q-accent-primary-dim)]">{sessionNumberLabel}</span>
                    <span className="h-px w-8 bg-white/20" />
                  </div>
                )}
                <h1 className="font-[var(--q-font-display)] text-[2.6rem] leading-[0.96] text-white md:text-[3.4rem]">
                  {sessionTitle}
                </h1>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/50">
                {sessionDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={13} className="text-white/30" />
                    {dateLabel}
                    {sessionTime && <span className="text-white/30">· {sessionTime}</span>}
                  </span>
                )}
                {sessionNumber && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={13} className="text-white/30" />
                    {sessionNumber}
                  </span>
                )}
                {playerCount !== undefined && (
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={13} className="text-white/30" />
                    {playerCount} Players
                    {partyLevel !== undefined && (
                      <span className="text-white/30">· Level {partyLevel}</span>
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
                  <Button asChild variant="outline" size="sm" className="border-white/20 bg-white/5 hover:bg-white/10 text-white">
                    <Link href={`/session/${planningSession.id}`}>Session Overview</Link>
                  </Button>
                  {campaignSlug && (
                    <Button asChild variant="outline" size="sm" className="border-white/20 bg-white/5 hover:bg-white/10 text-white">
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
          </>
        )}
      </div>
    </div>
  )
}
