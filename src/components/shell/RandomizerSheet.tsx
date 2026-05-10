'use client'

import { useState } from 'react'
import { Dices, Coins, Loader2, Sparkles, RefreshCw } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Card, Pill } from '@/components/primitives'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { trpc } from '@/lib/trpc'
import { cn } from '@/lib/utils'

interface RandomizerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Dice ────────────────────────────────────────────────────────────────────

type DiceRoll = {
  expr: string
  rolls: number[]
  modifier: number
  total: number
}

function parseDice(expr: string): { count: number; sides: number; modifier: number } | null {
  const match = expr.trim().match(/^(\d*)d(\d+)\s*([+-]\s*\d+)?$/i)
  if (!match) return null
  const count = match[1] ? parseInt(match[1], 10) : 1
  const sides = parseInt(match[2], 10)
  const modifier = match[3] ? parseInt(match[3].replace(/\s+/g, ''), 10) : 0
  if (count < 1 || count > 100) return null
  if (sides < 2 || sides > 1000) return null
  return { count, sides, modifier }
}

function roll(expr: string): DiceRoll | null {
  const parsed = parseDice(expr)
  if (!parsed) return null
  const { count, sides, modifier } = parsed
  const rolls: number[] = []
  for (let i = 0; i < count; i++) {
    rolls.push(1 + Math.floor(Math.random() * sides))
  }
  const total = rolls.reduce((a, b) => a + b, 0) + modifier
  return { expr, rolls, modifier, total }
}

