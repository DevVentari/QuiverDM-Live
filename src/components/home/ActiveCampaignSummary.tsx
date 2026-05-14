'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Card } from '@/components/primitives'
import { Button } from '@/components/ui/button'
import { Shield, BookOpen } from 'lucide-react'
import { RegenerateAssetButton } from './RegenerateAssetButton'
import { format } from 'date-fns'

interface ActiveCampaignSummaryPartyMember {
  id: string
  characterId: string
  name: string
  portraitUrl?: string | null
  level?: number | null
}

interface ActiveCampaignSummaryProps {
  name: string
  slug?: string | null
  id?: string
  ongoingSince?: Date | string | null
  sessionCount: number
  npcCount?: number
  locationCount?: number
  itemCount?: number
  partyLevel?: number
  levelTarget?: number
  bannerUrl?: string | null
  emblemUrl?: string | null
  party?: ActiveCampaignSummaryPartyMember[]
  pendingPartyCount?: number
  isDM?: boolean
}

function StatTile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-[var(--q-font-display)] text-2xl text-[var(--q-text)] tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
        {label}
      </div>
    </div>
  )
}

export function ActiveCampaignSummary({
  name,
  slug,
  id,
  ongoingSince,
  sessionCount,
  npcCount,
  locationCount,
  itemCount,
  partyLevel,
  levelTarget,
  emblemUrl,
}: ActiveCampaignSummaryProps) {
  const ongoingLabel = ongoingSince ? format(new Date(ongoingSince), 'MMMM d, yyyy') : null

  const progress =
    partyLevel && levelTarget && levelTarget > 0
      ? Math.min(100, Math.round((partyLevel / levelTarget) * 100))
      : null

  return (
    <Card variant="detail" className="relative overflow-hidden !p-0">
      <div className="relative">
        <div className="flex items-center gap-3 border-b border-[var(--q-border-subtle)] px-5 py-4">
          <span className="font-[var(--q-font-display)] text-[10px] font-medium uppercase tracking-[2.8px] text-[var(--q-accent-primary-dim)]">
            Active Campaign
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-[var(--q-accent-primary-border)] to-transparent" />
        </div>

        <div className="space-y-5 px-5 py-4">
          <div className="flex items-start gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[var(--q-accent-primary-border)] bg-[linear-gradient(160deg,var(--q-accent-primary-trace),transparent)]">
              {emblemUrl ? (
                <Image src={emblemUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
              ) : (
                <Shield size={24} className="text-[var(--q-accent-primary)]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-[var(--q-font-display)] text-xl text-[var(--q-text)]">
                  {name}
                </h3>
                {id && <RegenerateAssetButton kind="emblem" campaignId={id} />}
              </div>
              {ongoingLabel && (
                <p className="mt-1 text-xs text-[var(--q-text-faint)]">Ongoing since {ongoingLabel}</p>
              )}
            </div>
          </div>

          {progress !== null && (
            <div className="space-y-2">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                    Level {partyLevel} - {levelTarget}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-[var(--q-font-display)] text-2xl text-[var(--q-text)] tabular-nums">
                    {partyLevel}
                  </div>
                  <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                    Current Level
                  </div>
                </div>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--q-accent-primary-trace)]">
                <div className="h-full bg-[var(--q-accent-primary)]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3 border-t border-[var(--q-border-subtle)] pt-4">
            <StatTile value={sessionCount} label="Sessions" />
            <StatTile value={npcCount ?? '-'} label="NPCs" />
            <StatTile value={locationCount ?? '-'} label="Locations" />
            <StatTile value={itemCount ?? '-'} label="Items" />
          </div>

          {slug && (
            <Button asChild variant="outline" size="sm" className="w-full justify-center">
              <Link href={`/campaigns/${slug}/sessions`}>
                <BookOpen size={14} className="mr-2" />
                Campaign Overview
              </Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
