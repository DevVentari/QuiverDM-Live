'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Shield, Sparkles, Users } from 'lucide-react'
import { Section } from '@/components/primitives'

interface HomePartyStripMember {
  id: string
  characterId: string
  name: string
  portraitUrl?: string | null
  level?: number | null
}

interface HomePartyStripProps {
  slug?: string | null
  party?: HomePartyStripMember[]
  pendingPartyCount?: number
  partyLevel?: number
  isDM?: boolean
}

export function HomePartyStrip({
  slug,
  party = [],
  pendingPartyCount = 0,
  partyLevel,
  isDM,
}: HomePartyStripProps) {
  const visibleParty = party.slice(0, 8)
  const overflow = Math.max(0, party.length - visibleParty.length)

  return (
    <Section
      label="Party"
      action={
        slug ? (
          <Link
            href={`/campaigns/${slug}/players`}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[2px] text-[var(--q-accent-primary-dim)] transition-colors hover:text-[var(--q-accent-primary)]"
          >
            Manage Party
          </Link>
        ) : null
      }
      className="h-full"
    >
      {party.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--q-border-subtle)_66%,transparent)] bg-[var(--q-accent-primary-trace)]/20 px-3 py-1 text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
              <Users size={13} className="text-[var(--q-accent-primary-dim)]" />
              {party.length} active
            </div>
            {partyLevel !== undefined && (
              <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--q-border-subtle)_66%,transparent)] bg-black/[0.08] px-3 py-1 text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                <Sparkles size={13} className="text-[var(--q-accent-arcane)]" />
                Level {partyLevel}
              </div>
            )}
            {isDM && pendingPartyCount > 0 && (
              <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--q-border-subtle)_66%,transparent)] bg-black/[0.08] px-3 py-1 text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                {pendingPartyCount} pending
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {visibleParty.map((member) => (
              <Link
                key={member.id}
                href={slug ? `/campaigns/${slug}/players` : '#'}
                title={member.name}
                className="group flex items-center gap-3 rounded-xl border border-[color-mix(in_oklab,var(--q-border-subtle)_66%,transparent)] bg-black/[0.08] px-3 py-2 pr-4 transition-colors hover:border-[var(--q-accent-primary-border)] hover:bg-white/[0.016]"
              >
                <div className="relative h-[42px] w-[42px] overflow-hidden rounded-full border border-[var(--q-accent-primary-border)] bg-[hsl(240,10%,8%)]">
                  {member.portraitUrl ? (
                    <Image
                      src={member.portraitUrl}
                      alt={member.name}
                      fill
                      sizes="44px"
                      className="object-cover object-top"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Shield size={17} className="text-[var(--q-text-faint)]" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-[var(--q-font-display)] text-[15px] tracking-[0.02em] text-[var(--q-text)]">
                    {member.name}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                    {member.level ? `Level ${member.level}` : 'Party Member'}
                  </div>
                </div>
              </Link>
            ))}
            {overflow > 0 && (
              <div className="inline-flex h-[56px] items-center justify-center rounded-xl border border-[color-mix(in_oklab,var(--q-border-subtle)_66%,transparent)] bg-black/[0.08] px-4 font-[var(--q-font-display)] text-[17px] text-[var(--q-text-faint)]">
                +{overflow}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[72px] items-center justify-between rounded-xl border border-dashed border-[color-mix(in_oklab,var(--q-border-subtle)_66%,transparent)] bg-black/[0.08] px-4">
          <div>
            <div className="font-[var(--q-font-display)] text-[17px] text-[var(--q-text)]">
              No party assembled yet
            </div>
            <div className="mt-1 text-[13px] text-[var(--q-text-faint)]">
              Add characters to anchor the next session around the people in play.
            </div>
          </div>
          {slug && isDM && (
            <Link
              href={`/campaigns/${slug}/players?add=true`}
              className="inline-flex min-h-11 items-center rounded-xl border border-[var(--q-border-subtle)] px-4 text-sm text-[var(--q-accent-primary-dim)] transition-colors hover:border-[var(--q-accent-primary-border)] hover:text-[var(--q-accent-primary)]"
            >
              Add first character
            </Link>
          )}
        </div>
      )}
    </Section>
  )
}