function DiceSection() {
  const [expr, setExpr] = useState('1d20')
  const [last, setLast] = useState<DiceRoll | null>(null)
  const [error, setError] = useState<string | null>(null)

  const doRoll = (override?: string) => {
    const target = override ?? expr
    const result = roll(target)
    if (!result) {
      setError('Use NdM[+/-K] (e.g. 2d6+3, 1d20, d100)')
      setLast(null)
      return
    }
    setError(null)
    setLast(result)
  }

  return (
    <Card variant="detail" className="space-y-3">
      <div className="flex items-center gap-2">
        <Dices size={14} className="text-[var(--q-amber-dim)]" />
        <span className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
          Quick Roll
        </span>
      </div>
      <div className="flex gap-2">
        <Input
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              doRoll()
            }
          }}
          placeholder="1d20+5"
          className="h-9 bg-transparent border-white/5 text-sm"
        />
        <Button size="sm" onClick={() => doRoll()}>
          Roll
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100'].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setExpr(q)
              doRoll(q)
            }}
            className="rounded-sm border border-white/5 px-2 py-0.5 text-[11px] text-[var(--q-text-faint)] hover:text-[var(--q-amber-dim)] hover:border-[var(--q-amber-dim)] transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-xs text-[var(--q-text-warning)]">{error}</p>
      )}
      {last && (
        <div className="flex items-end justify-between gap-3 border-t border-white/5 pt-3">
          <div>
            <div className="font-[var(--q-font-display)] text-3xl tabular-nums text-[var(--q-amber)]">
              {last.total}
            </div>
            <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
              {last.expr} result
            </div>
          </div>
          <div className="text-right text-xs text-[var(--q-text-faint)]">
            <div className="font-mono">[{last.rolls.join(', ')}]</div>
            {last.modifier !== 0 && (
              <div className="font-mono">{last.modifier > 0 ? '+' : ''}{last.modifier}</div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Oracle ──────────────────────────────────────────────────────────────────

const ORACLE_OUTCOMES = [
  { label: 'Definitely Yes', weight: 1, tone: 'primary' as const },
  { label: 'Likely Yes', weight: 2, tone: 'info' as const },
  { label: 'Yes, but…', weight: 2, tone: 'info' as const },
  { label: 'No, but…', weight: 2, tone: 'neutral' as const },
  { label: 'Likely No', weight: 2, tone: 'neutral' as const },
  { label: 'Definitely No', weight: 1, tone: 'danger' as const },
]

function pickOracle() {
  const total = ORACLE_OUTCOMES.reduce((sum, o) => sum + o.weight, 0)
  let pick = Math.random() * total
  for (const o of ORACLE_OUTCOMES) {
    pick -= o.weight
    if (pick <= 0) return o
  }
  return ORACLE_OUTCOMES[0]
}

function OracleSection() {
  const [last, setLast] = useState<(typeof ORACLE_OUTCOMES)[number] | null>(null)
  return (
    <Card variant="detail" className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-[var(--q-amber-dim)]" />
        <span className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
          Yes / No Oracle
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-h-[28px]">
          {last ? (
            <Pill variant={last.tone}>{last.label}</Pill>
          ) : (
            <span className="text-xs text-[var(--q-text-faint)]">
              Ask a question, hit Roll.
            </span>
          )}
        </div>
        <Button size="sm" variant="default" onClick={() => setLast(pickOracle())}>
          <RefreshCw size={13} className="mr-1.5" />
          {last ? 'Re-roll' : 'Ask'}
        </Button>
      </div>
    </Card>
  )
}

// ─── Coin / D100 ─────────────────────────────────────────────────────────────

function QuickFlipsSection() {
  const [coin, setCoin] = useState<'Heads' | 'Tails' | null>(null)
  const [d100, setD100] = useState<number | null>(null)

  return (
    <Card variant="detail" className="space-y-3">
      <div className="flex items-center gap-2">
        <Coins size={14} className="text-[var(--q-amber-dim)]" />
        <span className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
          Coin · Percentile
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setCoin(Math.random() < 0.5 ? 'Heads' : 'Tails')}
          className={cn(
            'rounded-sm border border-white/5 px-3 py-3 text-left',
            'transition-colors hover:border-[var(--q-amber-dim)]',
          )}
        >
          <div className="font-[var(--q-font-display)] text-lg text-[var(--q-amber)]">
            {coin ?? 'Flip'}
          </div>
          <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
            Coin
          </div>
        </button>
        <button
          type="button"
          onClick={() => setD100(1 + Math.floor(Math.random() * 100))}
          className={cn(
            'rounded-sm border border-white/5 px-3 py-3 text-left',
            'transition-colors hover:border-[var(--q-amber-dim)]',
          )}
        >
          <div className="font-[var(--q-font-display)] text-lg text-[var(--q-amber)] tabular-nums">
            {d100 ?? 'd100'}
          </div>
          <div className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
            Percentile
          </div>
        </button>
      </div>
    </Card>
  )
}

// ─── AI Generators ───────────────────────────────────────────────────────────

type GeneratorKind = 'npc' | 'location' | 'hook'
const GENERATOR_LABELS: Record<GeneratorKind, string> = {
  npc: 'Random NPC',
  location: 'Random Location',
  hook: 'Adventure Hook',
}

function AIGeneratorSection() {
  const [kind, setKind] = useState<GeneratorKind | null>(null)
  const [content, setContent] = useState<string | null>(null)

  const generate = trpc.randomizer.generate.useMutation({
    onSuccess: (res) => setContent(res.content),
    onError: (err) => setContent(`⚠ ${err.message}`),
  })

  const run = (k: GeneratorKind) => {
    setKind(k)
    setContent(null)
    generate.mutate({ kind: k })
  }

  return (
    <Card variant="detail" className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-[var(--q-amber-dim)]" />
        <span className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
          AI Generators
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(GENERATOR_LABELS) as GeneratorKind[]).map((k) => (
          <Button
            key={k}
            size="sm"
            variant={kind === k ? 'default' : 'outline'}
            disabled={generate.isPending}
            onClick={() => run(k)}
            data-testid={`randomizer-ai-${k}`}
            className="text-xs"
          >
            {GENERATOR_LABELS[k].split(' ').slice(-1)[0]}
          </Button>
        ))}
      </div>
      <div className="min-h-[80px] rounded-sm border border-white/5 bg-black/20 p-3 text-xs leading-relaxed text-[var(--q-text-dim)] whitespace-pre-wrap">
        {generate.isPending ? (
          <span className="inline-flex items-center gap-2 text-[var(--q-text-faint)]">
            <Loader2 size={12} className="animate-spin" />
            Conjuring {kind ? GENERATOR_LABELS[kind].toLowerCase() : '…'}
          </span>
        ) : content ? (
          content
        ) : (
          <span className="text-[var(--q-text-faint)]">
            Pick NPC / Location / Hook to spin one up.
          </span>
        )}
      </div>
    </Card>
  )
}

// ─── Names ───────────────────────────────────────────────────────────────────

const NAME_BANK: Record<string, string[]> = {
  Common: ['Alaric Wren', 'Mara Hollow', 'Tomas Quill', 'Briar Vance', 'Selene Marsh', 'Garran Ashford'],
  Elvish: ['Aelindra Sylvar', 'Cael Lirien', 'Thalion Mistwalker', 'Ilara Moonshade', 'Verandil Starweaver'],
  Dwarvish: ['Dorin Stoneheart', 'Brunda Ironvein', 'Garruk Anvilbreaker', 'Thordak Gemspeak'],
  Tavern: ['The Chipped Tankard', 'Hounds & Bramble', 'The Lantern Crow', 'Salt & Sigil', 'The Quiet Door'],
}

function NamesSection() {
  const [culture, setCulture] = useState<string>('Common')
  const [name, setName] = useState<string | null>(null)

  return (
    <Card variant="detail" className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-[var(--q-amber-dim)]" />
        <span className="text-[10px] uppercase tracking-[2px] text-[var(--q-text-faint)]">
          Names
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Select value={culture} onValueChange={setCulture}>
          <SelectTrigger className="h-9 flex-1 bg-transparent border-white/5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(NAME_BANK).map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => {
            const list = NAME_BANK[culture] ?? []
            setName(list[Math.floor(Math.random() * list.length)] ?? null)
          }}
        >
          Spin
        </Button>
      </div>
      <div className="min-h-[28px]">
        {name ? (
          <span className="font-[var(--q-font-display)] text-base text-[var(--q-text)]">
            {name}
          </span>
        ) : (
          <span className="text-xs text-[var(--q-text-faint)]">
            Pick a culture, hit Spin.
          </span>
        )}
      </div>
    </Card>
  )
}

// ─── Sheet ───────────────────────────────────────────────────────────────────

export function RandomizerSheet({ open, onOpenChange }: RandomizerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[480px] border-[var(--q-border-feature)] bg-[var(--q-surface-feature)] text-[var(--q-text)] sm:max-w-none overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="font-[var(--q-font-display)] tracking-wide text-[var(--q-text)]">
            Randomizer
          </SheetTitle>
          <SheetDescription className="text-[var(--q-text-dim)]">
            Dice, oracles, and AI generators. Encounter tables ship in a future slice.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-3">
          <DiceSection />
          <QuickFlipsSection />
          <OracleSection />
          <NamesSection />
          <AIGeneratorSection />
        </div>
      </SheetContent>
    </Sheet>
  )
}
