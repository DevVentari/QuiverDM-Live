'use client'

import Link from 'next/link'
import { EntityCard, type EntityCardBadge } from '@/components/primitives/EntityCard'
import { EntityPlaceholder, type PlaceholderEntityType } from '@/components/primitives/entity-placeholder'

const TYPE_META: Record<string, { label: string; placeholder: PlaceholderEntityType }> = {
  LOCATION: { label: 'Location', placeholder: 'location' },
  NPC:      { label: 'NPC',      placeholder: 'npc' },
  PC:       { label: 'PC',       placeholder: 'pc' },
  FACTION:  { label: 'Faction',  placeholder: 'faction' },
  ITEM:     { label: 'Item',     placeholder: 'item' },
  EVENT:    { label: 'Event',    placeholder: 'event' },
  ARC:      { label: 'Arc',      placeholder: 'arc' },
  THREAT:   { label: 'Threat',   placeholder: 'threat' },
  SECRET:   { label: 'Secret',   placeholder: 'secret' },
  NOTE:     { label: 'Note',     placeholder: 'note' },
  CUSTOM:   { label: 'Custom',   placeholder: 'custom' },
  MONSTER:  { label: 'Monster',  placeholder: 'monster' },
}

export interface WorldEntryCardData {
  id: string
  name: string
  type: string
  summary?: string | null
  imageUrl?: string | null
}

interface WorldEntryCardProps {
  entry: WorldEntryCardData
  href: string
}

export function WorldEntryCard({ entry, href }: WorldEntryCardProps) {
  const meta = TYPE_META[entry.type] ?? { label: entry.type, placeholder: 'custom' as PlaceholderEntityType }
  const badge: EntityCardBadge = { label: meta.label }

  return (
    <Link href={href} className="block">
      <EntityCard
        imageUrl={entry.imageUrl ?? null}
        imageFallback={<EntityPlaceholder type={meta.placeholder} />}
        title={entry.name}
        badge={badge}
        description={entry.summary}
        onClick={() => {}}
        testId={`world-entry-card-${entry.id}`}
      />
    </Link>
  )
}
