'use client'

import Link from 'next/link'
import { EntityCard as PrimitiveEntityCard, type EntityCardBadge } from '@/components/primitives/EntityCard'
import { EntityPlaceholder, type PlaceholderEntityType } from '@/components/primitives/entity-placeholder'

type Entity = {
  id: string
  name: string
  type: string
  status: string
  description?: string | null
  aliases: string[]
}

const STATUS_DOT: Record<string, string> = {
  active:    'bg-emerald-500',
  dormant:   'bg-yellow-500',
  destroyed: 'bg-[var(--q-accent-danger)]',
  resolved:  'bg-[var(--q-text-faint)]',
}

const STATUS_LABEL: Record<string, string> = {
  active:    'Active',
  dormant:   'Dormant',
  destroyed: 'Destroyed',
  resolved:  'Resolved',
}

const TYPE_PLACEHOLDER: Record<string, PlaceholderEntityType> = {
  NPC:      'npc',
  PC:       'pc',
  FACTION:  'faction',
  LOCATION: 'location',
  ITEM:     'item',
  EVENT:    'event',
  ARC:      'arc',
  THREAT:   'threat',
  SECRET:   'secret',
  CUSTOM:   'custom',
}

const TYPE_BADGE_TONE: Record<string, EntityCardBadge['tone']> = {
  THREAT:   'danger',
  SECRET:   'arcane',
  ARC:      'arcane',
}

type EntityCardProps = {
  entity: Entity
  href?: string
  onClick?: () => void
}

export function EntityCard({ entity, href, onClick }: EntityCardProps) {
  const placeholder = TYPE_PLACEHOLDER[entity.type] ?? 'custom'
  const badge: EntityCardBadge = {
    label: entity.type,
    tone: TYPE_BADGE_TONE[entity.type] ?? 'neutral',
  }

  const subtitle = (
    <>
      <span className="inline-flex items-center gap-1">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[entity.status] ?? 'bg-[var(--q-text-faint)]'}`}
        />
        <span>{STATUS_LABEL[entity.status] ?? entity.status}</span>
      </span>
      {entity.aliases.length > 0 && (
        <>
          <span className="text-[var(--q-border-subtle)]">·</span>
          <span className="truncate">aka {entity.aliases.slice(0, 2).join(', ')}</span>
        </>
      )}
    </>
  )

  const card = (
    <PrimitiveEntityCard
      imageUrl={null}
      imageFallback={<EntityPlaceholder type={placeholder} />}
      title={entity.name}
      badge={badge}
      subtitle={subtitle}
      description={entity.description}
      onClick={onClick ?? (() => {})}
      testId={`brain-entity-card-${entity.id}`}
    />
  )

  if (href) {
    return <Link href={href} className="block">{card}</Link>
  }

  return card
}
