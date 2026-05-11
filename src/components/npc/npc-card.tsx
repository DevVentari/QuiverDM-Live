'use client'

import Image from 'next/image'
import { Sparkles, Book, Eye, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NpcCardData {
  id: string
  name: string
  description?: string | null
  faction?: string | null
  role?: string | null
  imageUrl?: string | null
  _source?: 'npc' | 'entity'
  _fromSourcebook?: boolean
  _seen?: boolean
}

interface NpcCardProps {
  npc: NpcCardData
  onClick: () => void
}

function sourceMeta(npc: NpcCardData) {
  if (npc._seen) return { label: 'Seen', icon: Eye }
  if (npc._fromSourcebook) return { label: 'Imported', icon: Book }
  if (npc._source === 'npc') return { label: 'DM', icon: Sparkles }
  return null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export function NpcCard({ npc, onClick }: NpcCardProps) {
  const meta = sourceMeta(npc)
  const SourceIcon = meta?.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex items-stretch text-left h-32',
        'rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-sunken)]',
        'transition-all duration-150',
        'hover:border-[var(--q-amber-dim)] hover:bg-[var(--q-surface-elevated)]',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--q-amber)]',
        'overflow-hidden',
      )}
      data-testid={`npc-card-${npc.id}`}
    >
      <div className="relative w-32 shrink-0 overflow-hidden bg-[linear-gradient(135deg,var(--q-amber-trace),transparent_60%)]">
        {npc.imageUrl ? (
          <Image
            src={npc.imageUrl}
            alt=""
            fill
            sizes="128px"
            className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-[var(--q-font-display)] text-3xl text-[var(--q-amber)]/40">
              {initials(npc.name)}
            </span>
          </div>
        )}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--q-surface-sunken)] to-transparent"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-[var(--q-font-display)] text-base text-[var(--q-text)] truncate min-w-0">
            {npc.name}
          </h3>
          {meta && (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-sm',
                'border border-[var(--q-border-subtle)] bg-black/40',
                'px-1.5 py-0.5 text-[9px] uppercase tracking-[1.5px] text-[var(--q-text-faint)]',
              )}
            >
              {SourceIcon && <SourceIcon size={9} />}
              {meta.label}
            </span>
          )}
        </div>
        {(npc.role || npc.faction) && (
          <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-[1.5px] text-[var(--q-text-faint)]">
            {npc.role && (
              <span className="inline-flex items-center gap-1 truncate">
                <User size={10} className="shrink-0" />
                <span className="truncate">{npc.role}</span>
              </span>
            )}
            {npc.role && npc.faction && <span className="text-[var(--q-border-subtle)]">·</span>}
            {npc.faction && <span className="truncate">{npc.faction}</span>}
          </div>
        )}
        {npc.description && (
          <p className="text-xs text-[var(--q-text-dim)] line-clamp-3 mt-0.5">
            {npc.description}
          </p>
        )}
      </div>
    </button>
  )
}
