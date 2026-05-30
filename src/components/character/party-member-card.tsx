'use client'

import Image from 'next/image'
import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EntityPlaceholder } from '@/components/primitives/entity-placeholder'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS = ['ACTIVE', 'RETIRED', 'DECEASED', 'REMOVED'] as const
export type PartyMemberStatus = (typeof STATUS_OPTIONS)[number] | 'PENDING'

export interface PartyMemberCardData {
  id: string
  status: PartyMemberStatus
  character?: {
    id: string
    name: string
    race?: string | null
    class?: string | null
    level?: number | null
    portraitUrl?: string | null
    user?: { displayName?: string | null; name?: string | null } | null
  } | null
  name?: string
  portraitUrl?: string | null
}

interface PartyMemberCardProps {
  cc: PartyMemberCardData
  isDM: boolean
  onApprove: () => void
  onReject: () => void
  onStatusChange: (status: PartyMemberStatus) => void
  onRemove: () => void
  onView: () => void
  className?: string
  style?: React.CSSProperties
}

export function PartyMemberCard({
  cc,
  isDM,
  onApprove,
  onReject,
  onStatusChange,
  onRemove,
  onView,
  className,
  style,
}: PartyMemberCardProps) {
  const char = cc.character
  const player = char?.user
  const name = char?.name ?? cc.name
  const portraitUrl = char?.portraitUrl ?? cc.portraitUrl
  const metaParts = [char?.race, char?.class, char?.level && `Level ${char.level}`].filter(Boolean)

  return (
    <div
      className={cn(
        'group relative flex w-full min-w-0 items-stretch text-left h-32',
        'rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-raised)]',
        'transition-all duration-150',
        'hover:border-[var(--q-amber-dim)] hover:bg-[var(--q-surface-hero)]',
        'overflow-hidden',
        className,
      )}
      style={style}
    >
      {/* Portrait */}
      <div className="relative w-32 shrink-0 overflow-hidden bg-[linear-gradient(135deg,var(--q-amber-trace),transparent_60%)]">
        {portraitUrl ? (
          <Image
            src={portraitUrl}
            alt={name ?? ''}
            fill
            sizes="128px"
            className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <EntityPlaceholder type="pc" />
          </div>
        )}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--q-surface-raised)] to-transparent group-hover:from-[var(--q-surface-hero)] transition-colors duration-150"
        />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-[var(--q-font-display)] text-base text-[var(--q-amber)] truncate min-w-0 leading-snug">
            {name}
          </h3>
          <button
            onClick={onView}
            className="shrink-0 text-[var(--q-text-faint)] hover:text-[var(--q-amber)] transition-colors mt-0.5"
            title="View character sheet"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>

        {metaParts.length > 0 && (
          <p className="text-[10px] uppercase tracking-[1.5px] text-[var(--q-text-faint)] truncate">
            {metaParts.join(' · ')}
          </p>
        )}

        {player && (
          <p className="text-xs text-[var(--q-text-dim)] truncate">
            {player.displayName || player.name}
          </p>
        )}

        {isDM && (
          <div className="flex items-center gap-2 mt-auto pt-1">
            {cc.status === 'PENDING' ? (
              <>
                <Button size="sm" onClick={onApprove} className="h-6 text-[10px] px-2">
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={onReject} className="h-6 text-[10px] px-2">
                  Reject
                </Button>
              </>
            ) : (
              <>
                <Select
                  value={cc.status}
                  onValueChange={(v) => onStatusChange(v as PartyMemberStatus)}
                >
                  <SelectTrigger className="h-6 w-[110px] text-[10px] uppercase tracking-wide">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs uppercase">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={onRemove}>
                  Remove
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
