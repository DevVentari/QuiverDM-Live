'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trpc } from '@/lib/trpc'

type AssetKind = 'banner' | 'emblem' | 'activity'

interface Props {
  kind: AssetKind
  campaignId?: string
  worldEntryId?: string
  className?: string
}

export function RegenerateAssetButton({ kind, campaignId, worldEntryId, className }: Props) {
  const [queued, setQueued] = useState(false)
  const banner = trpc.campaigns.regenerateBanner.useMutation()
  const emblem = trpc.campaigns.regenerateEmblem.useMutation()
  const activity = trpc.world.regenerateActivityImage.useMutation()

  if (process.env.NODE_ENV === 'production') return null

  const isPending = banner.isPending || emblem.isPending || activity.isPending

  const handle = async () => {
    if (kind === 'banner' && campaignId) await banner.mutateAsync({ campaignId })
    else if (kind === 'emblem' && campaignId) await emblem.mutateAsync({ campaignId })
    else if (kind === 'activity' && worldEntryId) await activity.mutateAsync({ worldEntryId })
    setQueued(true)
    setTimeout(() => setQueued(false), 4000)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handle}
      disabled={isPending}
      className={className}
      title="Regenerate image (dev)"
    >
      <Sparkles size={12} />
      {queued ? 'Queued' : isPending ? '…' : 'Regen'}
    </Button>
  )
}
