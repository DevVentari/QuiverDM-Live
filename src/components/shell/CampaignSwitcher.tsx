'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, ScrollText } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface CampaignSwitcherProps {
  collapsed?: boolean
  mobile?: boolean
  onNavigate?: () => void
}

export function CampaignSwitcher({
  collapsed = false,
  mobile = false,
  onNavigate,
}: CampaignSwitcherProps) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const { toast } = useToast()

  const { data: memberships } = trpc.campaigns.getMyMemberships.useQuery(undefined, {
    staleTime: 120_000,
  })
  const { data: active } = trpc.campaigns.getActive.useQuery(undefined, {
    staleTime: 120_000,
  })

  const setActive = trpc.userSettings.setActiveCampaign.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.campaigns.getActive.invalidate(),
        utils.campaigns.getMyMemberships.invalidate(),
        utils.sessions.getAll.invalidate(),
      ])
      onNavigate?.()
      router.replace('/')
    },
    onError: (err) => {
      const code = err.data?.code
      const message =
        code === 'FORBIDDEN'
          ? 'You no longer have access to this campaign.'
          : "Couldn't switch campaign - try again."
      toast({ title: 'Switch failed', description: message, variant: 'destructive' })
      if (code === 'FORBIDDEN') {
        void utils.campaigns.getMyMemberships.invalidate()
      }
    },
  })

  if (memberships && memberships.length === 0) return null

  const triggerLabel = active?.name ?? 'Select campaign'
  const sessionCount = active?.sessionCount ?? 0

  let trigger: ReactNode
  if (collapsed) {
    trigger = (
      <button
        type="button"
        aria-label={triggerLabel}
        title={triggerLabel}
        data-testid="campaign-switcher-trigger"
        className={cn(
          'mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-sm',
          'border border-[var(--q-border-subtle)] bg-[var(--q-surface-sunken)]',
          'text-[var(--q-text-faint)] transition-colors hover:border-[var(--q-amber-dim)] hover:text-[var(--q-amber)]',
        )}
      >
        <ChevronsUpDown size={14} strokeWidth={1.8} />
      </button>
    )
  } else {
    trigger = (
      <button
        type="button"
        data-testid="campaign-switcher-trigger"
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2 text-left',
          'border-[var(--q-amber-trace)] bg-[var(--q-surface)] transition-colors hover:border-[var(--q-amber-dim)]',
          mobile ? 'mx-0 mb-2' : 'mx-3 mb-2 mt-3',
        )}
        style={{
          background: 'linear-gradient(180deg, rgba(212,168,102,0.04), transparent)',
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-[var(--q-text)]">{triggerLabel}</p>
          <p className="mt-0.5 text-[10px] text-[var(--q-text-faint)]">
            {memberships ? `${sessionCount} sessions - switch` : 'Loading...'}
          </p>
        </div>
        <ChevronsUpDown
          size={14}
          className="shrink-0 text-[var(--q-text-faint)]"
          strokeWidth={1.8}
        />
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? 'right' : 'bottom'} align="start" className="w-60">
        {memberships?.map((c) => {
          const isActive = c.id === active?.id
          return (
            <DropdownMenuItem
              key={c.id}
              onClick={() => {
                if (isActive || setActive.isPending) return
                setActive.mutate({ campaignId: c.id })
              }}
              data-testid={`campaign-switcher-item-${c.slug}`}
              className="gap-2"
            >
              {isActive ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--q-amber)]" />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <span className="truncate">{c.name}</span>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/campaigns" className="gap-2" onClick={onNavigate}>
            <ScrollText className="h-3.5 w-3.5 shrink-0" />
            <span>Manage all campaigns</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
