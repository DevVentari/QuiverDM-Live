'use client'

import { Eye, Sparkles, EyeOff } from 'lucide-react'
import { EntityCard, type EntityCardBadge } from '@/components/primitives/EntityCard'

export interface MechanicCardData {
  id: string
  kind: string
  name: string
  description?: string | null
  sourcebook?: string | null
  playerVisible: boolean
  assignedToCharacterId?: string | null
  content?: Record<string, unknown> | null
}

interface MechanicCardProps {
  mechanic: MechanicCardData
  assignedCharacterName?: string | null
  onClick: () => void
}

function kindBadge(kind: string, sourcebook: string | null | undefined): EntityCardBadge {
  if (sourcebook) return { label: sourcebook.toUpperCase() }
  return { label: kind === 'secret' ? 'SECRET' : kind === 'tarot' ? 'TAROT' : kind.toUpperCase() }
}

function fallbackIcon(kind: string) {
  if (kind === 'secret') return <Eye size={32} />
  if (kind === 'tarot') return <Sparkles size={32} />
  return <Sparkles size={32} />
}

function flavorPreview(content: Record<string, unknown> | null | undefined): string | null {
  if (!content) return null
  if (typeof content.flavorText === 'string') return content.flavorText
  if (typeof content.interpretation === 'string') return content.interpretation
  return null
}

export function MechanicCard({ mechanic, assignedCharacterName, onClick }: MechanicCardProps) {
  const description = mechanic.description ?? flavorPreview(mechanic.content)
  const subtitle = (
    <>
      {!mechanic.playerVisible && (
        <span className="inline-flex items-center gap-1 truncate">
          <EyeOff size={10} className="shrink-0" />
          <span>Hidden</span>
        </span>
      )}
      {assignedCharacterName && (
        <>
          {!mechanic.playerVisible && <span className="text-[var(--q-border-subtle)]">·</span>}
          <span className="truncate">Assigned to {assignedCharacterName}</span>
        </>
      )}
    </>
  )

  return (
    <EntityCard
      imageUrl={null}
      imageFallback={fallbackIcon(mechanic.kind)}
      title={mechanic.name}
      badge={kindBadge(mechanic.kind, mechanic.sourcebook)}
      subtitle={(!mechanic.playerVisible || assignedCharacterName) ? subtitle : null}
      description={description}
      onClick={onClick}
      testId={`mechanic-card-${mechanic.id}`}
    />
  )
}
