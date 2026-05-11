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

  let trigger: ReactNode
  if (collapsed) {
    trigger = (
      <button
        type="button"
        aria-label={triggerLabel}
        title={triggerLabel}
        data-testid="campaign-switcher-trigger"
        className={cn(
          'group mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-sm',
          'border border-[var(--q-border-subtle)] bg-[var(--q-surface-feature)]',
          'text-[var(--q-text-faint)] transition-colors',
          'hover:border-[var(--q-amber-border)] hover:bg-[var(--q-amber-trace)] hover:text-[var(--q-amber)]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--q-amber-border)]',
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
          'group relative flex w-full items-center justify-between gap-2 overflow-hidden rounded-sm border px-3 py-2.5 text-left',
          'border-[var(--q-border-subtle)] bg-[var(--q-surface-feature)] backdrop-blur-sm',
          'transition-all duration-200',
          'hover:border-[var(--q-amber-border)] hover:bg-[var(--q-amber-trace)]',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--q-amber-border)]',
          mobile ? 'mx-0 mb-2' : 'mx-3 mb-2 mt-3',
        )}
      >
        {/* Amber trace gradient overlay */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--q-amber-trace)] to-transparent opacity-60 transition-opacity group-hover:opacity-100"
        />
        <div className="relative min-w-0 flex-1">
          <p className="label-overline">Active world</p>
          <p
            className="mt-1 truncate font-[var(--q-font-display)] text-sm tracking-wide text-[var(--q-text)]"
            title={triggerLabel}
          >
            {triggerLabel}
          </p>
        </div>
        <ChevronsUpDown
          size={14}
          className="relative shrink-0 text-[var(--q-text-faint)] transition-colors group-hover:text-[var(--q-amber)]"
          strokeWidth={1.8}
        />
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? 'right' : 'bottom'}
        align="start"
        sideOffset={6}
        className={cn(
          'q-panel-grain relative w-64 overflow-hidden p-1',
          'border-[var(--q-border-feature)] bg-[var(--q-surface-feature)]',
          'backdrop-blur-md shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]',
        )}
      >
        {/* Top amber accent rule */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--q-amber-border)] to-transparent"
        />
        <div className="px-2 py-1.5">
          <p className="label-overline">Switch campaign</p>
        </div>
        <div className="space-y-0.5">
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
                className={cn(
                  'relative cursor-pointer gap-2 rounded-sm px-2 py-2 pl-3',
                  'focus:bg-[var(--q-amber-trace)] focus:text-[var(--q-text)]',
                  isActive && 'bg-[var(--q-amber-trace)]',
                )}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-[var(--q-amber)]"
                  />
                )}
                {isActive ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-[var(--q-amber)]" strokeWidth={2.2} />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                <span
                  className={cn(
                    'truncate text-sm',
                    isActive
                      ? 'font-[var(--q-font-display)] tracking-wide text-[var(--q-text)]'
                      : 'text-[var(--q-text-dim)]',
                  )}
                >
                  {c.name}
                </span>
              </DropdownMenuItem>
            )
          })}
        </div>
        <DropdownMenuSeparator className="my-1 bg-[var(--q-border-subtle)]" />
        <DropdownMenuItem asChild className="cursor-pointer rounded-sm px-2 py-2">
          <Link
            href="/campaigns"
            className="group/manage flex items-center gap-2 text-[var(--q-text-dim)] hover:text-[var(--q-amber)]"
            onClick={onNavigate}
          >
            <ScrollText className="h-3.5 w-3.5 shrink-0 text-[var(--q-text-faint)] transition-colors group-hover/manage:text-[var(--q-amber)]" />
            <span className="text-sm">Manage all campaigns</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
