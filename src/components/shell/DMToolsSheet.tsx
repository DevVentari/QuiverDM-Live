'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Dices,
  Swords,
  HeartPulse,
  Users,
  Compass,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Card, Pill } from '@/components/primitives'
import { Button } from '@/components/ui/button'
import { useHeaderStore } from '@/store/header-store'
import { cn } from '@/lib/utils'

interface DMToolsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ToolDefinition = {
  id: string
  label: string
  description: string
  icon: LucideIcon
  action:
    | { kind: 'inline-dice' }
    | { kind: 'link'; hrefFor: (slug: string | null) => string | null; ctaLabel: string }
    | { kind: 'placeholder'; ctaLabel: string }
}

const TOOLS: ToolDefinition[] = [
  {
    id: 'dice',
    label: 'Quick Roll',
    description: 'Roll a d20 right now without leaving what you\'re doing.',
    icon: Dices,
    action: { kind: 'inline-dice' },
  },
  {
    id: 'initiative',
    label: 'Initiative Tracker',
    description: 'Combat order with HP, conditions, and turn pointer — opens inside the live session.',
    icon: Swords,
    action: {
      kind: 'link',
      ctaLabel: 'Open in active session',
      hrefFor: (slug) => null, // requires active session id; future Slice can wire it via header slot
    },
  },
  {
    id: 'condition',
    label: 'Condition Co-pilot',
    description: 'Apply, track, and clear conditions across combatants.',
    icon: HeartPulse,
    action: {
      kind: 'link',
      ctaLabel: 'Open in active session',
      hrefFor: (slug) => null,
    },
  },
  {
    id: 'npc-quick',
    label: 'NPC Generator',
    description: 'Spin up a new NPC — name, role, motivations, secrets.',
    icon: Users,
    action: {
      kind: 'link',
      ctaLabel: 'New NPC',
      hrefFor: (slug) => (slug ? `/campaigns/${slug}/npcs/new` : null),
    },
  },
  {
    id: 'derailment',
    label: 'Derailment Detector',
    description: 'Spot when the table is drifting from prep and surface recovery options.',
    icon: Compass,
    action: { kind: 'placeholder', ctaLabel: 'Live-session only' },
  },
  {
    id: 'oracle',
    label: 'Oracle / Yes-No',
    description: 'Quick fate roll for ambiguous outcomes.',
    icon: Wand2,
    action: { kind: 'placeholder', ctaLabel: 'Coming soon' },
  },
]

function rollD20(): number {
  return 1 + Math.floor(Math.random() * 20)
}

function InlineDice() {
  const [history, setHistory] = useState<number[]>([])
  const last = history[history.length - 1]

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="font-[var(--q-font-display)] text-3xl tabular-nums text-[var(--q-amber)]">
          {last ?? '—'}
        </div>
        <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
          d20 result
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={() => setHistory((h) => [...h, rollD20()].slice(-5))}
        >
          <Dices size={14} className="mr-1.5" />
          Roll
        </Button>
        {history.length > 1 && (
          <span className="text-[10px] text-[var(--q-text-faint)] tabular-nums">
            recent: {history.slice(0, -1).join(' · ')}
          </span>
        )}
      </div>
    </div>
  )
}

export function DMToolsSheet({ open, onOpenChange }: DMToolsSheetProps) {
  const slot = useHeaderStore((s) => s.slot)
  const campaignSlug = slot?.campaignSlug ?? null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[480px] border-[var(--q-border-feature)] bg-[var(--q-surface-feature)] text-[var(--q-text)] sm:max-w-none"
      >
        <SheetHeader>
          <SheetTitle className="font-[var(--q-font-display)] tracking-wide text-[var(--q-text)]">
            DM Tools
          </SheetTitle>
          <SheetDescription className="text-[var(--q-text-dim)]">
            The tools you reach for at the table. More land in later slices.
          </SheetDescription>
        </SheetHeader>

        <ul className="mt-6 flex flex-col gap-3">
          {TOOLS.map(({ id, label, description, icon: Icon, action }) => (
            <li key={id}>
              <Card variant="detail" className="!p-4">
                <div className="flex items-start gap-3">
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
                    <div className="mt-0.5 text-xs text-[var(--q-text-faint)]">{description}</div>
                  </div>
                </div>

                {action.kind === 'inline-dice' && (
                  <div className="mt-4 border-t border-white/5 pt-4">
                    <InlineDice />
                  </div>
                )}

                {action.kind === 'link' && (() => {
                  const href = action.hrefFor(campaignSlug)
                  if (!href) {
                    return (
                      <div className="mt-3 flex items-center justify-end">
                        <Pill variant="neutral">{action.ctaLabel}</Pill>
                      </div>
                    )
                  }
                  return (
                    <div className="mt-3 flex items-center justify-end">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={href}
                          onClick={() => onOpenChange(false)}
                          data-testid={`dm-tool-${id}`}
                        >
                          {action.ctaLabel}
                        </Link>
                      </Button>
                    </div>
                  )
                })()}

                {action.kind === 'placeholder' && (
                  <div className="mt-3 flex items-center justify-end">
                    <Pill variant="neutral">{action.ctaLabel}</Pill>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
