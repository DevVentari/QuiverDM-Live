'use client'

import Link from 'next/link'
import {
  ScrollText,
  Calendar,
  Users,
  Sword,
  Package,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useHeaderStore } from '@/store/header-store'
import { cn } from '@/lib/utils'

interface QuickAddSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type QuickAddOption = {
  id: string
  label: string
  description: string
  icon: LucideIcon
  /** Built once an active campaign is known. Returning null disables the option. */
  hrefFor: (slug: string | null | undefined) => string | null
  /** Hint surfaced when the option is disabled. */
  disabledHint?: string
}

const OPTIONS: QuickAddOption[] = [
  {
    id: 'campaign',
    label: 'New Campaign',
    description: 'Start a fresh campaign with its own world, sessions, and NPCs.',
    icon: ScrollText,
    hrefFor: () => '/campaigns/new',
  },
  {
    id: 'session',
    label: 'New Session',
    description: 'Schedule the next play night for the active campaign.',
    icon: Calendar,
    hrefFor: (slug) => (slug ? `/campaigns/${slug}/sessions/new` : null),
    disabledHint: 'Pick a campaign first',
  },
  {
    id: 'npc',
    label: 'New NPC',
    description: 'Add a recurring or one-shot NPC to the active campaign.',
    icon: Users,
    hrefFor: (slug) => (slug ? `/campaigns/${slug}/npcs/new` : null),
    disabledHint: 'Pick a campaign first',
  },
  {
    id: 'encounter',
    label: 'New Encounter',
    description: 'Pre-build an encounter for the active campaign.',
    icon: Sword,
    hrefFor: (slug) => (slug ? `/campaigns/${slug}/encounters/new` : null),
    disabledHint: 'Pick a campaign first',
  },
  {
    id: 'character',
    label: 'New Character',
    description: 'Roll up a new player character.',
    icon: UserPlus,
    hrefFor: () => '/characters/new',
  },
  {
    id: 'homebrew',
    label: 'New Homebrew',
    description: 'Author or import a custom monster, item, spell, or rule.',
    icon: Package,
    hrefFor: () => '/homebrew',
  },
]

export function QuickAddSheet({ open, onOpenChange }: QuickAddSheetProps) {
  const slot = useHeaderStore((s) => s.slot)
  const campaignSlug = slot?.campaignSlug ?? null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[460px] border-[var(--q-border-feature)] bg-[var(--q-surface-feature)] text-[var(--q-text)] sm:max-w-none"
      >
        <SheetHeader>
          <SheetTitle className="font-[var(--q-font-display)] tracking-wide text-[var(--q-text)]">
            Quick Add
          </SheetTitle>
          <SheetDescription className="text-[var(--q-text-dim)]">
            Jump into the create flow for any entity.
            {campaignSlug ? null : ' Pick or create a campaign to unlock scoped entities.'}
          </SheetDescription>
        </SheetHeader>

        <ul className="mt-6 flex flex-col gap-2">
          {OPTIONS.map(({ id, label, description, icon: Icon, hrefFor, disabledHint }) => {
            const href = hrefFor(campaignSlug)
            const disabled = href === null
            const content = (
              <div
                className={cn(
                  'flex items-start gap-3 rounded-sm px-3 py-3',
                  'border border-white/5',
                  disabled
                    ? 'opacity-50'
                    : 'transition-colors hover:border-[var(--q-amber-dim)] hover:bg-white/[0.03]',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-sm',
                    'bg-[var(--q-amber-trace)]/40 text-[var(--q-amber-dim)]',
                  )}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[var(--q-text)]">{label}</div>
                  <div className="mt-0.5 text-xs text-[var(--q-text-faint)]">
                    {disabled && disabledHint ? disabledHint : description}
                  </div>
                </div>
              </div>
            )

            if (disabled) {
              return (
                <li key={id} aria-disabled="true">
                  {content}
                </li>
              )
            }
            return (
              <li key={id}>
                <Link
                  href={href!}
                  data-testid={`quick-add-${id}`}
                  onClick={() => onOpenChange(false)}
                >
                  {content}
                </Link>
              </li>
            )
          })}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
