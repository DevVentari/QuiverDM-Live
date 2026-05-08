'use client'

import { useHeaderStore } from '@/store/header-store'
import { PressureGauges } from './PressureGauges'
import { UserMenu } from '@/components/user-menu'
import { trpc } from '@/lib/trpc'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'

export function CommandBar() {
  const { slot, setBrainOpen } = useHeaderStore()
  const router = useRouter()

  const { data: campaigns } = trpc.campaigns.getMyMemberships.useQuery(undefined, {
    staleTime: 120_000,
  })

  return (
    <header
      className={cn(
        'hidden md:flex items-center h-12 shrink-0 px-4 gap-4',
        'border-b border-[var(--q-border-subtle)]',
        'bg-[var(--q-surface-sunken)]',
      )}
    >
      {/* Campaign switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-2 text-sm text-[var(--q-text)] max-w-[200px]',
              'hover:text-[var(--q-amber)] transition-colors',
            )}
          >
            <span className="font-[var(--q-font-display)] text-[10px] tracking-[2px] text-[var(--q-amber)] uppercase truncate">
              {slot?.title ?? 'No campaign'}
            </span>
            <ChevronDown size={12} className="shrink-0 text-[var(--q-text-faint)]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-[var(--q-surface-flat)] border-[var(--q-border)]">
          {campaigns?.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onSelect={() => router.push(`/campaigns/${c.slug}`)}
              className="text-[var(--q-text)] hover:text-[var(--q-amber)] cursor-pointer"
            >
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Pressure gauges (DM only — self-contained) */}
      <div className="flex-1 flex justify-center">
        <PressureGauges />
      </div>

      {/* Brain trigger */}
      <button
        onClick={() => setBrainOpen(true)}
        aria-label="Open Brain (Ctrl+K)"
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs',
          'bg-[var(--q-amber-trace)] border border-[var(--q-border-subtle)]',
          'text-[var(--q-text-dim)] hover:text-[var(--q-text)] transition-colors',
        )}
      >
        <span>&#x2318;K</span>
        <span className="hidden lg:inline">Ask the Brain</span>
      </button>

      {/* User menu */}
      <UserMenu />
    </header>
  )
}
