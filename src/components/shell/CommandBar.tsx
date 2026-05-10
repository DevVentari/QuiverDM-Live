'use client'

import { ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Surface } from '@/components/primitives'
import { UserMenu } from '@/components/user-menu'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'
import { useHeaderStore } from '@/store/header-store'
import { PressureGauges } from './PressureGauges'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function CommandBar() {
  const { slot, setBrainOpen } = useHeaderStore()
  const router = useRouter()

  const { data: campaigns } = trpc.campaigns.getMyMemberships.useQuery(undefined, {
    staleTime: 120_000,
  })

  return (
    <Surface
      asChild
      variant="utility"
      className={cn(
        'hidden h-[var(--q-command-bar-h)] shrink-0 items-center gap-4 rounded-none border-x-0 border-t-0 px-4 md:flex',
        'bg-[var(--q-shell-bar)] backdrop-blur-md',
      )}
    >
      <header>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex max-w-[200px] items-center gap-2 text-sm text-[var(--q-text)] transition-colors hover:text-[var(--q-amber)]',
              )}
            >
              <span className="truncate font-[var(--q-font-display)] text-[10px] uppercase tracking-[2px] text-[var(--q-amber)]">
                {slot?.title ?? 'No campaign'}
              </span>
              <ChevronDown size={12} className="shrink-0 text-[var(--q-text-faint)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="border-[var(--q-border-feature)] bg-[var(--q-surface-feature)] text-[var(--q-text)]"
          >
            {campaigns?.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onSelect={() => router.push(`/campaigns/${c.slug}`)}
                className="cursor-pointer text-[var(--q-text)] hover:text-[var(--q-amber)]"
              >
                {c.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex flex-1 justify-center">
          <PressureGauges />
        </div>

        <button
          onClick={() => setBrainOpen(true)}
          aria-label="Open Brain (Ctrl+K)"
          className={cn(
            'flex items-center gap-2 rounded-sm border border-[var(--q-border-subtle)] bg-[var(--q-amber-trace)] px-3 py-1.5 text-xs',
            'text-[var(--q-text-dim)] transition-colors hover:text-[var(--q-text)]',
          )}
        >
          <span>&#x2318;K</span>
          <span className="hidden lg:inline">Ask the Brain</span>
        </button>

        <UserMenu />
      </header>
    </Surface>
  )
}
