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
import { Card, Section, Pill } from '@/components/primitives'
import { trpc } from '@/lib/trpc'
import { format, isToday, isYesterday } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'

interface WorldActivityFeedProps {
  campaignId: string
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  // WorldEntity types
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
  // WorldEntry types not already covered
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
    <Section
      label="World Activity"
      action={
        <Link
          href="/world"
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[2px] text-[var(--q-amber-dim)] hover:text-[var(--q-amber)] transition-colors"
        >
          View All Activity
          <ChevronRight size={12} />
        </Link>
      }
    >
      <Card variant="detail" className="!p-3">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--q-text-faint)]">
            No recent activity yet — entities you create or update across the world will surface here.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.map((item) => {
              const Icon = iconFor(item.type)
              const changed = new Date(item.changedAt)
              return (
                <li key={`${item.source}:${item.id}`}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-white/5 bg-[var(--q-amber-trace)]/30 text-[var(--q-amber-dim)]">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt="" fill sizes="32px" className="object-cover" unoptimized />
                      ) : (
                        <Icon size={14} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[var(--q-text)]">
                        {item.name}
                      </span>
                      <span className="block text-[10px] text-[var(--q-text-faint)]">
                        {dateLabel(changed)}
                      </span>
                    </span>
                    <Pill variant={item.status === 'Added' ? 'info' : 'neutral'}>
                      {item.status}
                    </Pill>
                    {item.source === 'WorldEntry' && (
                      <span onClick={(e) => e.preventDefault()} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <RegenerateAssetButton kind="activity" worldEntryId={item.id} />
                      </span>
                    )}
                    <ChevronRight
                      size={12}
                      className="shrink-0 text-[var(--q-text-faint)] transition-colors group-hover:text-[var(--q-amber-dim)]"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </Section>
  )
}
