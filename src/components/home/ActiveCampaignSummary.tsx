'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Card, Section } from '@/components/primitives'
import { Button } from '@/components/ui/button'
import { Shield, BookOpen, Users } from 'lucide-react'
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
  party,
  pendingPartyCount,
  isDM,
}: ActiveCampaignSummaryProps) {
  const ongoingLabel = ongoingSince
    ? format(new Date(ongoingSince), 'MMMM d, yyyy')
    : null

  const progress =
    partyLevel && levelTarget && levelTarget > 0
      ? Math.min(100, Math.round((partyLevel / levelTarget) * 100))
      : null

  return (
    <Section label="Active Campaign">
      <Card variant="detail" className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[var(--q-amber-dim)] bg-[linear-gradient(160deg,var(--q-amber-trace),transparent)]">
            {emblemUrl ? (
              <Image src={emblemUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
            ) : (
              <Shield size={24} className="text-[var(--q-amber)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-[var(--q-font-display)] text-xl text-[var(--q-text)] truncate">
                {name}
              </h3>
              {id && <RegenerateAssetButton kind="emblem" campaignId={id} />}
            </div>
            {ongoingLabel && (
              <p className="mt-1 text-xs text-[var(--q-text-faint)]">
                Ongoing since {ongoingLabel}
              </p>
            )}
          </div>
        </div>

        <div data-testid="party-row" className="space-y-2">
          <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
            PARTY
            {party && party.length > 0 && <span>{` · ${party.length} active`}</span>}
            {isDM && (pendingPartyCount ?? 0) > 0 && (
              <span className="text-[var(--q-amber)]">{` · ${pendingPartyCount} pending`}</span>
            )}
          </div>
          {party && party.length > 0 ? (
            slug ? (
              <Link
                href={`/campaigns/${slug}/players`}
                className="flex items-center gap-2"
              >
                {party.slice(0, 6).map((member) => (
                  <div
                    key={member.id}
                    title={member.name}
                    className="relative h-7 w-7 overflow-hidden rounded-full border border-[var(--q-amber-dim)] bg-[hsl(240,10%,8%)]"
                  >
                    {member.portraitUrl ? (
                      <Image
                        src={member.portraitUrl}
                        alt={member.name}
                        fill
                        sizes="28px"
                        className="object-cover object-top"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Users size={14} className="text-[var(--q-text-faint)]" />
                      </div>
                    )}
                  </div>
                ))}
                {party.length > 6 && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--q-amber-dim)] text-[10px] text-[var(--q-text-faint)]">
                    +{party.length - 6}
                  </div>
                )}
              </Link>
            ) : null
          ) : (
            <div className="flex items-center gap-3 text-xs text-[var(--q-text-faint)]">
              <span>No party yet</span>
              {isDM && slug && (
                <Link
                  href={`/campaigns/${slug}/players?add=true`}
                  className="text-[var(--q-amber)] hover:underline"
                >
                  Add character
                </Link>
              )}
            </div>
          )}
        </div>

        {progress !== null && (
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                  Level {partyLevel} → {levelTarget}
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
            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--q-amber-trace)]">
              <div
                className="h-full bg-[var(--q-amber)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 border-t border-[var(--q-border-subtle)] pt-4">
          <StatTile value={sessionCount} label="Sessions" />
          <StatTile value={npcCount ?? '—'} label="NPCs" />
          <StatTile value={locationCount ?? '—'} label="Locations" />
          <StatTile value={itemCount ?? '—'} label="Items" />
        </div>

        {slug && (
          <Button asChild variant="outline" size="sm" className="w-full justify-center">
            <Link href={`/campaigns/${slug}`}>
              <BookOpen size={14} className="mr-2" />
              Campaign Overview
            </Link>
          </Button>
        )}
      </Card>
    </Section>
  )
}
