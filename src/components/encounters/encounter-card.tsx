'use client'

import { Trash2 } from 'lucide-react'
import { EntityCard, type EntityCardBadge } from '@/components/primitives/EntityCard'
import { EntityPlaceholder } from '@/components/primitives/entity-placeholder'
import Link from 'next/link'
import { format } from 'date-fns'

type Difficulty = 'easy' | 'medium' | 'hard' | 'deadly'

const DIFF_BADGE: Record<Difficulty, EntityCardBadge> = {
  easy:   { label: 'Easy',   tone: 'neutral' },
  medium: { label: 'Medium', tone: 'neutral' },
  hard:   { label: 'Hard',   tone: 'amber' },
  deadly: { label: 'Deadly', tone: 'danger' },
}

export interface EncounterCardData {
  id: string
  name: string
  difficulty?: string | null
  portraitUrl?: string | null
  sceneDescription?: string | null
  adjustedXp?: number
  partySize?: number | null
  partyLevel?: number | null
  createdAt: string | Date
  _count?: { creatures?: number } | null
  creatures?: unknown[] | null
}

interface EncounterCardProps {
  plan: EncounterCardData
  href: string
  isDM?: boolean
  onDelete?: () => void
  isDeleting?: boolean
}

export function EncounterCard({ plan, href, isDM, onDelete, isDeleting }: EncounterCardProps) {
  const diffKey = (plan.difficulty ?? 'medium') as Difficulty
  const badge = DIFF_BADGE[diffKey] ?? DIFF_BADGE.medium
  const creatureCount = plan._count?.creatures ?? (plan.creatures?.length ?? 0)

  const subtitle = (
    <>
      <span>{creatureCount} {creatureCount === 1 ? 'creature' : 'creatures'}</span>
      {plan.partySize && plan.partyLevel && (
        <>
          <span className="text-[var(--q-border-subtle)]">·</span>
          <span>{plan.partySize}p · Lv.{plan.partyLevel}</span>
        </>
      )}
    </>
  )

  const footer = (
    <>
      {(plan.adjustedXp ?? 0) > 0 && (
        <span className="text-[var(--q-amber)] font-medium">
          {(plan.adjustedXp ?? 0).toLocaleString()} XP
        </span>
      )}
      <span className="ml-auto text-[var(--q-text-faint)]">
        {format(new Date(plan.createdAt), 'MMM d, yyyy')}
      </span>
    </>
  )

  return (
    <div className="relative group">
      <Link href={href} className="block">
        <EntityCard
          imageUrl={plan.portraitUrl ?? null}
          imageFallback={<EntityPlaceholder type="encounter" />}
          title={plan.name}
          badge={badge}
          subtitle={subtitle}
          description={plan.sceneDescription}
          footer={footer}
          onClick={() => {}}
          testId={`encounter-card-${plan.id}`}
        />
      </Link>

      {isDM && onDelete && (
        <button
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-sm bg-[var(--q-surface-feature)]/90 backdrop-blur-sm border border-[var(--q-border-subtle)] hover:bg-destructive hover:text-destructive-foreground text-[var(--q-text-dim)] z-10"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete()
          }}
          disabled={isDeleting}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
