'use client'

import Link from 'next/link'
import Image from 'next/image'
import { RegenerateAssetButton } from './RegenerateAssetButton'
import {
  Users,
  MapPin,
  Flag,
  Package,
  Skull,
  Calendar,
  Sword,
  Shield,
  ScrollText,
  Eye,
  ChevronRight,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { Card, Pill } from '@/components/primitives'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

interface WorldActivityFeedProps {
  campaignId: string
  isNewCampaign?: boolean
  campaignSlug?: string | null
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  NPC: Users,
  PC: Users,
  FACTION: Flag,
  LOCATION: MapPin,
  ITEM: Package,
  EVENT: Calendar,
  ARC: ScrollText,
  THREAT: Skull,
  SECRET: Eye,
  CUSTOM: Sparkles,
  NOTE: ScrollText,
  MONSTER: Sword,
  RACE: Shield,
  LORE: ScrollText,
  TIMELINE: Calendar,
  SPELL: Sparkles,
}

function iconFor(type: string): LucideIcon {
  return TYPE_ICONS[type] ?? Sparkles
}

function dateLabel(d: Date): string {
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d, yyyy')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActivityItem = any

function groupByDate(items: ActivityItem[]): Array<{ label: string; items: ActivityItem[] }> {
  const map = new Map<string, ActivityItem[]>()
  for (const item of items) {
    const label = dateLabel(new Date(item.changedAt))
    const bucket = map.get(label) ?? []
    bucket.push(item)
    map.set(label, bucket)
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
}

function AnchorRow({
  name,
  description,
  imageUrl,
  type,
}: {
  name: string
  description: string | null
  imageUrl: string | null
  type: 'NPC' | 'LOCATION'
}) {
  const Icon = iconFor(type)
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span className="relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[color-mix(in_oklab,var(--q-border-subtle)_62%,transparent)] bg-[var(--q-accent-primary-trace)]/24 text-[var(--q-accent-primary-dim)]">
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill sizes="32px" className="object-cover" unoptimized />
        ) : (
          <Icon size={13} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-[var(--q-text)]">{name}</p>
        {description && (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-[var(--q-text-faint)]">{description}</p>
        )}
      </div>
    </li>
  )
}

function CampaignAnchors({ campaignId }: { campaignId: string }) {
  const { data, isLoading } = trpc.world.getCampaignAnchors.useQuery(
    { campaignId },
    { staleTime: 300_000 },
  )

  const hasAnchors = (data?.npcs.length ?? 0) + (data?.locations.length ?? 0) > 0

  return (
    <div className="py-2">
      {isLoading ? (
        <div className="space-y-2 px-3 py-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : !hasAnchors ? (
        <p className="px-4 py-5 text-center text-[11px] text-[var(--q-text-faint)]">
          Link a sourcebook to seed NPCs and locations here.
        </p>
      ) : (
        <>
          {(data?.npcs.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-1.5">
                <span className="text-[9px] uppercase tracking-[2px] text-[var(--q-text-faint)]">Key NPCs</span>
                <span className="h-px flex-1 bg-gradient-to-r from-[color-mix(in_oklab,var(--q-border-subtle)_50%,transparent)] to-transparent" />
              </div>
              <ul className="flex flex-col gap-0.5 px-2">
                {data!.npcs.map((npc) => (
                  <AnchorRow key={npc.id} name={npc.name} description={npc.description} imageUrl={npc.imageUrl} type="NPC" />
                ))}
              </ul>
            </div>
          )}
          {(data?.locations.length ?? 0) > 0 && (
            <div className={cn((data?.npcs.length ?? 0) > 0 && 'mt-2 border-t border-[color-mix(in_oklab,var(--q-border-subtle)_40%,transparent)] pt-2')}>
              <div className="flex items-center gap-2 px-4 py-1.5">
                <span className="text-[9px] uppercase tracking-[2px] text-[var(--q-text-faint)]">Key Locations</span>
                <span className="h-px flex-1 bg-gradient-to-r from-[color-mix(in_oklab,var(--q-border-subtle)_50%,transparent)] to-transparent" />
              </div>
              <ul className="flex flex-col gap-0.5 px-2">
                {data!.locations.map((loc) => (
                  <AnchorRow key={loc.id} name={loc.name} description={loc.description} imageUrl={loc.imageUrl} type="LOCATION" />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function WorldActivityFeed({ campaignId, isNewCampaign, campaignSlug }: WorldActivityFeedProps) {
  const { data, isLoading } = trpc.world.getRecentActivity.useQuery(
    { campaignId, limit: 8 },
    { staleTime: 60_000, enabled: !isNewCampaign },
  )

  const groups = data ? groupByDate(data) : []

  const headerLabel = isNewCampaign ? 'Campaign Anchors' : 'World Activity'
  const worldHref = campaignSlug ? `/campaigns/${campaignSlug}/world` : '/world'
  const sourcebookHref = campaignSlug ? `/campaigns/${campaignSlug}/sourcebook` : '/world'

  return (
    <Card variant="list" className="relative overflow-hidden !p-0">
      {/* Amber top-rule */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--q-amber-border)] to-transparent opacity-70"
      />
      <div className="relative">
        <div className="flex items-center gap-3 border-b border-[color-mix(in_oklab,var(--q-border-subtle)_66%,transparent)] px-4 py-3.5">
          <span className="font-[var(--q-font-display)] text-[9px] font-medium uppercase tracking-[3px] text-[var(--q-accent-primary-dim)]">
            {headerLabel}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-[color-mix(in_oklab,var(--q-border-feature)_72%,transparent)] to-transparent" />
          {!isNewCampaign && (
            <Link
              href={worldHref}
              className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[2px] text-[var(--q-accent-primary-dim)] transition-colors hover:text-[var(--q-accent-primary)]"
            >
              View All
              <ChevronRight size={12} />
            </Link>
          )}
          {isNewCampaign && campaignSlug && (
            <Link
              href={sourcebookHref}
              className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[2px] text-[var(--q-accent-primary-dim)] transition-colors hover:text-[var(--q-accent-primary)]"
            >
              Sourcebook
              <ChevronRight size={12} />
            </Link>
          )}
        </div>

        {isNewCampaign ? (
          <CampaignAnchors campaignId={campaignId} />
        ) : (
          <div className="py-2">
            {isLoading ? (
              <div className="space-y-2 px-3 py-1">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <p className="px-4 py-5 text-center text-[11px] text-[var(--q-text-faint)]">
                No recent activity — entities you create or update will surface here.
              </p>
            ) : (
              <div className="flex flex-col">
                {groups.map((group, gi) => (
                  <div key={group.label}>
                    <div className={cn(
                      'flex items-center gap-2 px-4 py-1.5',
                      gi > 0 && 'mt-1 border-t border-[color-mix(in_oklab,var(--q-border-subtle)_40%,transparent)] pt-2.5',
                    )}>
                      <span className="text-[9px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
                        {group.label}
                      </span>
                      <span className="h-px flex-1 bg-gradient-to-r from-[color-mix(in_oklab,var(--q-border-subtle)_50%,transparent)] to-transparent" />
                    </div>
                    <ul className="flex flex-col gap-0.5 px-2">
                      {group.items.map((item) => {
                        const Icon = iconFor(item.type)
                        return (
                          <li key={`${item.source}:${item.id}`}>
                            <Link
                              href={item.href}
                              className="group flex items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-white/[0.025]"
                            >
                              <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[color-mix(in_oklab,var(--q-border-subtle)_62%,transparent)] bg-[var(--q-accent-primary-trace)]/24 text-[var(--q-accent-primary-dim)]">
                                {item.imageUrl ? (
                                  <Image src={item.imageUrl} alt="" fill sizes="32px" className="object-cover" unoptimized />
                                ) : (
                                  <Icon size={13} />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] text-[var(--q-text)]">{item.name}</span>
                                <span className="block text-[9px] uppercase tracking-[1.4px] text-[var(--q-text-faint)]">{item.type}</span>
                              </span>
                              <Pill variant={item.status === 'Added' ? 'success' : 'neutral'}>{item.status}</Pill>
                              {item.source === 'WorldEntry' && (
                                <span
                                  onClick={(e) => e.preventDefault()}
                                  className="opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  <RegenerateAssetButton kind="activity" worldEntryId={item.id} />
                                </span>
                              )}
                              <ChevronRight
                                size={12}
                                className="shrink-0 text-[var(--q-text-faint)] transition-colors group-hover:text-[var(--q-accent-primary-dim)]"
                              />
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
