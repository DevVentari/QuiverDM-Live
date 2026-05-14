'use client'

import { useState } from 'react'
import { Map, RefreshCw, ExternalLink } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { FoundryPanel } from '@/components/world/foundry-panel'

interface BattleMapPanelProps {
  campaignId: string
  sessionId: string
}

export function BattleMapPanel({ campaignId, sessionId }: BattleMapPanelProps) {
  const [syncing, setSyncing] = useState(false)

  const { data: settings, isLoading } = trpc.foundry.getSettings.useQuery({ campaignId })
  const syncSession = trpc.foundry.syncSession.useMutation({
    onMutate: () => setSyncing(true),
    onSuccess: ({ queued }) => {
      toast.success(`Queued ${queued} entities — Foundry will update within 5 seconds`)
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setSyncing(false),
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--q-amber)] border-t-transparent" />
      </div>
    )
  }

  if (!settings?.foundryUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <Map className="h-12 w-12 text-[var(--q-text-faint)]" />
        <div>
          <p className="font-[var(--q-font-display)] text-sm text-[var(--q-text)]">
            Foundry not configured
          </p>
          <p className="mt-1 text-xs text-[var(--q-text-faint)]">
            Add your Foundry URL in campaign settings to enable the battle map.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--q-border-subtle)] bg-[var(--q-surface-feature)] px-3 py-1.5">
        <Map className="h-3.5 w-3.5 text-[var(--q-amber)]" />
        <span className="flex-1 truncate font-[var(--q-font-display)] text-[9px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
          Battle Map
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 px-2 text-[10px] text-[var(--q-amber)] hover:bg-[var(--q-amber-trace)] hover:text-[var(--q-amber)]"
          disabled={syncing}
          onClick={() => syncSession.mutate({ campaignId, sessionId })}
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync to Foundry'}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
          <a href={settings.foundryUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 text-[var(--q-text-faint)]" />
          </a>
        </Button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <FoundryPanel campaignId={campaignId} onClose={() => {}} embedded />
      </div>
    </div>
  )
}
