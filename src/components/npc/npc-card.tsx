'use client'

import { Book, Eye, User } from 'lucide-react'
import { EntityCard, type EntityCardBadge } from '@/components/primitives/EntityCard'
import { EntityPlaceholder } from '@/components/primitives/entity-placeholder'

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

function sourceBadge(npc: NpcCardData): EntityCardBadge | null {
  if (npc._seen) return { label: 'Seen', icon: Eye }
  if (npc._fromSourcebook) return { label: 'Imported', icon: Book }
  if (npc._source === 'npc') return { label: 'DM', tone: 'amber' }
  return null
}


export function NpcCard({ npc, onClick }: NpcCardProps) {
  const subtitle = (npc.role || npc.faction) ? (
    <>
      {npc.role && (
        <span className="inline-flex items-center gap-1 truncate">
          <User size={10} className="shrink-0" />
          <span className="truncate">{npc.role}</span>
        </span>
      )}
      {npc.role && npc.faction && <span className="text-[var(--q-border-subtle)]">·</span>}
      {npc.faction && <span className="truncate">{npc.faction}</span>}
    </>
  ) : null

  return (
    <EntityCard
      imageUrl={npc.imageUrl}
      imageFallback={<EntityPlaceholder type="npc" />}
      title={npc.name}
      badge={sourceBadge(npc)}
      subtitle={subtitle}
      description={npc.description}
      onClick={onClick}
      testId={`npc-card-${npc.id}`}
    />
  )
}
