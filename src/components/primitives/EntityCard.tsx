'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EntityCardBadge {
  label: string
  icon?: LucideIcon
  tone?: 'neutral' | 'amber'
}

export interface EntityCardProps {
  /** Optional image URL — when present, replaces the fallback slot. */
  imageUrl?: string | null
  /** Fallback content shown when imageUrl is null (initials, icon, etc). */
  imageFallback: ReactNode
  /** Card heading. Truncates on overflow. */
  title: string
  /** Optional pill rendered top-right next to the title. */
  badge?: EntityCardBadge | null
  /** Optional inline metadata row (role, faction, tags). */
  subtitle?: ReactNode
  /** Optional body text. Line-clamped to 3 lines. */
  description?: string | null
  /** Optional footer (source attribution, dates). */
  footer?: ReactNode
  onClick: () => void
  testId?: string
}

export function EntityCard({
  imageUrl,
  imageFallback,
  title,
  badge,
  subtitle,
  description,
  footer,
  onClick,
  testId,
}: EntityCardProps) {
  const BadgeIcon = badge?.icon

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'group relative flex items-stretch text-left h-32',
        'rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-surface-sunken)]',
        'transition-all duration-150',
        'hover:border-[var(--q-amber-dim)] hover:bg-[var(--q-surface-elevated)]',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--q-amber)]',
        'overflow-hidden',
      )}
    >
      <div className="relative w-32 shrink-0 overflow-hidden bg-[linear-gradient(135deg,var(--q-amber-trace),transparent_60%)]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="128px"
            className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--q-amber)]/40">
            {imageFallback}
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
            {title}
          </h3>
          {badge && (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5',
                'text-[9px] uppercase tracking-[1.5px]',
                badge.tone === 'amber'
                  ? 'border-[var(--q-amber-dim)] bg-[var(--q-amber-trace)]/50 text-[var(--q-amber)]'
                  : 'border-[var(--q-border-subtle)] bg-black/40 text-[var(--q-text-faint)]',
              )}
            >
              {BadgeIcon && <BadgeIcon size={9} />}
              {badge.label}
            </span>
          )}
        </div>
        {subtitle && (
          <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-[1.5px] text-[var(--q-text-faint)] min-w-0">
            {subtitle}
          </div>
        )}
        {description && (
          <p className="text-xs text-[var(--q-text-dim)] line-clamp-3 mt-0.5">
            {description}
          </p>
        )}
        {footer && (
          <div className="mt-auto flex items-center gap-1.5 text-[10px] text-[var(--q-text-faint)] pt-1">
            {footer}
          </div>
        )}
      </div>
    </button>
  )
}
