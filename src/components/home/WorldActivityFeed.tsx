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
import { format, isToday, isYesterday } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

interface WorldActivityFeedProps {
  campaignId: string
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

export function WorldActivityFeed({ campaignId }: WorldActivityFeedProps) {
  const { data, isLoading } = trpc.world.getRecentActivity.useQuery(
    { campaignId, limit: 5 },
    { staleTime: 60_000 },
  )

  return (
    <Card variant="list" className="relative overflow-hidden !p-0">
      <div className="relative">
        <div className="flex items-center gap-3 border-b border-[color-mix(in_oklab,var(--q-border-subtle)_66%,transparent)] px-4 py-3.5">
          <span className="font-[var(--q-font-display)] text-[9px] font-medium uppercase tracking-[3px] text-[var(--q-accent-primary-dim)]">
            World Activity
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-[color-mix(in_oklab,var(--q-border-feature)_72%,transparent)] to-transparent" />
          <Link
            href="/world"
            className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[2px] text-[var(--q-accent-primary-dim)] transition-colors hover:text-[var(--q-accent-primary)]"
          >
            View All Activity
            <ChevronRight size={12} />
          </Link>
        </div>

        <div className="px-3 py-2.5">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <p className="py-5 text-center text-[11px] text-[var(--q-text-faint)]">
              No recent activity yet - entities you create or update across the world will surface here.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {data.map((item) => {
                const Icon = iconFor(item.type)
                const changed = new Date(item.changedAt)
                return (
                  <li key={`${item.source}:${item.id}`}>
                    <Link
                      href={item.href}
                      className="group flex items-center gap-3 rounded-sm px-2 py-1.5 transition-colors hover:bg-white/[0.025]"
                    >
                      <span className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[color-mix(in_oklab,var(--q-border-subtle)_62%,transparent)] bg-[var(--q-accent-primary-trace)]/24 text-[var(--q-accent-primary-dim)]">
                        {item.imageUrl ? (
                          <Image src={item.imageUrl} alt="" fill sizes="32px" className="object-cover" unoptimized />
                        ) : (
                          <Icon size={14} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-[var(--q-text)]">{item.name}</span>
                        <span className="block text-[9px] uppercase tracking-[1.4px] text-[var(--q-text-faint)]">{dateLabel(changed)}</span>
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
          )}
        </div>
      </div>
    </Card>
  )
}
